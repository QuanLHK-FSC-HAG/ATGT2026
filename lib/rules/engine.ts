import { DomainError } from '../validation/input.ts';
import type {
  AssessmentRecord,
  PublicScenarioView,
  ScenarioDefinition,
  ScenarioResultRecord,
  StudyPhase,
  StudyRunRecord,
} from '../types.ts';

export const RULE_ENGINE_VERSION = '2026.1-deterministic';

export const CANONICAL_SCENARIOS: ScenarioDefinition[] = [
  {
    scenario_id: 'blind-spot-truck-right-turn',
    version: '1.0',
    title_vi: 'Điểm mù xe tải chuyển hướng phải gần cổng trường',
    phase_eligibility: ['PRE', 'TRAINING', 'POST'],
    vehicle_group: 'E_BIKE',
    difficulty: 2,
    approved: true,
    prompt_vi: 'Em đang đi xe đạp điện bên phải một xe tải lớn đang bật xi-nhan phải để vào cổng phụ khu công nghiệp/trường học.',
    hazard_cue_vi: 'Xe tải bắt đầu giảm tốc, bánh trước ngoặt sang phải, khuất tầm nhìn gương chiếu hậu.',
    options: [
      { id: 'opt_brake_wait', label_vi: 'Giảm tốc, rà phanh, nhường hoàn toàn và dừng phía sau vùng điểm mù của xe tải' },
      { id: 'opt_speed_pass', label_vi: 'Tăng ga lách qua khoảng trống hẹp bên phải xe tải trước khi xe rẽ xong' },
      { id: 'opt_honk_straight', label_vi: 'Bấm còi liên tục và giữ nguyên tốc độ đi thẳng qua sườn xe' },
    ],
    rubric: {
      safe_decisions: ['opt_brake_wait'],
      acceptable_decisions: [],
      critical_hazard_decisions: ['opt_speed_pass', 'opt_honk_straight'],
      target_reaction_ms: [450, 2200],
      error_group: 'BLIND_SPOT',
      safety_principle_vi: 'Tuyệt đối không đi vào điểm mù bên phải của phương tiện trọng tải lớn khi xe chuẩn bị chuyển hướng.',
      standard_explanation_vi: 'Tài xế xe tải không thể quan sát toàn bộ phần sườn phải phía dưới qua gương. Điền vào khoảng trống khi xe đang chuyển hướng là nguyên nhân hàng đầu dẫn đến tai nạn cuốn vào gầm.',
      suggested_practice_vi: 'Luyện tập thói quen giảm tốc từ xa, quan sát đèn báo rẽ và giữ khoảng cách tối thiểu 3m phía sau xe lớn.',
    },
  },
  {
    scenario_id: 'school-gate-sudden-door',
    version: '1.0',
    title_vi: 'Mở cửa xe ô tô đột ngột trước cổng trường',
    phase_eligibility: ['PRE', 'TRAINING', 'POST'],
    vehicle_group: 'BICYCLE',
    difficulty: 1,
    approved: true,
    prompt_vi: 'Xe ô tô đưa đón học sinh dừng sát mép đường phía trước, đèn phanh vẫn sáng.',
    hazard_cue_vi: 'Bóng người bên trong đang cử động chuẩn bị đẩy cửa xe phía lòng đường.',
    options: [
      { id: 'opt_keep_distance', label_vi: 'Giảm tốc độ, bấm chuông nhẹ, mở rộng khoảng cách an toàn ít nhất 1 cánh cửa (>1m)' },
      { id: 'opt_ride_close', label_vi: 'Đi sát sườn ô tô để tránh dòng xe máy đang lao lên từ phía sau' },
      { id: 'opt_swerve_left_blind', label_vi: 'Đánh lái gấp sang làn giữa mà không quan sát gương hoặc quay đầu nhìn' },
    ],
    rubric: {
      safe_decisions: ['opt_keep_distance'],
      acceptable_decisions: [],
      critical_hazard_decisions: ['opt_ride_close', 'opt_swerve_left_blind'],
      target_reaction_ms: [400, 2500],
      error_group: 'SCHOOL_GATE',
      safety_principle_vi: 'Duy trì khoảng cách mở cửa an toàn tối thiểu 1 mét đối với mọi phương tiện đang dừng đỗ.',
      standard_explanation_vi: 'Hiện tượng dooring (mở cửa xe bất cẩn) gây chấn thương nghiêm trọng. Cần chủ động giảm tốc và phòng ngừa khi thấy xe đỗ bên đường.',
      suggested_practice_vi: 'Quan sát tín hiệu đèn, chuyển động của hành khách trong xe từ xa để giảm tốc độ trước.',
    },
  },
  {
    scenario_id: 'intersection-uncontrolled-yield',
    version: '1.0',
    title_vi: 'Giao cắt ngõ hẹp không có biển báo ưu tiên',
    phase_eligibility: ['PRE', 'TRAINING', 'POST'],
    vehicle_group: 'UNDER_50CC',
    difficulty: 2,
    approved: true,
    prompt_vi: 'Đang điều khiển xe gắn máy dưới 50cc tới ngã ba khu dân cư bị che khuất bởi tường rào cao.',
    hazard_cue_vi: 'Có tiếng động cơ và bóng xe máy khác đang tiến nhanh từ ngõ bên phải ra.',
    options: [
      { id: 'opt_slow_yield_right', label_vi: 'Giảm tốc độ dưới 20 km/h, về số thấp/rà phanh, chú ý nhường đường cho xe từ bên phải' },
      { id: 'opt_honk_rush', label_vi: 'Bấm còi to và phóng nhanh qua giao lộ để giành quyền đi trước' },
      { id: 'opt_look_only_left', label_vi: 'Chỉ nhìn sang bên trái rồi tiếp tục chạy thẳng' },
    ],
    rubric: {
      safe_decisions: ['opt_slow_yield_right'],
      acceptable_decisions: [],
      critical_hazard_decisions: ['opt_honk_rush', 'opt_look_only_left'],
      target_reaction_ms: [500, 2300],
      error_group: 'INTERSECTION_YIELD',
      safety_principle_vi: 'Tại nơi đường giao nhau không có báo hiệu đi theo vòng xuyến, phải nhường đường cho xe đến từ bên phải.',
      standard_explanation_vi: 'Giao lộ khuất tầm nhìn đòi hỏi phương tiện phải kiểm soát tốc độ dừng được an toàn. Giành đường tại điểm mù là hành vi đặc biệt nguy hiểm.',
      suggested_practice_vi: 'Tập kỹ năng rà phanh trước giao lộ và quét mắt theo thứ tự: phải - trái - phải.',
    },
  },
];

