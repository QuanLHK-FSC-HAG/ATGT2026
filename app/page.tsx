'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { clearLocalParticipantSession, createSession, fetchAiFeedback, loadScenario, sendEvents, submitAttempt, type SessionInfo } from '@/components/api';
import World3D, { type CameraMode, type VehicleType } from '@/components/world-3d';
import { DEMO_PROVINCES } from '@/game/scenarios';
import type { AttemptResult, GameAction, Phase, Scenario } from '@/game/types';
import type { ParticipantInput } from '@/lib/types';
import ParticipationDashboard from '@/components/participation-dashboard';

const phases: Phase[] = ['PRE', 'TRAINING', 'POST'];
const phaseNames: Record<Phase, string> = {
  PRE: 'Chặng 1: Trước khi học',
  TRAINING: 'Chặng 2: Luyện tập tình huống',
  POST: 'Chặng 3: Đánh giá sau học',
};

type ExperienceMode = 'CITY_3D' | 'ARENA_CHALLENGE' | 'SAFE_JOURNEY';
type DifficultyLevel = 'CO_BAN' | 'NANG_CAO' | 'THU_THACH';
type Screen = 'welcome' | 'instructions' | 'play' | 'results';

const blank: ParticipantInput = {
  full_name: '',
  class_name: '',
  school_name: '',
  province_city: 'TP Cần Thơ',
  privacy_notice_accepted: false,
  privacy_notice_version: '2026-01',
};


const LEVEL_INFO: Record<DifficultyLevel, { label: string; desc: string; badge: string; color: string }> = {
  CO_BAN: {
    label: 'Cấp độ 1: Cơ bản',
    desc: 'Làm quen biển báo trường học, vạch kẻ qua đường và kỹ năng quan sát hai chiều.',
    badge: '🌱 Nhập môn an toàn',
    color: '#58cc02',
  },
  NANG_CAO: {
    label: 'Cấp độ 2: Nâng cao',
    desc: 'Xử lý ngã tư đông đúc, nhận diện vùng điểm mù xe buýt và xe tải chuyển hướng.',
    badge: '🛡️ Tay lái vững vàng',
    color: '#ffc800',
  },
  THU_THACH: {
    label: 'Cấp độ 3: Thử thách',
    desc: 'Phản xạ trong điều kiện mặt đường mưa ướt trơn trượt và tình huống khẩn cấp.',
    badge: '🏆 Hiệp sĩ giao thông',
    color: '#ff4b4b',
  },
};

const VEHICLE_INFO: Record<VehicleType, { label: string; desc: string; icon: string }> = {
  BIKE: { icon: '🚲', label: 'Xe đạp học sinh', desc: 'Tốc độ vừa phải, dễ quan sát xung quanh' },
  E_BIKE: { icon: '⚡', label: 'Xe đạp điện', desc: 'Phanh sớm nhẹ tay, giữ cự ly an toàn' },
  E_SCOOTER: { icon: '🛵', label: 'Xe máy điện', desc: 'Bắt buộc đội mũ bảo hiểm đạt chuẩn, bật xi-nhan khi rẽ' },
  MOTO_50CC: { icon: '🏍️', label: 'Xe máy dưới 50cc', desc: 'Dành cho học sinh THPT đủ điều kiện theo quy định' },
};

