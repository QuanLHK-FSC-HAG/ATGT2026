'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

type AdminTab =
  | 'overview'
  | 'filters'
  | 'participants'
  | 'research'
  | 'scenarios'
  | 'logs'
  | 'ai'
  | 'health';

interface AdminUser {
  email: string;
  name: string;
  picture?: string | null;
  auth_method?: string;
}

interface AuthConfig {
  configured: boolean;
  client_id: string | null;
  allow_local_login: boolean;
}

interface OverviewData {
  storage_mode: string;
  is_demo_data: boolean;
  demo_label: string | null;
  totals: {
    participants: number;
    study_runs: number;
    sessions: number;
    attempts: number;
    pre_completed: number;
    post_completed: number;
    paired_completed: number;
    event_batches: number;
  };
  updated_at: string;
}

interface ParticipantRow {
  participant_id: string;
  school_name: string;
  class_name: string;
  province_city: string;
  created_at: string;
  status: string;
}

interface SheetsData {
  source: string;
  sheet_id: string | null;
  updated_at: string;
  sheets: Record<string, string[][]>;
  counts: Record<string, number>;
  sheet_sources: Record<string, 'GOOGLE_SHEETS' | 'LOCAL_SNAPSHOT' | 'LOCAL_SEED'>;
}

const VISIBLE_SHEET_LABELS = [
  { key: 'hoc_sinh', label: 'hoc_sinh' },
  { key: 'phien_choi', label: 'phien_choi' },
  { key: 'luot_xu_ly', label: 'luot_xu_ly' },
  { key: 'su_kien_hanh_vi', label: 'su_kien_hanh_vi' },
  { key: 'nhat_ky_ai', label: 'nhat_ky_ai' },
  { key: 'so_sanh_truoc_sau', label: 'so_sanh_truoc_sau' },
  { key: 'kich_ban_goc', label: 'kich_ban_goc' },
] as const;

interface SheetColumn {
  index: number;
  label: string;
}

function isTechnicalId(header: string): boolean {
  return /^(ma_|id$|.*_id$|uuid|key|hash|checksum|session|participant|study_run)/i.test(header.trim());
}

function displayCell(raw: string): string {
  const value = raw ?? '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
  }
  return value.length > 140 ? `${value.slice(0, 137)}…` : value;
}