export function getScenario(scenarioId: string): ScenarioDefinition {
  const found = CANONICAL_SCENARIOS.find(s => s.scenario_id === scenarioId);
  if (!found) throw new DomainError(404, 'SCENARIO_NOT_FOUND', `Scenario not found: ${scenarioId}`);
  return found;
}

export function toPublicScenarioView(def: ScenarioDefinition): PublicScenarioView {
  return {
    scenario_id: def.scenario_id,
    version: def.version,
    title_vi: def.title_vi,
    phase_eligibility: def.phase_eligibility,
    vehicle_group: def.vehicle_group,
    difficulty: def.difficulty,
    prompt_vi: def.prompt_vi,
    hazard_cue_vi: def.hazard_cue_vi,
    options: def.options.map(opt => ({ id: opt.id, label_vi: opt.label_vi })),
  };
}

export function evaluateAttempt(params: {
  scenario: ScenarioDefinition;
  selected_decision: string;
  reaction_ms: number | null;
  phase: StudyPhase;
}): {
  outcome: ScenarioResultRecord['outcome'];
  rule_score: number;
  flags: string[];
} {
  const { scenario, selected_decision, reaction_ms } = params;
  const flags: string[] = [];

  const isValidOption = scenario.options.some(opt => opt.id === selected_decision);
  if (!isValidOption) {
    return { outcome: 'INVALID', rule_score: 0, flags: ['UNKNOWN_DECISION_ID'] };
  }

  let baseScore = 0;
  let outcome: ScenarioResultRecord['outcome'] = 'HAZARDOUS';

  if (scenario.rubric.safe_decisions.includes(selected_decision)) {
    baseScore = 100;
    outcome = 'SAFE';
  } else if (scenario.rubric.acceptable_decisions.includes(selected_decision)) {
    baseScore = 60;
    outcome = 'SUBOPTIMAL';
  } else {
    baseScore = 10;
    outcome = 'HAZARDOUS';
    flags.push('CRITICAL_HAZARD_SELECTED');
  }

  if (reaction_ms !== null) {
    if (reaction_ms < 150) {
      flags.push('SUSPICIOUS_INSTANT_REACTION');
      baseScore = Math.max(0, baseScore - 20);
    } else if (reaction_ms > 8000) {
      flags.push('REACTION_DELAYED_EXCESSIVE');
      baseScore = Math.max(0, baseScore - 15);
    } else if (reaction_ms >= scenario.rubric.target_reaction_ms[0] && reaction_ms <= scenario.rubric.target_reaction_ms[1]) {
      baseScore = Math.min(100, baseScore + 5);
    }
  } else {
    flags.push('NO_REACTION_TIME_RECORDED');
  }

  return {
    outcome,
    rule_score: Math.max(0, Math.min(100, Math.round(baseScore))),
    flags,
  };
}

