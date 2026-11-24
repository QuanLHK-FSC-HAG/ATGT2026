param(
  [Parameter(Mandatory = $true)][string]$Snapshot,
  [Parameter(Mandatory = $true)][string]$Manifest,
  [string]$Roster = "data hs.xls"
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
$projectRoot = Split-Path -Parent $PSScriptRoot
$snapshotPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $Snapshot))
$manifestPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $Manifest))
$rosterPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $Roster))
$utf8 = [Text.UTF8Encoding]::new($false)

if (-not $snapshotPath.StartsWith($projectRoot) -or -not $manifestPath.StartsWith($projectRoot) -or -not $rosterPath.StartsWith($projectRoot)) {
  throw "PATH_OUTSIDE_PROJECT"
}

$catalogJson = & node --import tsx --input-type=module -e "import {SIMULATION_SCHOOLS,SIMULATION_SCHOOL_DISCLAIMER} from './lib/data/simulation-schools.ts'; console.log(JSON.stringify({schools:SIMULATION_SCHOOLS,disclaimer:SIMULATION_SCHOOL_DISCLAIMER}))"
if ($LASTEXITCODE -ne 0) { throw "CATALOG_EXPORT_FAILED" }
$catalogExport = $catalogJson | ConvertFrom-Json
$catalog = $catalogExport.schools
$fptMatches = @($catalog | Where-Object { $_.usesRealRoster -eq $true })
$fptSchool = $fptMatches[0]
$localSchools = @($catalog | Where-Object { $_.usesRealRoster -ne $true })
if ($fptMatches.Count -ne 1 -or $localSchools.Count -lt 1) { throw "INVALID_CATALOG" }

$classTargets = [ordered]@{
  "tin_hoc_6a" = @{ Class = "6A"; Count = 18 }
  "tin_hoc_7a" = @{ Class = "7A"; Count = 20 }
  "tin_hoc_8a" = @{ Class = "8A"; Count = 18 }
  "tin_hoc_10a" = @{ Class = "10A"; Count = 25 }
  "tin_hoc_11a" = @{ Class = "11A"; Count = 22 }
}

function Get-StableKey([string]$value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($utf8.GetBytes("saferide-fpt-sample:$value")))).Replace("-", "") }
  finally { $sha.Dispose() }
}

$excel = $null
$workbook = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($rosterPath, 0, $true)
  $selected = [Collections.Generic.List[object]]::new()
  foreach ($entry in $classTargets.GetEnumerator()) {
    $sheet = $workbook.Worksheets.Item($entry.Key)
    $rows = [Collections.Generic.List[object]]::new()
    # The legacy XLS has formatting through row 65536, so read only the roster area in bulk.
    $rosterValues = $sheet.Range("A1:D500").Value2
    for ($row = 7; $row -le 500; $row++) {
      $ordinal = $rosterValues[$row, 1]
      if ($ordinal -isnot [double] -and $ordinal -isnot [int]) { continue }
      $studentId = ([string]$rosterValues[$row, 2]).Trim()
      $family = ([string]$rosterValues[$row, 3]).Trim()
      $given = ([string]$rosterValues[$row, 4]).Trim()
      $fullName = (($family, $given) -join " ").Trim()
      if ([string]::IsNullOrWhiteSpace($studentId) -or [string]::IsNullOrWhiteSpace($fullName)) { throw "INVALID_ROSTER_ROW" }
      $rows.Add([pscustomobject]@{ Key = Get-StableKey $studentId; Name = $fullName; Class = $entry.Value.Class })
    }
    if ($rows.Count -lt $entry.Value.Count) { throw "ROSTER_CLASS_TOO_SMALL" }
    foreach ($student in ($rows | Sort-Object Key | Select-Object -First $entry.Value.Count)) { $selected.Add($student) }
  }
}
finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  if ($workbook) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
  if ($excel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
}

