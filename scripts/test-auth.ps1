[CmdletBinding()]
param(
  [int]$Port = 3100,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

try {
  chcp 65001 > $null
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch { }

$base = "http://127.0.0.1:$Port"
$log = Join-Path $env:TEMP ("saferide-auth-test-{0}.log" -f $Port)
$script:server = $null
$script:results = @()

$oldClientId = $env:GOOGLE_OAUTH_CLIENT_ID
$oldSecret = $env:ADMIN_SESSION_SECRET
$oldAllowLocal = $env:ALLOW_LOCAL_ADMIN_LOGIN

function Add-Result {
  param([string]$Name, [bool]$Ok, [string]$Detail = '')
  $script:results += [pscustomobject]@{ Name = $Name; Ok = $Ok; Detail = $Detail }
  if ($Ok) {
    Write-Host ("  [PASS] {0}" -f $Name) -ForegroundColor Green
  } else {
    Write-Host ("  [FAIL] {0} - {1}" -f $Name, $Detail) -ForegroundColor Red
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Restore-Env {
  param([string]$Name, [string]$Value)
  if ($null -eq $Value) { Remove-Item ("Env:" + $Name) -ErrorAction SilentlyContinue }
  else { Set-Item ("Env:" + $Name) $Value }
}

function Stop-TestServer {
  if ($script:server -and -not $script:server.HasExited) {
    & taskkill.exe /PID $script:server.Id /T /F 2>$null | Out-Null
    Start-Sleep -Milliseconds 500
  }
  $script:server = $null
}

function Invoke-NpmStep {
  param([string]$Name, [string[]]$NpmArgs)
  Write-Host ("`n>> {0}" -f $Name) -ForegroundColor Cyan
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) { throw ("{0} thất bại (exit code {1})" -f $Name, $LASTEXITCODE) }
  Add-Result $Name $true
}

function Invoke-ExpectError {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Body = ''
  )
  $params = @{
    UseBasicParsing = $true
    Uri             = "$base$Path"
    Method          = $Method
    TimeoutSec      = 20
    ErrorAction     = 'Stop'
  }
  if ($Body) {
    $params.ContentType = 'application/json'
    $params.Body = $Body
  }

  try {
    $response = Invoke-WebRequest @params
    return @{ Status = [int]$response.StatusCode; Body = $response.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { throw }
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    $reader.Dispose()
    return @{ Status = [int]$resp.StatusCode; Body = $text }
  }
}

$exitCode = 0

try {
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host " SafeRide EDU AI 2026 - FULL AUTH TEST" -ForegroundColor Cyan
  Write-Host " Thư mục: $root" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor Cyan

  $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($existing) {
    throw ("Port {0} đang được sử dụng. Đóng ứng dụng đang chạy hoặc dùng: .\scripts\test-auth.ps1 -Port 3101" -f $Port)
  }

  # 1) Unit + integration tests
  Invoke-NpmStep 'npm test' @('test')

  # 2) TypeScript
  Invoke-NpmStep 'npm run typecheck' @('run', 'typecheck')

  # 3) Khởi động dev server với cấu hình test xác định
  Write-Host "`n>> Khởi động dev server để test API auth..." -ForegroundColor Cyan
  $env:GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
  $env:ADMIN_SESSION_SECRET = 'test-admin-session-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  $env:ALLOW_LOCAL_ADMIN_LOGIN = 'true'

  if (Test-Path $log) { Remove-Item $log -Force }
  $cmdLine = ('/c npm run dev -- -p {0} > "{1}" 2>&1' -f $Port, $log)
  $script:server = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WorkingDirectory $root -PassThru -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(120)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    try {
      $probe = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/admin/config" -TimeoutSec 3 -ErrorAction Stop
      if ($probe.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
  }

  if (-not $ready) {
    if (Test-Path $log) { Get-Content $log -Tail 40 | Write-Host }
    throw ("Dev server không khởi động được trên port {0}. Log: {1}" -f $Port, $log)
  }
  Add-Result ("Khởi động dev server port {0}" -f $Port) $true

  # 4) GET /api/auth/admin/config
  Write-Host "`n>> Test API auth..." -ForegroundColor Cyan
  try {
    $configRes = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/admin/config" -TimeoutSec 20
    $config = $configRes.Content | ConvertFrom-Json
    Assert-True ($configRes.StatusCode -eq 200) 'HTTP status phải là 200'
    Assert-True ($config.configured -eq $true) 'configured phải là true'
    Assert-True ($config.client_id -eq $env:GOOGLE_OAUTH_CLIENT_ID) 'client_id trả về không khớp'
    Assert-True ($config.allow_local_login -eq $true) 'allow_local_login phải là true trên local'
    Add-Result 'GET /api/auth/admin/config' $true
  } catch {
    Add-Result 'GET /api/auth/admin/config' $false $_.Exception.Message
    throw
  }

  # 5) Đăng nhập local + cookie HttpOnly
  try {
    $loginRes = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/admin/login" -Method Post `
      -ContentType 'application/json' -Body '{"email":"quanlhk.01@gmail.com"}' -SessionVariable adminSession -TimeoutSec 20
    $login = $loginRes.Content | ConvertFrom-Json
    $cookieHeader = ($loginRes.Headers['Set-Cookie'] -join ';')
    Assert-True ($loginRes.StatusCode -eq 200) 'HTTP status phải là 200'
    Assert-True ($login.authenticated -eq $true) 'authenticated phải là true'
    Assert-True ($login.admin.email -eq 'quanlhk.01@gmail.com') 'email admin không đúng'
    Assert-True ($cookieHeader -match 'sr_admin_session=') 'thiếu cookie sr_admin_session'
    Assert-True ($cookieHeader -match 'HttpOnly') 'cookie phải có HttpOnly'
    Add-Result 'POST /api/auth/admin/login (local admin)' $true
  } catch {
    Add-Result 'POST /api/auth/admin/login (local admin)' $false $_.Exception.Message
    throw
  }

  # 6) Session admin
  try {
    $sessionRes = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/admin/session" -WebSession $adminSession -TimeoutSec 20
    $session = $sessionRes.Content | ConvertFrom-Json
    Assert-True ($sessionRes.StatusCode -eq 200) 'HTTP status phải là 200'
    Assert-True ($session.authenticated -eq $true) 'session phải authenticated'
    Assert-True ($session.admin.email -eq 'quanlhk.01@gmail.com') 'session trả về sai email'
    Add-Result 'GET /api/auth/admin/session (có cookie)' $true
  } catch {
    Add-Result 'GET /api/auth/admin/session (có cookie)' $false $_.Exception.Message
    throw
  }

  # 7) Admin API được bảo vệ
  try {
    $overviewRes = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/admin/overview" -WebSession $adminSession -TimeoutSec 20
    $overview = $overviewRes.Content | ConvertFrom-Json
    Assert-True ($overviewRes.StatusCode -eq 200) 'HTTP status phải là 200'
    Assert-True ($null -ne $overview.totals) 'overview thiếu totals'
    Add-Result 'GET /api/admin/overview (có quyền)' $true
  } catch {
    Add-Result 'GET /api/admin/overview (có quyền)' $false $_.Exception.Message
    throw
  }

  # 8) Không có cookie phải bị 401
  try {
    $unauth = Invoke-ExpectError -Method 'Get' -Path '/api/admin/overview'
    Assert-True ($unauth.Status -eq 401) ("mong đợi 401, nhận được {0}" -f $unauth.Status)
    Add-Result 'GET /api/admin/overview (không cookie) -> 401' $true
  } catch {
    Add-Result 'GET /api/admin/overview (không cookie) -> 401' $false $_.Exception.Message
    throw
  }

  # 9) Email ngoài allowlist phải bị 403
  try {
    $bad = Invoke-ExpectError -Method 'Post' -Path '/api/auth/admin/login' -Body '{"email":"intruder@gmail.com"}'
    $badJson = $bad.Body | ConvertFrom-Json
    Assert-True ($bad.Status -eq 403) ("mong đợi 403, nhận được {0}" -f $bad.Status)
    Assert-True ($badJson.error.code -eq 'ADMIN_NOT_ALLOWED') 'mã lỗi phải là ADMIN_NOT_ALLOWED'
    Add-Result 'POST login email ngoài allowlist -> 403' $true
  } catch {
    Add-Result 'POST login email ngoài allowlist -> 403' $false $_.Exception.Message
    throw
  }

  # 10) Google ID Token rác phải bị từ chối
  try {
    $fake = Invoke-ExpectError -Method 'Post' -Path '/api/auth/admin/login' -Body '{"id_token":"not.a.jwt"}'
    $fakeJson = $fake.Body | ConvertFrom-Json
    Assert-True ($fake.Status -eq 401) ("mong đợi 401, nhận được {0}" -f $fake.Status)
    Assert-True ($fakeJson.error.code -eq 'INVALID_GOOGLE_TOKEN') 'mã lỗi phải là INVALID_GOOGLE_TOKEN'
    Add-Result 'POST login Google token rác -> 401' $true
  } catch {
    Add-Result 'POST login Google token rác -> 401' $false $_.Exception.Message
    throw
  }

  # 11) Dừng server trước khi build
  Stop-TestServer
  Add-Result 'Dừng dev server' $true

  Restore-Env 'GOOGLE_OAUTH_CLIENT_ID' $oldClientId
  Restore-Env 'ADMIN_SESSION_SECRET' $oldSecret
  Restore-Env 'ALLOW_LOCAL_ADMIN_LOGIN' $oldAllowLocal

  # 12) Production build
  if ($SkipBuild) {
    Write-Host "`n>> Bỏ qua build theo tham số -SkipBuild" -ForegroundColor Yellow
  } else {
    Invoke-NpmStep 'npm run build' @('run', 'build')
  }
} catch {
  Write-Host ("`n>>> LỖI: {0}" -f $_.Exception.Message) -ForegroundColor Red
  Add-Result 'Tổng thể' $false $_.Exception.Message
  $exitCode = 1
} finally {
  Stop-TestServer
  Restore-Env 'GOOGLE_OAUTH_CLIENT_ID' $oldClientId
  Restore-Env 'ADMIN_SESSION_SECRET' $oldSecret
  Restore-Env 'ALLOW_LOCAL_ADMIN_LOGIN' $oldAllowLocal
}

Write-Host "`n==================================================" -ForegroundColor Cyan
$pass = @($script:results | Where-Object { $_.Ok }).Count
$fail = @($script:results | Where-Object { -not $_.Ok }).Count
if ($fail -eq 0 -and $exitCode -eq 0) {
  Write-Host (" KẾT QUẢ: {0} PASS / 0 FAIL - TẤT CẢ ĐỀU ĐẠT" -f $pass) -ForegroundColor Green
} else {
  Write-Host (" KẾT QUẢ: {0} PASS / {1} FAIL" -f $pass, $fail) -ForegroundColor Red
}
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Lưu ý: test dùng Client ID giả để kiểm tra server." -ForegroundColor Yellow
Write-Host " Đăng nhập Google thật cần GOOGLE_OAUTH_CLIENT_ID thật" -ForegroundColor Yellow
Write-Host " + Authorized JavaScript origins trên Google Cloud Console." -ForegroundColor Yellow
Write-Host (" Log server: {0}" -f $log) -ForegroundColor DarkGray

exit $exitCode