function SheetTable({
  rows,
  emptyText,
  maxHeight = 520,
  columns,
}: {
  rows: string[][];
  emptyText: string;
  maxHeight?: number;
  columns?: SheetColumn[];
}) {
  if (!rows.length) {
    return <div className="notice" style={{ background: '#f8fafc', color: '#64748b', marginTop: '12px' }}>{emptyText}</div>;
  }
  const [header, ...body] = rows;
  const visible = columns && columns.length
    ? columns
    : header
        .map((title, index) => ({ index, label: title.replace(/_/g, ' ') }))
        .filter(column => !isTechnicalId(header[column.index] || ''));
  const active = visible.length ? visible : header.map((title, index) => ({ index, label: title.replace(/_/g, ' ') }));

  return (
    <div style={{ overflow: 'auto', maxHeight, marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr style={{ background: '#eef6ff', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: '9px 10px', color: '#64748b', width: 36 }}>STT</th>
            {active.map(column => (
              <th key={column.index} style={{ padding: '9px 12px', color: '#1e3a5f', fontWeight: 700 }}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ borderBottom: '1px solid #e2e8f0', background: rowIndex % 2 ? '#fafcff' : '#ffffff' }}>
              <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{rowIndex + 1}</td>
              {active.map(column => (
                <td key={column.index} style={{ padding: '8px 12px', color: '#475569' }}>{displayCell(row[column.index] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (res: { access_token?: string; error?: unknown }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedGrade, setSelectedGrade] = useState<string>('Tất cả');
  const [selectedSchool, setSelectedSchool] = useState<string>('Tất cả');

  // Auth State
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [googleClientReady, setGoogleClientReady] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [localEmail, setLocalEmail] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Live Google Sheets & System Data
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [resultsData, setResultsData] = useState<{ total_attempts: number; total_assessments: number } | null>(null);
  const [systemHealth, setSystemHealth] = useState<Record<string, unknown> | null>(null);
  const [sheetsData, setSheetsData] = useState<SheetsData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: '1. Tổng quan & Biểu đồ' },
    { id: 'filters', label: '2. Bộ lọc dữ liệu' },
    { id: 'participants', label: '3. Danh sách học sinh' },
    { id: 'research', label: '4. So sánh Trước & Sau học' },
    { id: 'scenarios', label: '5. Kho 160 Kịch bản' },
    { id: 'logs', label: '6. Sự kiện hành vi' },
    { id: 'ai', label: '7. Nhật ký phản hồi AI' },
    { id: 'health', label: '8. Trạng thái hệ thống' },
  ];

  // 1. Kiểm tra session admin hiện có + tải cấu hình Google OAuth công khai
  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        const [sessionRes, configRes] = await Promise.all([
          fetch('/api/auth/admin/session', { cache: 'no-store' }),
          fetch('/api/auth/admin/config', { cache: 'no-store' }),
        ]);

        if (!cancelled && sessionRes.ok) {
          const data = await sessionRes.json();
          if (data.authenticated && data.admin) setCurrentUser(data.admin);
        }

        if (!cancelled && configRes.ok) {
          const cfg = (await configRes.json()) as AuthConfig;
          setAuthConfig(cfg);
        } else if (!cancelled) {
          setConfigError('Không tải được cấu hình đăng nhập Google từ máy chủ.');
        }
      } catch {
        if (!cancelled) setConfigError('Không kết nối được máy chủ để kiểm tra đăng nhập.');
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    }

    bootstrapAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitLogin(payload: { id_token?: string; access_token?: string; email?: string }) {
    setLoginBusy(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || 'Tài khoản Google không được cấp quyền');
      }
      if (!data?.authenticated || !data?.admin) {
        throw new Error('Máy chủ không trả về phiên quản trị hợp lệ.');
      }
      setCurrentUser(data.admin);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoginBusy(false);
    }
  }

  // 2. Tải dữ liệu dashboard khi đã đăng nhập
  useEffect(() => {
    if (!currentUser) return;

    async function fetchDashboardData() {
      setLoadingData(true);
      try {
        const [ovRes, ptRes, ssRes, rsRes, hlRes, shRes] = await Promise.allSettled([
          fetch('/api/admin/overview').then(r => r.ok ? r.json() : null),
          fetch('/api/admin/participants').then(r => r.ok ? r.json() : null),
          fetch('/api/admin/sessions').then(r => r.ok ? r.json() : null),
          fetch('/api/admin/results').then(r => r.ok ? r.json() : null),
          fetch('/api/admin/system-health').then(r => r.ok ? r.json() : null),
          fetch('/api/admin/sheets', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
        ]);

        if (ovRes.status === 'fulfilled' && ovRes.value) setOverview(ovRes.value);
        if (ptRes.status === 'fulfilled' && ptRes.value?.participants) setParticipants(ptRes.value.participants);
        if (ssRes.status === 'fulfilled' && ssRes.value?.total) setSessionsCount(ssRes.value.total);
        if (rsRes.status === 'fulfilled' && rsRes.value) setResultsData(rsRes.value);
        if (hlRes.status === 'fulfilled' && hlRes.value) setSystemHealth(hlRes.value);
        if (shRes.status === 'fulfilled' && shRes.value?.sheets) setSheetsData(shRes.value);
      } catch (err) {
        console.error('Lỗi tải dữ liệu dashboard:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchDashboardData();
  }, [currentUser]);

  // 3. Khởi tạo Google Identity Services Button
  useEffect(() => {
    if (
      currentUser ||
      !googleClientReady ||
      !authConfig?.configured ||
      !authConfig.client_id ||
      !window.google?.accounts?.id ||
      !googleBtnContainerRef.current
    ) {
      return;
    }

    const container = googleBtnContainerRef.current;
    let renderCheckTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      window.google.accounts.id.initialize({
        client_id: authConfig.client_id,
        callback: (response) => {
          if (!response.credential) {
            setLoginError('Google không trả về ID Token. Vui lòng đóng cửa sổ và thử đăng nhập lại.');
            return;
          }
          void submitLogin({ id_token: response.credential });
        },
      });

      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
      });

      // Nếu GIS bị chặn hoặc Client ID/origin sai, nút sẽ không được render.
      renderCheckTimer = setTimeout(() => {
        if (container.childElementCount === 0) {
          setLoginError(prev => prev || 'Không hiển thị được nút Google. Kiểm tra "Authorized JavaScript origins" của OAuth Client ID và đúng tên miền đang truy cập.');
        }
      }, 6000);
    } catch (err) {
      console.warn('Google Identity button init:', err);
      setLoginError(
        'Không khởi tạo được Google Sign-In: ' +
          (err instanceof Error ? err.message : 'lỗi không xác định') +
          '. Kiểm tra GOOGLE_OAUTH_CLIENT_ID và Authorized JavaScript origins.',
      );
    }

    return () => {
      if (renderCheckTimer) clearTimeout(renderCheckTimer);
    };
  }, [currentUser, googleClientReady, authConfig]);

  // Đăng xuất
  async function handleLogout() {
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
      setCurrentUser(null);
    } catch (err) {
      console.error(err);
    }
  }

  // Đang kiểm tra phiên
  if (checkingAuth) {
    return (
      <main style={{ maxWidth: '600px', margin: '80px auto', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '16px' }}>Đang kiểm tra quyền quản trị viên SafeRide...</p>
      </main>
    );
  }

  // MÀN HÌNH ĐĂNG NHẬP TRỰC TIẾP TÀI KHOẢN GOOGLE KHI CHƯA XÁC THỰC
  if (!currentUser) {
    return (
      <main style={{ maxWidth: '540px', margin: '60px auto', padding: '32px 24px' }}>
        {authConfig?.configured && (
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onLoad={() => setGoogleClientReady(true)}
            onError={() =>
              setLoginError('Không tải được thư viện Google Sign-In. Kiểm tra kết nối mạng, trình chặn quảng cáo hoặc chính sách CSP.')
            }
          />
        )}

        <div style={{ marginBottom: '20px' }}>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
            ← Quay lại Trang Trải Nghiệm Học Sinh
          </Link>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '16px',
          padding: '36px 28px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '42px', display: 'inline-block', marginBottom: '10px' }}>🛡️</span>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
            Cổng Quản Trị Viên SafeRide EDU AI
          </h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '0 0 24px', lineHeight: 1.5 }}>
            Bắt buộc đăng nhập trực tiếp bằng <strong>Tài khoản Google chính chủ</strong>. Hệ thống chỉ cấp quyền cho Quản trị viên trong danh sách ủy quyền:
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '24px', textAlign: 'left', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: '6px' }}>2 Quản trị viên được cấp quyền:</div>
            <div style={{ color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>• Lê Hữu Kỳ Quan (quanlhk.01@gmail.com)</div>
            <div style={{ color: '#0369a1', fontWeight: 600 }}>• Mai Trọng Hữu (maitronghuu@gmail.com)</div>
          </div>

          {!authConfig && !configError && (
            <div style={{ fontSize: '13px', color: '#64748b' }}>Đang tải cấu hình đăng nhập…</div>
          )}

          {authConfig && !authConfig.configured && (
            <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', fontSize: '13px', textAlign: 'left', lineHeight: 1.6 }}>
              <strong>Chưa cấu hình Google OAuth Client ID.</strong>
              <br />
              Thêm biến môi trường <code>GOOGLE_OAUTH_CLIENT_ID</code> (hoặc <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>) rồi khởi động lại máy chủ.
              <br />
              Trên Google Cloud Console → OAuth Client (Web application), thêm Authorized JavaScript origins:
              <br />
              <code>http://localhost:3000</code> và tên miền triển khai (ví dụ <code>https://your-app.vercel.app</code>).
            </div>
          )}

          {/* Vùng Render Nút Đăng nhập Chuẩn của Google SDK */}
          {authConfig?.configured && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '50px', justifyContent: 'center' }}>
              <div ref={googleBtnContainerRef} style={{ display: 'inline-block' }} />
              {!googleClientReady && (
                <div style={{ fontSize: '13px', color: '#64748b' }}>Đang kết nối thư viện Google OAuth an toàn…</div>
              )}
            </div>
          )}

          {authConfig?.allow_local_login && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0', textAlign: 'left' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569', marginBottom: '10px', textAlign: 'center' }}>
                Hoặc đăng nhập nhanh trên máy local (chỉ dùng khi phát triển)
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const email = localEmail.trim();
                  if (email) void submitLogin({ email });
                }}
                style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
              >
                <input
                  type="email"
                  value={localEmail}
                  onChange={(event) => setLocalEmail(event.target.value)}
                  placeholder="Email quản trị viên"
                  autoComplete="email"
                  style={{ flex: '1 1 220px', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={loginBusy || !localEmail.trim()}
                  style={{ padding: '9px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: loginBusy ? 'wait' : 'pointer' }}
                >
                  Đăng nhập local
                </button>
              </form>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['quanlhk.01@gmail.com', 'maitronghuu@gmail.com'].map(email => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => {
                      setLocalEmail(email);
                      void submitLogin({ email });
                    }}
                    disabled={loginBusy}
                    style={{ padding: '6px 10px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {email}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loginBusy && (
            <div style={{ marginTop: '16px', color: '#2563eb', fontSize: '13.5px', fontWeight: 600 }}>
              Đang xác minh chữ ký Google OAuth…
            </div>
          )}

          {loginError && (
            <div style={{ marginTop: '20px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '13px', textAlign: 'left' }}>
              <strong>Lỗi xác thực:</strong> {loginError}
            </div>
          )}

          {configError && (
            <div style={{ marginTop: '16px', fontSize: '12.5px', color: '#b45309' }}>{configError}</div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8' }}>
            Đồng bộ bảo mật trực tuyến với Google Sheets ID: <code>1cb1yNL0GlzktDg-88G-Q-POqCqPHnencAF5O-nC20J8</code>.
          </div>
        </div>
      </main>
    );
  }

  // MÀN HÌNH DASHBOARD KHI ĐÃ ĐĂNG NHẬP THÀNH CÔNG
  const isGoogleSource = sheetsData?.source === 'GOOGLE_SHEETS';
  const liveCounts = isGoogleSource ? sheetsData.counts : undefined;
  const participantCount = liveCounts?.hoc_sinh ?? overview?.totals.participants ?? participants.length;
  const sessionCount = liveCounts?.phien_choi ?? overview?.totals.sessions ?? sessionsCount;
  const pairedCount = liveCounts?.so_sanh_truoc_sau ?? overview?.totals.paired_completed ?? 0;
  const attemptCount = liveCounts?.luot_xu_ly ?? overview?.totals.attempts ?? resultsData?.total_attempts ?? 0;
  const metricSourceLabel = isGoogleSource ? 'Đồng bộ từ Sheet' : 'Tổng hợp từ snapshot cục bộ';
  const scenarioRows = sheetsData?.sheets.kich_ban_goc ?? [];
  const scenarioCount = sheetsData?.counts.kich_ban_goc ?? 160;
  const scenarioSource = sheetsData?.sheet_sources?.kich_ban_goc;

  return (
    <main className="reading-page" style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      {/* Header Quản trị */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <Link href="/" className="back-link">← Trở về Trang Học Sinh</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: '#065f46', color: '#6ee7b7', padding: '5px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
            🟢 {currentUser.auth_method === 'google_oidc' ? 'ĐÃ XÁC THỰC GOOGLE ADMIN' : 'ĐÃ XÁC THỰC ADMIN LOCAL'}: {currentUser.name} ({currentUser.email})
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Đăng xuất ⎋
          </button>
        </div>
      </div>

      <h1>Bảng Điều Khiển Quản Trị SafeRide EDU AI 2026</h1>
      <p style={{ color: '#475569', marginBottom: '20px' }}>
        {sheetsData?.source === 'GOOGLE_SHEETS' ? (
          <>Đang đồng bộ trực tuyến với Google Sheets ID: <code>{sheetsData.sheet_id}</code> (Thư mục Google Drive: <code>ATGT2026</code>).</>
        ) : (
          <>Đang sử dụng snapshot cục bộ trên máy này; chưa đồng bộ Google Sheets/Drive.</>
        )}
        {loadingData ? ' (Đang cập nhật số liệu mới nhất…)' : ` Nguồn dữ liệu: ${sheetsData?.source === 'GOOGLE_SHEETS' ? 'Google Sheets Live' : 'Snapshot cục bộ'} · cập nhật lúc ${sheetsData ? new Date(sheetsData.updated_at).toLocaleTimeString('vi-VN') : '—'}.`}
      </p>

      {/* 4 Thẻ Chỉ số Nổi bật trích xuất từ Sheets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Tổng học sinh tham gia</span>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
            {participantCount}
          </div>
          <span style={{ fontSize: '12px', color: '#16a34a' }}>{metricSourceLabel} {isGoogleSource && <code>hoc_sinh</code>}</span>
        </div>

        <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '12px', padding: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Phiên trải nghiệm</span>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#1d4ed8', marginTop: '4px' }}>
            {sessionCount}
          </div>
          <span style={{ fontSize: '12px', color: '#2563eb' }}>{metricSourceLabel} {isGoogleSource && <code>phien_choi</code>}</span>
        </div>

        <div style={{ background: '#fefce8', border: '1.5px solid #fde047', borderRadius: '12px', padding: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>Hoàn thành Cặp Chặng</span>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#a16207', marginTop: '4px' }}>
            {pairedCount}
          </div>
          <span style={{ fontSize: '12px', color: '#ca8a04' }}>{metricSourceLabel} {isGoogleSource && <code>so_sanh_truoc_sau</code>}</span>
        </div>

        <div style={{ background: '#fdf2f8', border: '1.5px solid #f472b6', borderRadius: '12px', padding: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#9d174d', textTransform: 'uppercase' }}>Lượt xử lý tình huống</span>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#be185d', marginTop: '4px' }}>
            {attemptCount}
          </div>
          <span style={{ fontSize: '12px', color: '#db2777' }}>{metricSourceLabel} {isGoogleSource && <code>luot_xu_ly</code>}</span>
        </div>
      </div>

      <nav aria-label="Menu Quản trị 8 màn hình" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTab === t.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: activeTab === t.id ? '#eff6ff' : '#ffffff',
              color: activeTab === t.id ? '#1d4ed8' : '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <section aria-labelledby="heading-overview">
          <h2 id="heading-overview">1. Tổng quan Hệ thống & Biểu đồ Thống kê (bieu_do_thong_ke)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="notice"><strong>Tổng số Kịch bản:</strong> 160 tình huống (8 chủ đề × 20)</div>
            <div className="notice"><strong>Cấu trúc 8 Sheet không dấu:</strong> <code>bieu_do_thong_ke</code>, <code>hoc_sinh</code>, <code>phien_choi</code>, <code>luot_xu_ly</code>, <code>su_kien_hanh_vi</code>, <code>nhat_ky_ai</code>, <code>so_sanh_truoc_sau</code>, <code>kich_ban_goc</code></div>
            <div className="notice"><strong>Cơ chế Cấp độ chơi:</strong> Học sinh chọn cấp độ (Cơ bản / Nâng cao / Thử thách) theo từng lượt chơi tại <code>phien_choi</code></div>
            <div className="notice"><strong>Chế độ kết nối:</strong> {overview?.storage_mode === 'GOOGLE' ? 'Google Sheets Live' : 'Kho dữ liệu cục bộ'}</div>
            <div className="notice" style={{ gridColumn: '1 / -1' }}>
              <strong>{isGoogleSource ? 'Số dòng đọc từ Google Sheets' : 'Số bản ghi trong kho cục bộ'}:</strong>{' '}
              {sheetsData ? VISIBLE_SHEET_LABELS.map(({ key, label }) => `${label}: ${key === 'kich_ban_goc' ? scenarioCount : sheetsData.counts[key] ?? 0}`).join(' · ') : 'Đang tải…'}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'filters' && (
        <section aria-labelledby="heading-filters">
          <h2 id="heading-filters">2. Bộ lọc Đa chiều</h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <label>
              Khối lớp:{' '}
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="Tất cả">Tất cả (THCS & THPT)</option>
                <option value="THCS">Khối THCS</option>
                <option value="THPT">Khối THPT</option>
              </select>
            </label>
            <label>
              Trường học:{' '}
              <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}>
                <option value="Tất cả">Tất cả các trường học sinh tham gia</option>
                {Array.from(new Set(participants.map(p => p.school_name).filter(Boolean))).map(sch => (
                  <option key={sch} value={sch}>{sch}</option>
                ))}
              </select>
            </label>
          </div>
          <p>Đang lọc theo: Khối <strong>{selectedGrade}</strong> • Trường <strong>{selectedSchool}</strong></p>
        </section>
      )}

      {activeTab === 'participants' && (
        <section aria-labelledby="heading-participants">
          <h2 id="heading-participants">3. Danh sách Học sinh Tham gia Trực tiếp (Bảng hoc_sinh)</h2>
          <p style={{ color: '#475569' }}>{isGoogleSource ? 'Dữ liệu ghi nhận trực tuyến theo thời gian thực khi học sinh tham gia.' : 'Dữ liệu được ghi vào snapshot cục bộ trên máy này.'}</p>
          {sheetsData?.sheets.hoc_sinh?.length ? (
            <SheetTable rows={sheetsData.sheets.hoc_sinh} emptyText="Chưa có học sinh trong Sheet hoc_sinh." />
          ) : participants.length === 0 ? (
            <div className="notice" style={{ background: '#f8fafc', color: '#64748b' }}>
              Chưa có học sinh mới thực hiện bài học trong phiên này. Dữ liệu sẽ tự động xuất hiện tại đây khi học sinh làm bài tập 3D.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px' }}>Mã Học Sinh</th>
                    <th style={{ padding: '10px 12px' }}>Trường Học</th>
                    <th style={{ padding: '10px 12px' }}>Lớp</th>
                    <th style={{ padding: '10px 12px' }}>Tỉnh / Thành phố</th>
                    <th style={{ padding: '10px 12px' }}>Thời gian ghi nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.participant_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.participant_id.slice(0, 8)}…</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.school_name}</td>
                      <td style={{ padding: '10px 12px' }}>{p.class_name}</td>
                      <td style={{ padding: '10px 12px' }}>{p.province_city}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(p.created_at).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'research' && (
        <section aria-labelledby="heading-research">
          <h2 id="heading-research">4. So sánh Kết quả Trước & Sau khi học (Bảng so_sanh_truoc_sau)</h2>
          <p>Tự động đối chiếu điểm số chặng Trước khi học (PRE), Luyện tập (TRAINING) và Đánh giá sau học (POST) theo từng phiên chơi. {isGoogleSource ? <>Nguồn trực tuyến: Google Sheets ID <code>{sheetsData?.sheet_id}</code>.</> : 'Nguồn hiện tại: snapshot cục bộ.'}</p>
          <div className="notice" style={{ marginTop: '12px' }}>
            Tổng số bản ghi đánh giá hoàn tất: <strong>{pairedCount}</strong> cặp mẫu (Sheet <code>so_sanh_truoc_sau</code>).
          </div>
          <SheetTable rows={sheetsData?.sheets.so_sanh_truoc_sau ?? []} emptyText="Chưa có bản ghi so sánh trước/sau trong Google Sheets." />
        </section>
      )}

      {activeTab === 'scenarios' && (
        <section aria-labelledby="heading-scenarios">
          <h2 id="heading-scenarios">5. Kho 160 Kịch bản An toàn Giao thông (Bảng kich_ban_goc)</h2>
          <p>
            Bao gồm {scenarioCount} tình huống giao thông học đường Việt Nam thực tế, phân bố đều cho cấp THCS và THPT (8 chủ đề kỹ năng × 20 kịch bản).
            {scenarioSource === 'GOOGLE_SHEETS'
              ? ' Dữ liệu được tải trực tiếp từ Google Sheets.'
              : ' Đang dùng kho 160 kịch bản tích hợp trong ứng dụng vì Sheet chưa có dữ liệu hoặc đang chạy local.'}
          </p>
          <SheetTable rows={scenarioRows} emptyText="Kho kịch bản chưa sẵn sàng." maxHeight={640} />
        </section>
      )}

      {activeTab === 'logs' && (
        <section aria-labelledby="heading-logs">
          <h2 id="heading-logs">6. Nhật ký Sự kiện Hành vi 3D (Bảng su_kien_hanh_vi)</h2>
          <p>Ghi nhận thao tác phanh, bật xi-nhan, nhường đường và thời gian phản xạ trong không gian mô phỏng 3D theo từng mili-giây. Hiện có <strong>{liveCounts?.su_kien_hanh_vi ?? 0}</strong> sự kiện trong Sheet.</p>
          <SheetTable rows={sheetsData?.sheets.su_kien_hanh_vi ?? []} emptyText="Chưa có sự kiện hành vi trong Google Sheets." />
        </section>
      )}

      {activeTab === 'ai' && (
        <section aria-labelledby="heading-ai">
          <h2 id="heading-ai">7. Nhật ký Phản hồi Sư phạm AI (Bảng nhat_ky_ai)</h2>
          <p>Toàn bộ thông tin cá nhân của học sinh được ẩn danh hoàn toàn trước khi tạo lời khuyên hướng dẫn luật giao thông đường bộ Việt Nam. Hiện có <strong>{liveCounts?.nhat_ky_ai ?? 0}</strong> bản ghi trong Sheet.</p>
          <SheetTable rows={sheetsData?.sheets.nhat_ky_ai ?? []} emptyText="Chưa có nhật ký AI trong Google Sheets." />
        </section>
      )}

      {activeTab === 'health' && (
        <section aria-labelledby="heading-health">
          <h2 id="heading-health">8. Trạng thái Hoạt động Hệ thống</h2>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>
            <div>Admin đăng nhập: {currentUser.name} ({currentUser.email})</div>
            <div>Google Sheets: {isGoogleSource ? sheetsData?.sheet_id : 'Chưa kết nối trong chế độ hiện tại'}</div>
            <div>Nguồn dữ liệu: {sheetsData?.source || 'Đang tải…'}</div>
            <div>Cập nhật dữ liệu lần cuối: {sheetsData ? new Date(sheetsData.updated_at).toLocaleString('vi-VN') : '—'}</div>
            <div>Trạng thái hệ thống: {String(systemHealth?.status || 'SẴN SÀNG HOẠT ĐỘNG')}</div>
          </div>
        </section>
      )}
    </main>
  );
}