export default function HomePage() {
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('CITY_3D');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('CO_BAN');
  const [vehicleType, setVehicleType] = useState<VehicleType>('BIKE');
  const [cameraMode, setCameraMode] = useState<CameraMode>('CINEMATIC_OVERVIEW');

  const [screen, setScreen] = useState<Screen>('welcome');
  const [form, setForm] = useState<ParticipantInput>(blank);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>('PRE');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [results, setResults] = useState<Partial<Record<Phase, AttemptResult>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'ALL' | 'CITY_3D' | 'ARENA_CHALLENGE' | 'SAFE_JOURNEY'>('ALL');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [localHistory, setLocalHistory] = useState<any[]>([]);

  // Tải bảng xếp hạng từ localStorage & server
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saferide_local_history');
      if (saved) setLocalHistory(JSON.parse(saved));
    } catch {}
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/public/leaderboard');
      if (res.ok) {
        const d = await res.json();
        if (d.leaderboard) setLeaderboardData(d.leaderboard);
      }
    } catch {}
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const actions = useRef<GameAction[]>([]);
  const started = useRef(0);

  const valid =
    [form.full_name, form.class_name, form.school_name, form.province_city].every((v) => v.trim().length > 0) &&
    form.privacy_notice_accepted;

  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      await clearLocalParticipantSession();
    } catch {
      setError('Chưa thể kết thúc phiên. Vui lòng thử lại trước khi đổi người chơi.');
      setBusy(false);
      return;
    }
    setDemoMode(false);
    setDemoCount(0);
    setShowTutorial(false);
    setBusy(false);
    setScreen('welcome');
    setForm({ ...blank });
    setSession(null);
    setPhase('PRE');
    setScenario(null);
    setSelected('');
    setResult(null);
    setResults({});
    setError('');
    setCameraMode('CINEMATIC_OVERVIEW');
    actions.current = [];
  }

  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const nextSession = await createSession(form);
      setSession(nextSession);
      const firstScenario = await loadScenario('PRE');
      setScenario(firstScenario);
      setPhase('PRE');
      setCameraMode('FOLLOW_VEHICLE');
      setScreen('play');
      started.current = performance.now();
    } catch {
      setError('Chưa thể khởi tạo phiên học tập. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function startDemo() {
    setBusy(true);
    setError('');
    try {
      const first = await loadScenario('PRE', true);
      setScenario(first);
      setPhase('PRE');
      setSelected('');
      setResult(null);
      setSession(null);
      setDemoMode(true);
      setDemoCount(1);
      setShowTutorial(true);
      setCameraMode('FOLLOW_VEHICLE');
      actions.current = [];
      started.current = performance.now();
      setScreen('play');
    } catch {
      setError('Chưa tải được cảnh chơi thử. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!scenario || !selected || busy) return;
    if (demoMode) {
      const feedback: AttemptResult = {
        rule_score: 0,
        outcome: 'DEMO_UNSCORED',
        feedback: 'Đây là lượt làm quen điều khiển, không chấm điểm và không lưu kết quả nghiên cứu. Hãy quan sát dấu hiệu rủi ro; bắt đầu hành trình học để nhận đánh giá từ máy chủ.',
      };
      setResult(feedback);
      setResults(prev => ({ ...prev, [phase]: feedback }));
      return;
    }
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const durationMs = Math.min(300_000, Math.max(0, Math.round(performance.now() - started.current)));
      // Do not infer driving actions from the position of an answer option.
      await sendEvents(session, scenario.scenario_id, [], selected, durationMs);
      const nextResult = await submitAttempt(session, phase, scenario, selected, durationMs);
      setResult(nextResult);
      setResults((prev) => ({ ...prev, [phase]: nextResult }));
      // Phản hồi AI (Gemini) lấy ở nền, không chặn việc hiện điểm; về tới đâu cập nhật tới đó.
      void fetchAiFeedback(scenario, selected, nextResult.outcome, nextResult.rule_score).then((feedback) => {
        if (!feedback) return;
        const enriched = { ...nextResult, feedback };
        setResult((current) => (current === nextResult ? enriched : current));
        setResults((prev) => (prev[phase] === nextResult ? { ...prev, [phase]: enriched } : prev));
      });
    } catch {
      setError('Chưa thể ghi nhận câu trả lời. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (demoMode) {
      if (demoCount >= 3) {
        setDemoMode(false);
        setShowTutorial(false);
        setScreen('welcome');
        return;
      }
      setBusy(true);
      try {
        const nextDemo = await loadScenario('PRE', true);
        setScenario(nextDemo);
        setSelected('');
        setResult(null);
        setShowTutorial(false);
        setDemoCount(value => value + 1);
        actions.current = [];
        started.current = performance.now();
      } catch {
        setError('Chưa mở được cảnh tiếp theo.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (phase === 'POST') {
      setCameraMode('CINEMATIC_OVERVIEW');
      setScreen('results');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const nextPhase = phases[phases.indexOf(phase) + 1];
      setScenario(await loadScenario(nextPhase));
      setPhase(nextPhase);
      setSelected('');
      setResult(null);
      actions.current = [];
      started.current = performance.now();
      setCameraMode(nextPhase === 'TRAINING' ? 'INTERSECTION' : 'FOLLOW_VEHICLE');
    } catch {
      setError('Chưa mở được chặng tiếp theo. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const selectedDecision = scenario && selected
    ? selected === scenario.options[0]?.id ? 'safe' : selected === scenario.options[1]?.id ? 'rush' : 'ignore'
    : '';

  useEffect(() => {
    if (screen !== 'play' || !scenario) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0) {
        setSelected(scenario.options[index]?.id || '');
      } else if (event.key === ' ') {
        event.preventDefault();
        setSelected(scenario.options[0]?.id || '');
      } else if (event.key === 'Enter' && selected && !busy && !result) {
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, scenario, selected, busy, result]);

  return (
    <div className="site-shell">
      {/* Thanh Thông Báo Phong Cách Biển Báo Giao Thông */}
      <div className="demo-banner">
        <span className="demo-pill">ATGT 2026</span>
        <span>Hệ thống Mô phỏng Giáo dục An toàn Giao thông Học đường Việt Nam — Trải nghiệm Trực tiếp Không cần Tài khoản</span>
      </div>

      {/* Header Điều Hướng Gamified */}
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Trang chủ SafeRide EDU AI">
          <div className="brand-mark">
            S<span>↗</span>
          </div>
          <span>
            SafeRide <b>EDU AI</b>
            <small>HỌC TỪ ĐƯỜNG PHỐ · VỮNG TAY LÁI ĐẾN TRƯỜNG</small>
          </span>
        </Link>
        <nav aria-label="Menu điều hướng">
          <Link href="/privacy">Bảo mật & Dữ liệu</Link>
          <Link className="admin-link" href="/admin">
            Quản trị Giáo viên ↗
          </Link>
        </nav>
      </header>

      {/* THANH CHỌN 3 PHƯƠNG ÁN TRẢI NGHIỆM TACTILE */}
      <section
        aria-label="Chọn chế độ giao diện"
        style={{
          maxWidth: '1240px',
          width: '100%',
          margin: '14px auto 0',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '2px solid #dce6ef',
            borderBottom: '5px solid #c4d5e3',
            borderRadius: '24px',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ● Chế độ Trải nghiệm
            </div>
            <div style={{ fontSize: '14.5px', color: '#334860', fontWeight: 700, marginTop: '2px' }}>
              {experienceMode === 'CITY_3D' && 'Phương án 1: Thành phố giao thông 3D — Không gian ngã tư trường học và đường phố sinh động.'}
              {experienceMode === 'ARENA_CHALLENGE' && 'Phương án 2: Đấu trường thử thách — Tích lũy điểm năng lượng an toàn và mở khóa huy hiệu.'}
              {experienceMode === 'SAFE_JOURNEY' && 'Phương án 3: Hành trình đến trường — Vượt qua từng chặng an toàn từ nhà tới cổng trường.'}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setExperienceMode('CITY_3D')}
              style={{
                padding: '9px 16px',
                borderRadius: '14px',
                border: experienceMode === 'CITY_3D' ? '2px solid #16a34a' : '2px solid #dce6ef',
                borderBottom: experienceMode === 'CITY_3D' ? '4px solid #15803d' : '3px solid #c4d5e3',
                background: experienceMode === 'CITY_3D' ? '#58cc02' : '#ffffff',
                color: experienceMode === 'CITY_3D' ? '#ffffff' : '#334860',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              🏫 Phương án 1: Thành phố 3D
            </button>
            <button
              type="button"
              onClick={() => setExperienceMode('ARENA_CHALLENGE')}
              style={{
                padding: '9px 16px',
                borderRadius: '14px',
                border: experienceMode === 'ARENA_CHALLENGE' ? '2px solid #d97706' : '2px solid #dce6ef',
                borderBottom: experienceMode === 'ARENA_CHALLENGE' ? '4px solid #b45309' : '3px solid #c4d5e3',
                background: experienceMode === 'ARENA_CHALLENGE' ? '#ffc800' : '#ffffff',
                color: experienceMode === 'ARENA_CHALLENGE' ? '#78350f' : '#334860',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              ⚡ Phương án 2: Đấu trường thử thách
            </button>
            <button
              type="button"
              onClick={() => setExperienceMode('SAFE_JOURNEY')}
              style={{
                padding: '9px 16px',
                borderRadius: '14px',
                border: experienceMode === 'SAFE_JOURNEY' ? '2px solid #0284c7' : '2px solid #dce6ef',
                borderBottom: experienceMode === 'SAFE_JOURNEY' ? '4px solid #0369a1' : '3px solid #c4d5e3',
                background: experienceMode === 'SAFE_JOURNEY' ? '#1cb0f6' : '#ffffff',
                color: experienceMode === 'SAFE_JOURNEY' ? '#ffffff' : '#334860',
                fontWeight: 900,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              🎒 Phương án 3: Hành trình đến trường
            </button>
          </div>
        </div>
      </section>
      <main className="main-content">
        {screen === 'welcome' ? (
          <div className="landing-grid">
            <section className="hero">
              <span className="eyebrow">
                <span className="live-dot" /> KHÔNG GIAN 3D GIAO THÔNG HỌC ĐƯỜNG
              </span>
              <h1 className="hero-slogan">
                <span className="hero-slogan-blue">Vững tay lái.</span>{' '}
                <span className="hero-slogan-orange">An toàn</span>{' '}
                <span className="hero-slogan-green">đến trường.</span>
              </h1>
              <p className="hero-copy">
                Khám phá mô phỏng 3D trước cổng trường học Việt Nam. Rèn luyện phản xạ dừng trước vạch đi bộ, quan sát đèn tín hiệu và tránh xa vùng điểm mù xe buýt.
              </p>

              <div className="hero-chips">
                <span>⚡ Không cần đăng nhập</span>
                <span>🎮 Đổi cấp độ linh hoạt</span>
                <span>📱 Máy tính & Điện thoại</span>
              </div>

              {/* KHUNG THẾ GIỚI 3D TRỰC QUAN */}
              <World3D
                cameraMode={cameraMode}
                vehicleType={vehicleType}
                isDriving={true}
                weather={difficultyLevel === 'THU_THACH' ? 'rain' : 'sunny'}
                hazardActive={difficultyLevel !== 'CO_BAN'}
              />

              <div className="hero-caption">
                <span className="hero-step-blue">01 / QUAN SÁT HIỆN TRƯỜNG 3D</span>
                <span className="hero-step-orange">02 / ĐƯA RA QUYẾT ĐỊNH ĐÚNG LUẬT</span>
                <span className="hero-step-green">03 / ĐỒNG BỘ TIẾN ĐỘ TRỰC TUYẾN</span>
              </div>
              <ParticipationDashboard />
            </section>

            <section className="entry-card">
              <div className="card-kicker">
                <span>THẺ VÀO HÀNH TRÌNH HỌC TẬP</span>
                <span className="ticket-number">ATGT / 2026</span>
              </div>
              <h2>Chào em, cùng xuất phát nào!</h2>
              <p className="muted">
                Điền 4 thông tin cơ bản và chọn cấp độ thử thách cho lượt trải nghiệm này.
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (valid) setScreen('instructions');
                }}
              >
                <label htmlFor="full-name">
                  Họ và tên học sinh <span>*</span>
                </label>
                <input
                  id="full-name"
                  name="full_name"
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                  placeholder="Ví dụ: Học sinh A"
                  autoComplete="off"
                  required
                  maxLength={100}
                />

                <div className="field-row">
                  <div>
                    <label htmlFor="class-name">
                      Lớp <span>*</span>
                    </label>
                    <input
                      id="class-name"
                      name="class_name"
                      value={form.class_name}
                      onChange={(event) => setForm({ ...form, class_name: event.target.value })}
                      placeholder="Ví dụ: 8A hoặc 10A1"
                      autoComplete="off"
                      required
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label htmlFor="school-name">
                      Trường học <span>*</span>
                    </label>
                    <input
                      id="school-name"
                      name="school_name"
                      value={form.school_name}
                      onChange={(event) => setForm({ ...form, school_name: event.target.value })}
                      placeholder="Ví dụ: THCS ABC hoặc THPT ABC"
                      autoComplete="off"
                      required
                      maxLength={150}
                    />
                  </div>
                </div>

                <label htmlFor="province-city">
                  Tỉnh / Thành phố <span>*</span>
                </label>

                <select
                  id="province-city"
                  name="province_city"
                  value={form.province_city}
                  onChange={(event) => setForm({ ...form, province_city: event.target.value })}
                  required
                >
                  <option value="">-- Chọn Tỉnh / Thành phố --</option>
                  {DEMO_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>

                {/* CHỌN CẤP ĐỘ THỬ THÁCH (KHÔNG LƯU CỨNG VÀO HỌC SINH) */}
                <label style={{ marginTop: '14px' }}>
                  Chọn cấp độ thử thách lượt chơi <span>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                  {(['CO_BAN', 'NANG_CAO', 'THU_THACH'] as DifficultyLevel[]).map((lvl) => {
                    const info = LEVEL_INFO[lvl];
                    const isSel = difficultyLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficultyLevel(lvl)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '14px',
                          border: isSel ? `2.5px solid ${info.color}` : '2px solid #dce6ef',
                          borderBottom: isSel ? `4px solid ${info.color}` : '3px solid #c4d5e3',
                          background: isSel ? '#ffffff' : '#f8fafc',
                          color: '#1e2d3d',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{info.badge.slice(0, 2)}</span>
                        <span>{lvl === 'CO_BAN' ? 'Cơ bản' : lvl === 'NANG_CAO' ? 'Nâng cao' : 'Thử thách'}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="field-note">{LEVEL_INFO[difficultyLevel].desc}</p>

                {/* CHỌN PHƯƠNG TIỆN 3D */}
                <label style={{ marginTop: '14px' }}>
                  Chọn phương tiện điều khiển 3D <span>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '4px' }}>
                  {(['BIKE', 'E_BIKE', 'E_SCOOTER', 'MOTO_50CC'] as VehicleType[]).map((vt) => {
                    const vInfo = VEHICLE_INFO[vt];
                    const isV = vehicleType === vt;
                    return (
                      <button
                        key={vt}
                        type="button"
                        onClick={() => setVehicleType(vt)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '12px',
                          border: isV ? '2px solid #1cb0f6' : '1.5px solid #dce6ef',
                          borderBottom: isV ? '4px solid #0284c7' : '2px solid #c4d5e3',
                          background: isV ? '#ddf4ff' : '#f8fafc',
                          color: '#1e2d3d',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{vInfo.icon}</span>
                        <span>{vInfo.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="field-note">{VEHICLE_INFO[vehicleType].desc}</p>

                <label className="consent">
                  <input
                    type="checkbox"
                    checked={form.privacy_notice_accepted}
                    onChange={(event) => setForm({ ...form, privacy_notice_accepted: event.target.checked })}
                    required
                  />
                  <span>
                    Em đồng ý tham gia học tập an toàn giao thông theo <Link href="/privacy">quy định bảo vệ dữ liệu</Link>.
                  </span>
                </label>

                <button className="primary start-button" disabled={!valid} type="submit">
                  Bắt đầu hành trình <span>↗</span>
                </button>
                <p className="form-footnote">Một quyết định đúng luật giúp hành trình đến trường luôn an toàn.</p>
                <button type="button" className="text-button" onClick={startDemo} disabled={busy} style={{ width: 'fit-content', marginTop: '8px' }}>
                  🎮 Chơi thử ngay · không cần đăng nhập
                </button>
              </form>
            </section>
          </div>
        ) : (
          <>
            <div className="journey-header">
              <span className="eyebrow">
                HÀNH TRÌNH CỦA EM: {form.full_name} ({form.class_name} · {form.school_name} - {form.province_city}) — {LEVEL_INFO[difficultyLevel].label}
              </span>
              <button className="text-button" onClick={reset} disabled={busy}>
                ↺ Đổi người chơi / Lượt mới
              </button>
            </div>

            {/* BẢN ĐỒ CHẶNG ĐƯỜNG GAMIFIED THEO PHONG CÁCH DUOLINGO */}
            <ol className="stepper">
              {['Chuẩn bị xuất phát', 'Chặng 1: Trước học', 'Chặng 2: Luyện tập', 'Chặng 3: Sau học', 'Tổng kết & Huy hiệu'].map(
                (name, index) => {
                  const activeIndex = screen === 'instructions' ? 0 : screen === 'results' ? 4 : phases.indexOf(phase) + 1;
                  return (
                    <li
                      className={index === activeIndex ? 'active' : index < activeIndex ? 'done' : ''}
                      aria-current={index === activeIndex ? 'step' : undefined}
                      key={name}
                    >
                      <span>{index < activeIndex ? '✓' : `0${index + 1}`}</span>
                      {name}
                    </li>
                  );
                },
              )}
            </ol>

            {screen === 'instructions' && (
              <section className="instruction-card">
                <div>
                  <span className="eyebrow">CHUẨN BỊ TRƯỚC KHI LĂN BÁNH</span>
                  <h1>
                    Quan sát trước.
                    <br />
                    Quyết định sau.
                  </h1>
                  <p>
                    Em sẽ lần lượt qua 3 chặng: <strong>Trước khi học</strong>, <strong>Luyện tập tình huống</strong> và{' '}
                    <strong>Đánh giá sau học</strong> trong không gian 3D tương tác.
                  </p>
                  <div className="review-info">
                    <strong>Học sinh: {form.full_name}</strong>
                    <span>
                      {form.class_name} · {form.school_name} · {form.province_city}
                    </span>
                    <span>
                      Cấp độ: {LEVEL_INFO[difficultyLevel].label} · Phương tiện: {VEHICLE_INFO[vehicleType].label}
                    </span>
                    <button className="text-button" onClick={() => setScreen('welcome')} style={{ width: 'fit-content', marginTop: '6px' }}>
                      ✎ Sửa lại thông tin hoặc phương tiện
                    </button>
                  </div>
                  <div className="notice">
                    Quy tắc vàng: Luôn giảm tốc độ, rà phanh khi đến gần vạch người đi bộ và giữ cự ly an toàn ngoài tầm điểm mù của xe tải, xe buýt lớn.
                  </div>
                </div>

                <div className="instruction-right">
                  <h2>Hướng dẫn chơi</h2>
                  <div className="control-guide">
                    <kbd>1 / 2 / 3</kbd>
                    <span>Chọn một trong ba phương án xử lý</span>
                    <kbd>Phím Cách (Space)</kbd>
                    <span>Chọn nhanh phương án an toàn (phanh)</span>
                    <kbd>Enter</kbd>
                    <span>Xác nhận quyết định</span>
                  </div>
                  <p className="muted">
                    Cảnh 3D chỉ là hiện trường quan sát. Em chọn phương án, xe sẽ phản ứng theo lựa chọn đó.
                  </p>
                  <button className="primary" onClick={start} disabled={busy}>
                    {busy ? 'Đang chuẩn bị sân tập 3D…' : 'Sẵn sàng · Vào chặng đầu tiên ↗'}
                  </button>
                </div>
              </section>
            )}

            {screen === 'play' && scenario && (
              <>
                {demoMode && showTutorial && (
                  <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13.5 }}>
                    <strong>Hướng dẫn (1 màn đầu):</strong> ① Quan sát hiện trường 3D · ② Nhấn <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> chọn phương án · ③ Xem xe phản ứng và đọc nhận xét.
                    <button type="button" className="text-button" onClick={() => setShowTutorial(false)} style={{ marginLeft: 8 }}>Đã hiểu ✕</button>
                  </div>
                )}
                {demoMode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12.5, color: '#64748b' }}>
                    <span>🎮 Chơi thử · cảnh {demoCount}/3 (ngẫu nhiên)</span>
                    <button type="button" className="text-button" onClick={() => { setDemoMode(false); setShowTutorial(false); setScreen('welcome'); }}>Thoát chơi thử</button>
                  </div>
                )}
                <div className="play-heading">
                  <div>
                    <span className="eyebrow">
                      {demoMode ? 'CHƠI THỬ' : `CHẶNG ${phases.indexOf(phase) + 1} / 3`} · {LEVEL_INFO[difficultyLevel].badge}
                    </span>
                    <h1>{phaseNames[phase]}</h1>
                  </div>
                  <span className="mode-tag">
                    {session?.storageMode === 'GOOGLE'
                      ? '✓ Đã đồng bộ Google Sheets trực tuyến'
                      : session?.storageMode === 'LOCAL_DEMO_MOCK'
                        ? '✓ Đã lưu cục bộ trên máy này'
                        : 'Trải nghiệm dự phòng trong trình duyệt'}
                  </span>
                </div>

                {/* GIAO DIỆN PHƯƠNG ÁN 2: ĐẤU TRƯỜNG THỬ THÁCH */}
                {experienceMode === 'ARENA_CHALLENGE' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                      marginBottom: '16px',
                      background: '#fffbeb',
                      border: '2px solid #f59e0b',
                      borderBottom: '4px solid #d97706',
                      borderRadius: '18px',
                      padding: '14px 18px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 900 }}>ĐIỂM NĂNG LƯỢNG AN TOÀN</span>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#b45309' }}>100 / 100 Điểm</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 900 }}>CẤP ĐỘ THỬ THÁCH</span>
                      <div style={{ fontSize: '17px', fontWeight: 900, color: '#78350f' }}>{LEVEL_INFO[difficultyLevel].label}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 900 }}>HUY HIỆU MỤC TIÊU</span>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#047857' }}>🏅 Hiệp sĩ nhường đường</div>
                    </div>
                  </div>
                )}

                {/* GIAO DIỆN PHƯƠNG ÁN 3: HÀNH TRÌNH ĐẾN TRƯỜNG AN TOÀN */}
                {experienceMode === 'SAFE_JOURNEY' && (
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '2px solid #38bdf8',
                      borderBottom: '4px solid #0284c7',
                      borderRadius: '18px',
                      padding: '14px 18px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontWeight: 900, color: '#0369a1', fontSize: '15px' }}>
                      🗺️ Lộ trình từ Nhà đến Trường của {form.full_name}:
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '14px', fontWeight: 900 }}>
                      <span style={{ color: phase === 'PRE' ? '#0284c7' : '#16a34a' }}>
                        {phase === 'PRE' ? '📍 Chặng 1: Xuất phát' : '✓ Chặng 1: Đã hoàn thành'}
                      </span>
                      <span>→</span>
                      <span style={{ color: phase === 'TRAINING' ? '#0284c7' : phase === 'POST' ? '#16a34a' : '#64748b' }}>
                        {phase === 'TRAINING' ? '📍 Chặng 2: Ngã tư lớn' : phase === 'POST' ? '✓ Chặng 2: Đã hoàn thành' : 'Chặng 2: Ngã tư lớn'}
                      </span>
                      <span>→</span>
                      <span style={{ color: phase === 'POST' ? '#0284c7' : '#64748b' }}>
                        {phase === 'POST' ? '📍 Chặng 3: Cổng trường học' : 'Chặng 3: Cổng trường học'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="play-grid">
                  <div style={{ minHeight: '460px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <World3D
                      key={`${phase}-${vehicleType}-${difficultyLevel}`}
                      cameraMode={cameraMode}
                      vehicleType={vehicleType}
                      isDriving={!result}
                      weather={phase === 'POST' || difficultyLevel === 'THU_THACH' ? 'rain' : 'sunny'}
                      sceneKind={scenario.npc_element}
                      sceneEvent={scenario.trigger_event}
                      selectedDecision={selectedDecision}
                      visualSpec={scenario.visual_spec}
                    />
                  </div>

                  <section className="question-card">
                    <span className="eyebrow">TÌNH HUỐNG GIAO THÔNG THỰC TẾ</span>
                    <h2>{scenario.title_vi}</h2>
                    <div dangerouslySetInnerHTML={{ __html: scenario.prompt_vi }} />

                    <div className="scenario-cue">
                      <div dangerouslySetInnerHTML={{ __html: scenario.hazard_cue_vi }} />
                    </div>

                    <div style={{ display: 'grid', gap: '8px', margin: '12px 0' }}>
                      {scenario.options.map((option, index) => (
                        <button
                          type="button"
                          key={option.id}
                          disabled={busy || !!result}
                          onClick={() => setSelected(option.id)}
                          className={`answer-option ${selected === option.id ? 'selected' : ''}`}
                          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent' }}
                        >
                          <span className="option-letter">{index + 1}</span>
                          <span dangerouslySetInnerHTML={{ __html: option.label_vi }} />
                        </button>
                      ))}
                    </div>

                    {result ? (
                      <div className="feedback" role="status">
                        <strong>
                          {phase === 'TRAINING' ? 'Phân tích & Hướng dẫn kỹ năng an toàn' : 'Đã ghi nhận quyết định của em'}
                        </strong>
                        <div
                          dangerouslySetInnerHTML={{
                            __html:
                              result.feedback ||
                              'Quan sát kỹ người đi bộ, giữ khoảng cách cẩn thận với điểm mù xe lớn và luôn phanh an toàn trước vạch dừng.',
                          }}
                        />
                        <button className="primary" onClick={next} disabled={busy}>
                          {busy
                            ? 'Đang mở chặng…'
                            : phase === 'POST'
                              ? 'Xem bảng tổng kết kết quả ↗'
                              : 'Sang chặng tiếp theo →'}
                        </button>
                      </div>
                    ) : (
                      <button className="primary" onClick={submit} disabled={!selected || busy}>
                        {busy ? 'Đang chấm điểm & đồng bộ…' : 'Xác nhận quyết định xử lý →'}
                      </button>
                    )}

                    <p className="small muted" style={{ marginTop: '10px' }}>
                      Nhấn 1 / 2 / 3 (hoặc bấm phương án). Phím Space = phanh. Cảnh 3D sẽ phản ứng theo lựa chọn của em.
                    </p>
                  </section>
                </div>
              </>
            )}

            {screen === 'results' && (
              <section className="result-card">
                <div className="result-emblem">🏆</div>
                <span className="eyebrow">HOÀN THÀNH XUẤT SẮC HÀNH TRÌNH ĐẾN TRƯỜNG</span>
                <h1>
                  Chúc mừng {form.full_name}!
                  <br />
                  <em>Vững tay lái, an toàn mỗi ngày.</em>
                </h1>
                <p>
                  Học sinh lớp <strong>{form.class_name}</strong> · Trường <strong>{form.school_name}</strong> ({form.province_city}) đã hoàn thành trọn vẹn cả 3 chặng ở <strong>{LEVEL_INFO[difficultyLevel].label}</strong>.
                </p>

                <div className="score-grid">
                  {phases.map((item) => (
                    <div key={item}>
                      <span>{phaseNames[item]}</span>
                      <strong>
                        {results[item]?.rule_score ?? '—'}
                        <small>/100</small>
                      </strong>
                      <span>Điểm kỹ năng</span>
                    </div>
                  ))}
                </div>

                <div className="notice" style={{ background: '#d7ffb8', borderColor: '#46a302', color: '#14532d' }}>
                  <strong>Huy hiệu đạt được:</strong> {LEVEL_INFO[difficultyLevel].badge} · Phương tiện:{' '}
                  {VEHICLE_INFO[vehicleType].label}.{' '}
                  {session?.storageMode === 'GOOGLE'
                    ? 'Kết quả học tập đã được lưu và đồng bộ trực tuyến lên Google Sheets để phục vụ thống kê nghiên cứu.'
                    : session?.storageMode === 'LOCAL_DEMO_MOCK'
                      ? 'Kết quả học tập đã được lưu vào kho dữ liệu cục bộ trên máy này; chưa đồng bộ lên Google Sheets.'
                      : 'Kết quả chỉ được giữ trong phiên trình duyệt dự phòng; chưa ghi vào kho dữ liệu máy chủ.'}
                </div>

                <div className="result-actions">
                  <button className="primary" onClick={reset}>
                    Đổi người chơi / Lượt mới ↗
                  </button>
                </div>
              </section>
            )}

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        <section className="learning-strip">
          <div>
            <span className="strip-icon">◎</span>
            <strong>Quan sát chủ động 360 độ</strong>
            <p>Nhận diện sớm người đi bộ, ô tô dừng đỗ và cửa xe hé mở bất ngờ.</p>
          </div>
          <div>
            <span className="strip-icon">↔</span>
            <strong>Tránh xa vùng điểm mù</strong>
            <p>Không đi sát sườn hoặc cắt ngang đầu xe tải, xe buýt đưa đón học sinh.</p>
          </div>
          <div>
            <span className="strip-icon">↗</span>
            <strong>Tuân thủ luật giao thông</strong>
            <p>Dừng đúng vạch, nhường người đi bộ và luôn đội mũ bảo hiểm đạt chuẩn.</p>
          </div>
        </section>
      </main>


      {/* MODAL BẢNG XẾP HẠNG THEO TỪNG PHƯƠNG ÁN & TỔNG HỢP */}
      {showLeaderboard && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '880px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                color: '#ffffff',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏆 BẢNG VÀNG XẾP HẠNG AN TOÀN GIAO THÔNG
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                  Ghi nhận điểm kỹ năng và ngày giờ thực hiện chính xác theo từng lượt trải nghiệm
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboard(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  borderRadius: '999px',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            {/* Thanh Tab chọn Phương Án Trải Nghiệm */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'ALL', label: '⭐ Xếp Hạng Tổng Hợp' },
                { id: 'CITY_3D', label: '🏫 Phương án 1: Thành phố 3D' },
                { id: 'ARENA_CHALLENGE', label: '⚡ Phương án 2: Đấu trường' },
                { id: 'SAFE_JOURNEY', label: '🎒 Phương án 3: Đến trường' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeaderboardTab(tab.id as any)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '12px',
                    border: leaderboardTab === tab.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: leaderboardTab === tab.id ? '#eff6ff' : '#ffffff',
                    color: leaderboardTab === tab.id ? '#1d4ed8' : '#475569',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Danh sách bảng xếp hạng */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const combined = [
                  ...localHistory,
                  ...leaderboardData.map((d: any) => ({
                    id: d.participant_id,
                    full_name: d.full_name,
                    class_name: d.class_name,
                    school_name: d.school_name,
                    province_city: d.province_city,
                    mode: d.experience_mode || 'CITY_3D',
                    total_score: d.total_score,
                    pre_score: d.pre_score,
                    post_score: d.post_score,
                    created_at: d.completed_at,
                  })),
                ];

                const filtered = combined.filter((item) =>
                  leaderboardTab === 'ALL' ? true : item.mode === leaderboardTab,
                );

                const unique = Array.from(new Map(filtered.map((item) => [item.id, item])).values());
                unique.sort((a, b) => (b.total_score || 0) - (a.total_score || 0) || Date.parse(b.created_at) - Date.parse(a.created_at));

                if (unique.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      <span style={{ fontSize: '36px', display: 'inline-block', marginBottom: '8px' }}>🏁</span>
                      <p style={{ margin: 0, fontWeight: 700 }}>Chưa có lượt thi đấu nào cho mục này.</p>
                      <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Hãy hoàn thành đủ 3 chặng để tên bạn được vinh danh trên bảng vàng!</p>
                    </div>
                  );
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 8px', width: '50px' }}>Hạng</th>
                        <th style={{ padding: '10px 12px' }}>Học sinh / Lớp</th>
                        <th style={{ padding: '10px 12px' }}>Trường & Tỉnh</th>
                        <th style={{ padding: '10px 12px' }}>Phương án</th>
                        <th style={{ padding: '10px 12px' }}>Điểm số</th>
                        <th style={{ padding: '10px 12px' }}>Ngày giờ thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unique.map((item, idx) => {
                        const rankBadge = idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : ("#" + (idx + 1));
                        const isTop3 = idx < 3;
                        return (
                          <tr
                            key={item.id + idx}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            }}
                          >
                            <td style={{ padding: '12px 8px', fontWeight: 900, color: isTop3 ? '#b45309' : '#64748b' }}>
                              {rankBadge}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.full_name}</div>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Lớp {item.class_name}</span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: 600, color: '#334155' }}>{item.school_name}</div>
                              <span style={{ fontSize: '12px', color: '#0284c7' }}>{item.province_city}</span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  background: item.mode === 'ARENA_CHALLENGE' ? '#fef3c7' : item.mode === 'SAFE_JOURNEY' ? '#e0f2fe' : '#dcfce7',
                                  color: item.mode === 'ARENA_CHALLENGE' ? '#b45309' : item.mode === 'SAFE_JOURNEY' ? '#0369a1' : '#15803d',
                                }}
                              >
                                {item.mode === 'ARENA_CHALLENGE' ? 'Đấu trường' : item.mode === 'SAFE_JOURNEY' ? 'Đến trường' : 'Thành phố 3D'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <strong style={{ fontSize: '16px', color: '#16a34a' }}>{item.total_score ?? 100}</strong>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>/100</span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {new Date(item.created_at).toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              <span>Dữ liệu lưu vết an toàn theo từng lượt hoàn thành hành trình.</span>
              <button
                type="button"
                onClick={() => setShowLeaderboard(false)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <span>SafeRide EDU AI 2026 <b>·</b> Học từ đường phố, vững tay lái đến trường</span>
        <span>Sáng kiến Giáo dục An toàn Giao thông Học đường Việt Nam</span>
      </footer>
    </div>
  );
}
