'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import ScenarioLibrary from '@/components/scenario-library';
import StudentLibrary from '@/components/admin/student-library';
import ResearchLibrary from '@/components/admin/research-library';
import type { AdminReadModel } from '@/lib/admin/read-model';

type AdminTab =
  | 'overview'
  | 'participants'
  | 'research'
  | 'scenarios';

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

interface SheetColumn {
  index: number;
  label: string;
}

function isTechnicalId(header: string): boolean {
  return /^(ma_|id$|.*_id$|uuid|key|hash|checksum|session|participant|study_run)/i.test(header.trim());
}

function sanitizeScenarioHtml(raw: string): string {
  const allowed = /^<\/?(?:div|span|strong|mark|br|small|em)(?:\s+class="(?:scenario-context-tag|scenario-rich-prompt|hazard-badge|legal-info|legal-ref-tag)")?\s*\/?\s*>$/i;
  return raw.split(/(<[^>]*>)/g).map(token => token.startsWith('<') ? (allowed.test(token) ? token : '') : token).join('');
}

function displayCell(raw: string, renderScenarioHtml = false): string | React.ReactNode {
  const value = raw ?? '';
  if (renderScenarioHtml && /<(div|span|strong|mark|br|small|em)\b/i.test(value)) {
    return <div className="scenario-table-preview" dangerouslySetInnerHTML={{ __html: sanitizeScenarioHtml(value) }} />;
  }
  // Date formatting
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return (
        <span style={{ whiteSpace: 'nowrap' }}>
          {date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      );
    }
  }

  // Outcome badges
  if (value === 'SAFE') return <span className="badge-tag badge-safe">An Toàn</span>;
  if (value === 'SUBOPTIMAL') return <span className="badge-tag badge-suboptimal">Cần Cải Thiện</span>;
  if (value === 'HAZARDOUS') return <span className="badge-tag badge-hazardous">Nguy Hiểm</span>;
  if (value === 'APPROVED') return <span className="badge-tag badge-safe">Đã Duyệt</span>;
  if (value === 'NEEDS_LEGAL_REVIEW') return <span className="badge-tag badge-suboptimal">Chờ Duyệt Pháp Lý</span>;

  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