export function transitionStudyRun(
  current: StudyRunRecord,
  action: { type: 'COMPLETE_PRE'; score: number } | { type: 'RECORD_TRAINING' } | { type: 'COMPLETE_POST'; score: number },
  now = new Date().toISOString(),
): StudyRunRecord {
  const updated: StudyRunRecord = { ...current, updated_at: now };

  switch (action.type) {
    case 'COMPLETE_PRE':
      if (current.pre_completed) throw new DomainError(409, 'PRE_ALREADY_COMPLETED', 'Pre-test already completed for this study run');
      updated.pre_completed = true;
      updated.pre_score = action.score;
      updated.current_phase = 'TRAINING';
      updated.state = 'TRAINING_IN_PROGRESS';
      return updated;
    case 'RECORD_TRAINING':
      updated.training_completed_count = (current.training_completed_count || 0) + 1;
      if (updated.training_completed_count >= 1 && updated.current_phase === 'TRAINING') {
        updated.current_phase = 'POST';
        updated.state = 'POST_IN_PROGRESS';
      }
      return updated;
    case 'COMPLETE_POST':
      if (!current.pre_completed) throw new DomainError(400, 'PRE_NOT_COMPLETED', 'Cannot complete post-test before pre-test');
      if (current.post_completed) throw new DomainError(409, 'POST_ALREADY_COMPLETED', 'Post-test already completed for this study run');
      updated.post_completed = true;
      updated.post_score = action.score;
      updated.state = 'COMPLETED';
      return updated;
  }
}

export function buildAssessmentRecord(params: {
  study_run_id: string;
  participant_id: string;
  phase: 'PRE' | 'POST';
  scores: number[];
  completion_time_ms: number;
  flags?: string[];
}): AssessmentRecord {
  if (!params.scores.length) {
    throw new DomainError(400, 'NO_SCORES', 'Assessment requires at least one attempt score');
  }
  const raw_score = Math.round(params.scores.reduce((a, b) => a + b, 0) / params.scores.length);
  const validity_flags = [...(params.flags || [])];
  if (params.completion_time_ms < 3000) validity_flags.push('ANOMALOUS_SPEEDRUN');
  if (params.completion_time_ms > 30 * 60 * 1000) validity_flags.push('EXCESSIVE_IDLE_TIME');

  return {
    assessment_id: `asm-${params.study_run_id.slice(0, 8)}-${params.phase.toLowerCase()}`,
    study_run_id: params.study_run_id,
    participant_id: params.participant_id,
    phase: params.phase,
    form_version: '2026-A',
    raw_score,
    normalized_score: raw_score / 100,
    completion_time_ms: params.completion_time_ms,
    validity_flags,
    created_at: new Date().toISOString(),
  };
}