$snapshotData = Get-Content -LiteralPath $snapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifestData = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($snapshotData.Settings.synthetic -ne $true -or $manifestData.synthetic -ne $true) { throw "SYNTHETIC_DATA_REQUIRED" }
if ($snapshotData.Players.Count -ne $manifestData.students.Count -or $selected.Count -ge $manifestData.students.Count) { throw "COUNT_MISMATCH" }

$remaining = $manifestData.students.Count - $selected.Count
$assignmentJson = & node --import tsx --input-type=module -e "import {allocateSimulationSchools,gradeForSchool} from './lib/data/simulation-schools.ts'; const a=allocateSimulationSchools($remaining,'saferide-haugiang-2026'); const c=new Map(); console.log(JSON.stringify(a.map(s=>{const n=c.get(s.name)||0;c.set(s.name,n+1);return {name:s.name,locality:s.locality,grade:gradeForSchool(s,n)}})))"
if ($LASTEXITCODE -ne 0) { throw "ASSIGNMENT_EXPORT_FAILED" }
$assignments = $assignmentJson | ConvertFrom-Json
$playersById = @{}
foreach ($player in $snapshotData.Players) { $playersById[$player.participant_id] = $player }

for ($index = 0; $index -lt $manifestData.students.Count; $index++) {
  $student = $manifestData.students[$index]
  $player = $playersById[$student.participant_id]
  if (-not $player) { throw "PLAYER_NOT_FOUND" }
  if ($index -lt $selected.Count) {
    $rosterStudent = $selected[$index]
    $student.name = $rosterStudent.Name
    $student.school = $fptSchool.name
    $student.grade = $rosterStudent.Class
    $player.full_name = $rosterStudent.Name
    $player.school_name = $fptSchool.name
    $player.class_name = $rosterStudent.Class
    $player.province_city = $fptSchool.locality
  } else {
    $assignment = $assignments[$index - $selected.Count]
    $withinClass = ($index - $selected.Count) % 3 + 1
    $className = "$($assignment.grade)A$withinClass"
    $student.school = $assignment.name
    $student.grade = $className
    $player.school_name = $assignment.name
    $player.class_name = $className
    $player.province_city = $assignment.locality
  }
}

$source = "cantho.edu.vn school portals and fschool.fpt.edu.vn/hau-giang; local acceptance only"
$disclaimer = $catalogExport.disclaimer
$manifestData.school_source = $source
$manifestData.school_disclaimer = $disclaimer
$manifestData.schools = $catalog
$snapshotData.Settings.school_source = $source
$snapshotData.Settings.school_disclaimer = $disclaimer
$snapshotData.Settings | Add-Member -NotePropertyName fpt_roster_sample -NotePropertyValue "103/136; 70-80% per class; local only" -Force

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $snapshotPath -Destination "$snapshotPath.before-haugiang-$stamp.json"
Copy-Item -LiteralPath $manifestPath -Destination "$manifestPath.before-haugiang-$stamp.json"
[IO.File]::WriteAllText("$snapshotPath.next", ($snapshotData | ConvertTo-Json -Depth 100 -Compress), $utf8)
[IO.File]::WriteAllText("$manifestPath.next", ($manifestData | ConvertTo-Json -Depth 100 -Compress), $utf8)
Move-Item -LiteralPath "$snapshotPath.next" -Destination $snapshotPath -Force
Move-Item -LiteralPath "$manifestPath.next" -Destination $manifestPath -Force

& node --import tsx (Join-Path $PSScriptRoot "redistribute-simulation-times.mts") --snapshot $snapshotPath --manifest $manifestPath
if ($LASTEXITCODE -ne 0) { throw "TIME_REDISTRIBUTION_FAILED" }

$schoolCounts = $snapshotData.Players | Group-Object school_name | ForEach-Object { [pscustomobject]@{ school = $_.Name; students = $_.Count } }
[pscustomobject]@{
  total = $manifestData.students.Count
  fpt_sample = $selected.Count
  fpt_by_class = $selected | Group-Object Class | ForEach-Object { [pscustomobject]@{ class = $_.Name; students = $_.Count } }
  schools = $schoolCounts
} | ConvertTo-Json -Depth 5