function PagedTable({
  rows,
  emptyText,
  pageSize = 10,
  searchQuery = '',
  renderHtmlCells = false,
}: {
  rows: string[][];
  emptyText: string;
  pageSize?: number;
  searchQuery?: string;
  renderHtmlCells?: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(() => {
    if (!rows.length) return [];
    const [header, ...body] = rows;
    if (!searchQuery.trim()) return body;

    const q = searchQuery.toLowerCase().trim();
    return body.filter(row => row.some(cell => String(cell).toLowerCase().includes(q)));
  }, [rows, searchQuery]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const pageData = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (!rows.length) {
    return <div className="notice">{emptyText}</div>;
  }

  const [header] = rows;
  const visibleIndices = header
    .map((title, index) => ({ index, label: title.replace(/_/g, ' ') }))
    .filter(column => !isTechnicalId(header[column.index] || ''));

  return (
    <div style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', color: '#64748b', width: 40 }}>STT</th>
              {visibleIndices.map(col => (
                <th key={col.index} style={{ padding: '12px 12px', color: '#1e3a5f', fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                {visibleIndices.map(col => (
                  <td key={col.index} style={{ padding: '10px 12px', color: '#334155', fontWeight: 500 }}>
                    {displayCell(row[col.index] ?? '', renderHtmlCells)}
                  </td>
                ))}
              </tr>
            ))}
            {!pageData.length && (
              <tr>
                <td colSpan={visibleIndices.length + 1} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  Không tìm thấy kết quả phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>Hiển thị {pageData.length} / {filteredRows.length} bản ghi</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Trước
          </button>
          <span style={{ alignSelf: 'center', fontWeight: 800 }}>Trang {currentPage} / {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Sau
          </button>
        </div>
      </div>
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
      };
    };
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [dataSource, setDataSource] = useState<'current' | 'simulation'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('Tất cả');
  const [selectedSchool, setSelectedSchool] = useState('Tất cả');

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [googleClientReady, setGoogleClientReady] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [localEmail, setLocalEmail] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const [library, setLibrary] = useState<AdminReadModel | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [sheetsData, setSheetsData] = useState<SheetsData | null>(null);
  const [resultsData, setResultsData] = useState<{ total_attempts: number; total_assessments: number; assessments: Array<{ phase: 'PRE' | 'POST'; normalized_score: number }>; scenario_results: Array<{ outcome: string; rule_score: number; scenario_id: string }> } | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  // 1. Auth Bootstrap
  useEffect(() => {
    async function bootstrap() {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch('/api/auth/admin/session', { cache: 'no-store' }),
          fetch('/api/auth/admin/config', { cache: 'no-store' }),
        ]);
        if (sRes.ok) {
          const d = await sRes.json();
          if (d.authenticated && d.admin) setCurrentUser(d.admin);
        }
        if (cRes.ok) setAuthConfig(await cRes.json());
      } catch {} finally {
        setCheckingAuth(false);
      }
    }
    bootstrap();
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!currentUser) return;
    async function fetchData() {
      setLoadingData(true);
      try {
        const qs = dataSource === 'simulation' ? '?source=simulation' : '';
        const [ovRes, ptRes, shRes, rsRes, libRes] = await Promise.allSettled([
          fetch(`/api/admin/overview${qs}`).then(async r => r.ok ? r.json() : Promise.reject(new Error(`overview ${r.status}`))),
          fetch(`/api/admin/participants${qs}`).then(async r => r.ok ? r.json() : Promise.reject(new Error(`participants ${r.status}`))),
          fetch(`/api/admin/sheets${qs}`, { cache: 'no-store' }).then(async r => r.ok ? r.json() : Promise.reject(new Error(`sheets ${r.status}`))),
          fetch(`/api/admin/results${qs}`, { cache: 'no-store' }).then(async r => r.ok ? r.json() : Promise.reject(new Error(`results ${r.status}`))),
          fetch(`/api/admin/library${qs}`, { cache: 'no-store' }).then(async r => r.ok ? r.json() : Promise.reject(new Error(`library ${r.status}`))),
        ]);
        const failed = [ovRes, ptRes, shRes, rsRes, libRes].find(item => item.status === 'rejected');
        setDataError(failed && failed.status === 'rejected' ? failed.reason?.message || 'Không tải được dữ liệu' : '');
        if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
        if (ptRes.status === 'fulfilled') setParticipants(ptRes.value.participants || []);
        if (shRes.status === 'fulfilled') setSheetsData(shRes.value);
        if (rsRes.status === 'fulfilled') setResultsData(rsRes.value);
        if (libRes.status === 'fulfilled') setLibrary(libRes.value);
      } catch {} finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [currentUser, dataSource]);

  // Login handler
  async function submitLogin(payload: any) {
    setLoginBusy(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Đăng nhập thất bại');
      const d = await res.json();
      setCurrentUser(d.admin);
    } catch (e: any) {
      setLoginError(e.message);
    } finally {
      setLoginBusy(false);
    }
  }

  // School options from data
  const schools = useMemo(() => {
    const set = new Set(participants.map(p => p.school_name).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [participants]);

  if (checkingAuth) return <div className="admin-shell"><p>Đang xác thực quyền Admin...</p></div>;

  if (!currentUser) {
    return (
      <div className="admin-shell" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        {authConfig?.configured && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleClientReady(true)} />}
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', padding: 32, borderRadius: 24, border: '2px solid #e2e8f0', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 16px', width: 64, height: 64, fontSize: 32 }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>SafeRide Admin</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Cổng quản trị bảo mật dành cho Hội đồng nghiên cứu ATGT 2026.</p>

          {authConfig?.configured && (
            <div ref={googleBtnContainerRef} style={{ display: 'inline-block', marginBottom: 16 }} />
          )}

          {authConfig?.allow_local_login && (
            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 20, marginTop: 10 }}>
              <input
                type="email"
                placeholder="Email local..."
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                style={{ width: '100%', marginBottom: 8, padding: '10px 14px', borderRadius: 12, border: '1.5px solid #cbd5e1' }}
              />
              <button className="primary" onClick={() => submitLogin({ email: localEmail })} disabled={loginBusy}>Đăng nhập Local</button>
            </div>
          )}
          {loginError && <p style={{ color: '#ef4444', marginTop: 12, fontWeight: 700 }}>{loginError}</p>}
        </div>
      </div>
    );
  }

  const isGoogle = sheetsData?.source === 'GOOGLE_SHEETS';
  const totals = overview?.totals;
  const isSynthetic = overview?.is_demo_data === true;
  async function downloadExport(format: 'csv' | 'jsonl') {
    const query = new URLSearchParams({ format });
    if (dataSource === 'simulation') query.set('source', 'simulation');
    const response = await fetch(`/api/admin/exports?${query}`, { cache: 'no-store' });
    if (!response.ok) {
      setDataError(`Không thể xuất ${format.toUpperCase()} (${response.status})`);
      return;
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `saferide-export.${format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-shell">
      {/* 1. Header Navigation */}
      <header className="admin-header">
        <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: '#64748b' }}>← Trang học sinh</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="admin-status-badge">
            <span className="hud-pulse-dot" />
            {currentUser.auth_method === 'google_oidc' ? 'XÁC THỰC GOOGLE' : 'LOCAL ADMIN'} — {currentUser.name}
          </span>
          <button onClick={() => window.location.reload()} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 10, cursor: 'pointer' }}>🔄</button>
          <button onClick={async () => { await fetch('/api/auth/admin/logout', { method: 'POST' }); setCurrentUser(null); }} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Thoát</button>
        </div>
      </header>

      <label>Nguồn dữ liệu
        <select value={dataSource} disabled={loadingData} onChange={event => {
          setOverview(null); setParticipants([]); setSheetsData(null); setResultsData(null); setLibrary(null);
          setSearchQuery(''); setSelectedSchool('Tất cả'); setSelectedGrade('Tất cả');
          setDataSource(event.target.value as 'current' | 'simulation');
        }}>
          <option value="current">Kho hiện tại</option>
          <option value="simulation">Bộ dữ liệu kiểm thử — chỉ local</option>
        </select>
      </label>
      {isSynthetic && <details className="notice">
        <summary><strong>Dữ liệu kiểm thử local</strong></summary>
        <p>Mẫu FPT Hậu Giang dùng 70–80% sĩ số từng lớp từ danh sách người dùng cung cấp; các trường còn lại dùng học sinh tổng hợp. Không dùng dữ liệu này làm bằng chứng nghiên cứu hoặc xác nhận trường tham gia.</p>
      </details>}
      {dataError && <p role="alert" className="error-message">{dataError}</p>}
      {loadingData && <p role="status">Đang tải nguồn dữ liệu…</p>}
      {/* 2. Top KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card" style={{ borderLeft: '6px solid #22c55e' }}>
          <span className="kpi-label">Tổng học sinh</span>
          <div className="kpi-value">{totals?.participants || 0}</div>
          <span className="kpi-sub">Ghi nhận trong {isGoogle ? 'Sheets' : 'Local'}</span>
        </div>
        <div className="admin-kpi-card" style={{ borderLeft: '6px solid #3b82f6' }}>
          <span className="kpi-label">Phiên trải nghiệm</span>
          <div className="kpi-value">{totals?.sessions || 0}</div>
          <span className="kpi-sub">{totals?.study_runs || 0} đợt nghiên cứu</span>
        </div>
        <div className="admin-kpi-card" style={{ borderLeft: '6px solid #eab308' }}>
          <span className="kpi-label">Cặp đánh giá trước và sau học</span>
          <div className="kpi-value">{totals?.paired_completed || 0}</div>
          <span className="kpi-sub">{isSynthetic ? 'Cặp dữ liệu kiểm thử hợp lệ' : 'Mẫu nghiên cứu ghép cặp'}</span>
        </div>
        <div className="admin-kpi-card" style={{ borderLeft: '6px solid #ec4899' }}>
          <span className="kpi-label">Lượt xử lý 3D</span>
          <div className="kpi-value">{totals?.attempts || 0}</div>
          <span className="kpi-sub">Hành vi và phản xạ</span>
        </div>
      </div>

      {/* 3. Global Tabs Navigation */}
      <nav className="admin-nav-tabs">
        {(['overview', 'participants', 'research', 'scenarios'] as const).map(tab => (
          <button
            key={tab}
            className={`admin-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 Tổng quan'}
            {tab === 'participants' && '🎓 Học sinh'}
            {tab === 'research' && '📈 Nghiên cứu'}
            {tab === 'scenarios' && '📚 Kịch bản'}
          </button>
        ))}
      </nav>

      {/* 4. Main Content Area */}
      <div style={{ minHeight: '60vh' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            {(() => {
               const preAvg = library?.metrics.paired_pre_average ?? 0;
               const postAvg = library?.metrics.paired_post_average ?? 0;
              const improvement = postAvg - preAvg;
               const skills = (library?.metrics.skills ?? []).map(skill => ({
                 label: skill.label,
                 pre: Math.round(skill.pre_percent),
                 post: Math.round(skill.post_percent),
                 improvement: Math.round(skill.improvement),
               }));

              return (
                <>
                  <div className="admin-kpi-card">
                    <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>So sánh hiệu quả trước và sau học</h3>
                    {preAvg > 0 || postAvg > 0 ? (
                      <>
                        <div className="chart-bar-container">
                          <div className="chart-bar-row">
                            <span>Trước khi học</span>
                            <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: `${preAvg}%`, background: '#3b82f6' }} /></div>
                            <span style={{ color: '#3b82f6' }}>{preAvg.toFixed(1)}</span>
                          </div>
                          <div className="chart-bar-row">
                            <span>Sau khi học</span>
                            <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: `${postAvg}%`, background: '#22c55e' }} /></div>
                            <span style={{ color: '#22c55e' }}>{postAvg.toFixed(1)}</span>
                          </div>
                        </div>
                        <p className="notice" style={{ marginTop: 20 }}>
                          {improvement > 0
                            ? `${isSynthetic ? 'Dữ liệu kiểm thử' : 'Mẫu ghép cặp'} tăng trung bình +${improvement.toFixed(1)} điểm.`
                            : 'Chưa có sự thay đổi đáng kể về điểm số hoặc dữ liệu so sánh đang được cập nhật.'}
                        </p>
                      </>
                    ) : (
                      <p style={{ color: '#64748b', padding: '20px 0', textAlign: 'center' }}>Chưa có đủ cặp đánh giá trước và sau học.</p>
                    )}
                  </div>
                  <div className="admin-kpi-card">
                    <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>Hiệu quả An toàn theo Nhóm</h3>
                    {skills.length > 0 ? (
                      skills.map(sk => (
                        <div key={sk.label} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
                            <span>{sk.label}</span>
                            <span style={{ color: sk.improvement >= 0 ? '#15803d' : '#b91c1c' }}>{sk.improvement >= 0 ? '+' : ''}{sk.improvement} điểm</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr 34px', gap: 6, alignItems: 'center', fontSize: 11 }}>
                            <span>Trước</span><div className="chart-bar-track" style={{ height: 6 }}><div className="chart-bar-fill" style={{ width: `${sk.pre}%`, background: '#60a5fa' }} /></div><strong>{sk.pre}</strong>
                            <span>Sau</span><div className="chart-bar-track" style={{ height: 6 }}><div className="chart-bar-fill" style={{ width: `${sk.post}%`, background: '#22c55e' }} /></div><strong>{sk.post}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: '#64748b', padding: '20px 0', textAlign: 'center' }}>Chưa có dữ liệu xử lý tình huống.</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'scenarios' && (
          <>
            <div className="admin-filter-panel">
              <div className="admin-filter-group">🔍 <input type="text" placeholder="Tìm bài viết theo tiêu đề, kỹ năng..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: 280 }} /></div>
              <div className="admin-filter-group"><span>Khối:</span><select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}><option>Tất cả</option><option>THCS</option><option>THPT</option></select></div>
            </div>
            <ScenarioLibrary rows={sheetsData?.sheets.kich_ban_goc || []} query={searchQuery} grade={selectedGrade} />
          </>
        )}

        {activeTab === 'participants' && (library ? <StudentLibrary students={library.students} /> : <p role="status">Đang tải thư viện học sinh…</p>)}
        {activeTab === 'research' && (library ? <ResearchLibrary research={library.research} /> : <p role="status">Đang tải thư viện nghiên cứu…</p>)}
      </div>

      <footer style={{ marginTop: 40, textAlign: 'center', opacity: 0.6 }}>
        <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 16, margin: '0 auto 8px' }}>S</div>
        SafeRide EDU AI 2026
      </footer>
    </div>
  );
}
