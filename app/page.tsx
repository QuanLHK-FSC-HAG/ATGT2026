'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { createSession, loadScenario, sendEvents, submitAttempt, type SessionInfo } from '@/components/api';
import type { CameraMode, VehicleType } from '@/components/world-3d';
import { DEMO_PROVINCES } from '@/game/scenarios';
import type { AttemptResult, GameAction, Phase, Scenario } from '@/game/types';
import type { ParticipantInput } from '@/lib/types';

const World3D = dynamic(() => import('@/components/world-3d'), {
  ssr: false,
  loading: () => <div className="game-loading">Đang tải thế giới thực tế ảo 3D học đường…</div>,
});

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
  province_city: 'Thành phố Cần Thơ',
  privacy_notice_accepted: true,
  privacy_notice_version: '2026-01',
};

const TOP_PROVINCES_QUICK = [
  'Thành phố Cần Thơ',
  'Thành phố Hồ Chí Minh',
  'Thành phố Hà Nội',
  'Thành phố Đà Nẵng',
  'Tỉnh Hậu Giang',
  'Tỉnh Sóc Trăng',
];

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
  const [provinceSearch, setProvinceSearch] = useState('');

  const [screen, setScreen] = useState<Screen>('welcome');
  const [form, setForm] = useState<ParticipantInput>(blank);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>('PRE');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [results, setResults] = useState<Partial<Record<Phase, AttemptResult>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const actions = useRef<GameAction[]>([]);
  const started = useRef(0);

  const filteredProvinces = useMemo(() => {
    if (!provinceSearch.trim()) return DEMO_PROVINCES;
    const q = provinceSearch.toLowerCase().trim();
    return DEMO_PROVINCES.filter((p) => p.toLowerCase().includes(q));
  }, [provinceSearch]);

  const valid =
    [form.full_name, form.class_name, form.school_name, form.province_city].every((v) => v.trim().length > 0) &&
    form.privacy_notice_accepted;

  function reset() {
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

  function handle3DAction(act: string) {
    if (actions.current.length < 200) {
      const validAct: GameAction = act === 'SIGNAL_LEFT' || act === 'SIGNAL_RIGHT' ? 'SIGNAL' : 'BRAKE';
      actions.current.push(validAct);
    }
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

  async function submit() {
    if (!session || !scenario || !selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const durationMs = Math.max(1200, Math.round(performance.now() - started.current));
      await sendEvents(session, scenario.scenario_id, actions.current, selected);
      const nextResult = await submitAttempt(session, phase, scenario, selected, durationMs);
      setResult(nextResult);
      setResults((prev) => ({ ...prev, [phase]: nextResult }));
    } catch {
      setError('Chưa thể ghi nhận câu trả lời. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
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
              <h1>
                Vững tay lái.
                <br />
                <em>An toàn</em>
                <br />
                đến trường.
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
                interactive={true}
                weather={difficultyLevel === 'THU_THACH' ? 'rain' : 'sunny'}
                hazardActive={difficultyLevel !== 'CO_BAN'}
              />

              <div className="hero-caption">
                <span>01 / QUAN SÁT HIỆN TRƯỜNG 3D</span>
                <span>02 / ĐƯA RA QUYẾT ĐỊNH ĐÚNG LUẬT</span>
                <span>03 / ĐỒNG BỘ TIẾN ĐỘ TRỰC TUYẾN</span>
              </div>
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

                {/* Hàng nút bấm chọn 1 chạm nhanh gọn */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {TOP_PROVINCES_QUICK.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, province_city: p })}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '10px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        border: form.province_city === p ? '2px solid #0284c7' : '1.5px solid #dce6ef',
                        borderBottom: form.province_city === p ? '3px solid #0369a1' : '2px solid #cbd5e1',
                        background: form.province_city === p ? '#ddf4ff' : '#ffffff',
                        color: form.province_city === p ? '#0369a1' : '#334860',
                        cursor: 'pointer',
                      }}
                    >
                      {p === 'Thành phố Cần Thơ' ? 'Cần Thơ' : p === 'Thành phố Hồ Chí Minh' ? 'TP.HCM' : p === 'Thành phố Hà Nội' ? 'Hà Nội' : p === 'Thành phố Đà Nẵng' ? 'Đà Nẵng' : p}
                    </button>
                  ))}
                </div>

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
                  <h2>Hướng dẫn điều khiển 3D</h2>
                  <div className="control-guide">
                    <kbd>W A S D / Phím Mũi tên</kbd>
                    <span>Lái xe di chuyển và giữ làn đường</span>
                    <kbd>Phím Cách (Space)</kbd>
                    <span>Phanh xe, dừng trước vạch trắng</span>
                    <kbd>Phím Q / Phím E</kbd>
                    <span>Bật tín hiệu xi-nhan Trái / Phải</span>
                    <kbd>Nút bấm cảm ứng</kbd>
                    <span>Điều khiển trực tiếp trên màn hình cảm ứng điện thoại</span>
                  </div>
                  <p className="muted">
                    Sau khi điều khiển và quan sát hiện trường 3D, hãy chọn đáp án đúng luật nhất phía dưới.
                  </p>
                  <button className="primary" onClick={start} disabled={busy}>
                    {busy ? 'Đang chuẩn bị sân tập 3D…' : 'Sẵn sàng · Vào chặng đầu tiên ↗'}
                  </button>
                </div>
              </section>
            )}

            {screen === 'play' && scenario && (
              <>
                <div className="play-heading">
                  <div>
                    <span className="eyebrow">
                      CHẶNG {phases.indexOf(phase) + 1} / 3 · {LEVEL_INFO[difficultyLevel].badge}
                    </span>
                    <h1>{phaseNames[phase]}</h1>
                  </div>
                  <span className="mode-tag">
                    {session?.mode === 'server'
                      ? '✓ Đã đồng bộ Google Sheets trực tuyến'
                      : 'Trải nghiệm trực tiếp tại trình duyệt'}
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
                      interactive={true}
                      weather={phase === 'POST' || difficultyLevel === 'THU_THACH' ? 'rain' : 'sunny'}
                      hazardActive={true}
                      onAction={handle3DAction}
                    />
                  </div>

                  <section className="question-card">
                    <span className="eyebrow">TÌNH HUỐNG GIAO THÔNG THỰC TẾ</span>
                    <h2>{scenario.title_vi}</h2>
                    <p style={{ fontWeight: 700, color: '#334860' }}>{scenario.prompt_vi}</p>

                    <div className="scenario-cue">
                      <span>◎ DẤU HIỆU RỦI RO CẦN QUAN SÁT</span>
                      <p>{scenario.hazard_cue_vi}</p>
                    </div>

                    <fieldset disabled={busy || !!result}>
                      <legend>Quyết định xử lý an toàn của em là gì?</legend>
                      {scenario.options.map((option, index) => (
                        <label
                          className={`answer-option ${selected === option.id ? 'selected' : ''}`}
                          key={option.id}
                        >
                          <input
                            type="radio"
                            name="decision"
                            value={option.id}
                            checked={selected === option.id}
                            onChange={() => setSelected(option.id)}
                          />
                          <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                          <span>{option.label_vi}</span>
                        </label>
                      ))}
                    </fieldset>

                    {result ? (
                      <div className="feedback" role="status">
                        <strong>
                          {phase === 'TRAINING' ? 'Phân tích & Hướng dẫn kỹ năng an toàn' : 'Đã ghi nhận quyết định của em'}
                        </strong>
                        <p>
                          {result.feedback ||
                            'Quan sát kỹ người đi bộ, giữ khoảng cách cẩn thận với điểm mù xe lớn và luôn phanh an toàn trước vạch dừng.'}
                        </p>
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
                      Em có thể điều khiển xe trên không gian 3D bên cạnh để kiểm tra góc nhìn trước khi đưa ra quyết định.
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
                  {VEHICLE_INFO[vehicleType].label}. Kết quả học tập đã được lưu và đồng bộ trực tuyến lên Google Sheets để phục vụ thống kê nghiên cứu.
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

      <footer>
        <span>SafeRide EDU AI 2026 <b>·</b> Học từ đường phố, vững tay lái đến trường</span>
        <span>Sáng kiến Giáo dục An toàn Giao thông Học đường Việt Nam</span>
      </footer>
    </div>
  );
}