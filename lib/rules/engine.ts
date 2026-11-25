import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DomainError } from '../validation/input.ts';
import type {
  AssessmentRecord,
  PublicScenarioView,
  ScenarioDefinition,
  ScenarioSignType,
  ScenarioVisualSpec,
  ScenarioResultRecord,
  StudyPhase,
  StudyRunRecord,
} from '../types.ts';

export const RULE_ENGINE_VERSION = '2026.1-deterministic';

type SeedRow = {
  scenario_id: string;
  version: number | string;
  target_grade?: string;
  skill_group?: string;
  cognitive_level?: string;
  vehicle_type?: string;
  scenario_title: string;
  npc_element?: string;
  correct_action?: string;
  legal_reference?: string;
  trigger_condition?: {
    event?: string;
    speed?: number;
    dist?: number;
    time_of_day?: string;
    surface_state?: string;
    group_theme?: string;
    school_zone?: string;
  };
  scenario_setup?: string;
  pedagogical_risk?: string;
  learning_objective?: string;
};

const LEGACY_SCENARIOS: ScenarioDefinition[] = [
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
    visual_spec: buildScenarioVisualSpec({
      title_vi: 'Điểm mù xe tải chuyển hướng phải gần cổng trường',
      npc_element: 'TRUCK_HEAVY',
      trigger_event: 'blind_spot_right_turn',
      correct_action: 'SLOW_AND_STOP',
      option_ids: ['opt_brake_wait', 'opt_speed_pass', 'opt_honk_straight'],
      safe_decisions: ['opt_brake_wait'],
    }),
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
    visual_spec: buildScenarioVisualSpec({
      title_vi: 'Mở cửa xe ô tô đột ngột trước cổng trường',
      npc_element: 'FAMILY_CAR',
      trigger_event: 'door_opening',
      correct_action: 'SLOW_AND_STOP',
      option_ids: ['opt_keep_distance', 'opt_ride_close', 'opt_swerve_left_blind'],
      safe_decisions: ['opt_keep_distance'],
    }),
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
    visual_spec: buildScenarioVisualSpec({
      title_vi: 'Giao cắt ngõ hẹp không có biển báo ưu tiên',
      trigger_event: 'uncontrolled_intersection_yield',
      correct_action: 'SLOW_AND_STOP',
      option_ids: ['opt_slow_yield_right', 'opt_honk_rush', 'opt_look_only_left'],
      safe_decisions: ['opt_slow_yield_right'],
    }),
  },
];

function phaseFor(row: SeedRow): StudyPhase[] {
  const level = (row.cognitive_level || '').toUpperCase();
  if (level === 'RECOGNITION') return ['PRE'];
  if (level === 'APPLICATION') return ['TRAINING'];
  if (level === 'ANALYSIS' || level === 'EVALUATION') return ['POST'];
  return ['PRE', 'TRAINING', 'POST'];
}

function difficultyFor(row: SeedRow): 1 | 2 | 3 {
  const level = (row.cognitive_level || '').toUpperCase();
  if (level === 'RECOGNITION') return 1;
  if (level === 'ANALYSIS' || level === 'EVALUATION') return 3;
  return 2;
}

function vehicleFor(row: SeedRow): ScenarioDefinition['vehicle_group'] {
  const value = (row.vehicle_type || '').toUpperCase();
  if (value.includes('STUDENT_WALKER') || value.includes('PEDESTRIAN')) return 'PEDESTRIAN';
  if (value.includes('E_BIKE') || value.includes('ELECTRIC')) return 'E_BIKE';
  if (value.includes('50') || value.includes('MOTO')) return 'UNDER_50CC';
  return 'BICYCLE';
}

function errorGroupFor(row: SeedRow): ScenarioDefinition['rubric']['error_group'] {
  const raw = `${row.npc_element || ''} ${row.trigger_condition?.event || ''} ${row.skill_group || ''} ${row.scenario_title || ''}`.toLowerCase();
  if (/truck|bus|blind|xe_tai|xe_bu|diem_mu/.test(raw)) return 'BLIND_SPOT';
  if (/speed|toc_do|phanh|khoang_cach|brake|distance|rain|mua|truon/.test(raw)) return 'SPEED_DISTANCE';
  if (/traffic_light|light|signal|den|turn|re|xin_han/.test(raw)) return 'SIGNAL_TURN';
  if (/helmet|age|mu_bao_hiem|legal|bang_lai|hoc_sinh/.test(raw)) return 'LEGAL_AGE_HELMET';
  if (/intersection|nga|yield|duong|giao_cat/.test(raw)) return 'INTERSECTION_YIELD';
  return 'SCHOOL_GATE';
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some(term => value.includes(term));
}

function signFor(title: string, event: string): ScenarioSignType | undefined {
  const t = `${title} ${event}`.toLowerCase();
  if (/crossing_guard|cầm biển dừng|biển dừng/.test(t)) return 'STOP';
  if (/no_left_turn|cấm rẽ trái/.test(t)) return 'NO_LEFT';
  if (/conditional_right_turn|rẽ phải có điều kiện/.test(t)) return 'RIGHT_TURN';
  if (/mandatory_direction|bắt buộc đi vòng/.test(t)) return 'MANDATORY';
  if (/one_way|một chiều/.test(t)) return 'ONE_WAY';
  if (/speed_hump|gờ giảm tốc/.test(t)) return 'SPEED_HUMP';
  if (/work_zone_sign|giới hạn tốc độ|biển báo giảm tốc/.test(t)) return 'SPEED_LIMIT';
  if (/lane_split|tách làn/.test(t)) return 'LANE_SPLIT';
  if (/biển khu vực trường|school_zone/.test(t)) return 'SCHOOL';
  if (/biển cảnh báo trẻ em/.test(t)) return 'CHILDREN';
  if (/sidewalk_construction|biển công trường/.test(t)) return 'CONSTRUCTION';
  if (/yield_sign|biển nhường đường/.test(t)) return 'YIELD';
  return undefined;
}

// Hướng xi-nhan của học sinh: chính học sinh là người rẽ (các event xe NPC rẽ
// thuộc về npcSignalFor). Áp dụng cả khi hành động đúng là SIGNAL_AND_YIELD
// (bật xi-nhan rồi rẽ) lẫn STOP (đang rẽ thì dừng chờ — xi-nhan vẫn bật,
// vd SCN-412A rẽ phải thì dừng cho người đi bộ, SCN-117A chờ đèn đỏ để rẽ
// phải, SCN-119A chờ ở làn rẽ trái).
const PLAYER_TURN_EVENTS = [
  'lane_arrow', 'right_turn_crosswalk', 'alley_turn', 'parent_child_turn',
  'uncontrolled_intersection', 'reversing_driveway', 'truck_blocks_turn',
  'truck_opposite_turn', 'courteous_avoidance', 'alley_courtesy',
  'turning_pedestrian', 'conditional_right_turn', 'lane_signal_off',
];

function turnFor(title: string, event: string, correctAction?: string): 'LEFT' | 'RIGHT' | undefined {
  if (!['SIGNAL_AND_YIELD', 'STOP'].includes((correctAction || '').toUpperCase())) return undefined;
  if (!PLAYER_TURN_EVENTS.includes(event.toLowerCase())) return undefined;
  const t = `${title} ${event}`.toLowerCase();
  if (/rẽ trái|left/.test(t)) return 'LEFT';
  return 'RIGHT';
}

// Xi-nhan của xe NPC (xe buýt/xe tải/ô tô đối diện đang chuyển hướng).
function npcSignalFor(title: string, event: string): 'LEFT' | 'RIGHT' | undefined {
  const t = `${title} ${event}`.toLowerCase();
  // 'roundabout_bus' (SCN-404A, xe buýt chuẩn bị rẽ ở vòng xuyến): giả định rẽ
  // phải để ra khỏi vòng xuyến — hướng rẽ không nêu rõ trong tiêu đề/sự kiện.
  if (/roundabout_bus/.test(t)) return 'RIGHT';
  if (/contract_bus_pullover|tấp vào đón/.test(t)) return 'RIGHT';
  if (/oncoming_left_turn|ô tô đối diện.*rẽ trái/.test(t)) return 'LEFT';
  if (/dump_truck_turn|xi-nhan phải/.test(t)) return 'RIGHT';
  if (/bus_leaving_stop|rời trạm/.test(t)) return 'LEFT';
  if (/yield_to_bus_stop|vào trạm/.test(t)) return 'RIGHT';
  if (/car_waiting_left|dừng chờ rẽ trái/.test(t)) return 'LEFT';
  return undefined;
}

export function buildScenarioVisualSpec(input: {
  title_vi: string;
  npc_element?: string;
  trigger_event?: string;
  correct_action?: string;
  time_of_day?: string;
  surface_state?: string;
  option_ids: string[];
  safe_decisions: string[];
}): ScenarioVisualSpec {
  const raw = `${input.title_vi} ${input.npc_element || ''} ${input.trigger_event || ''}`.toLowerCase();
  const title = (input.title_vi || '').toLowerCase();
  const event = (input.trigger_event || '').toLowerCase();

  // Thứ tự ưu tiên đã sửa: công trình được xét TRƯỚC người đi bộ/ngã tư
  // (chỉ SCN-120A dính cả hai nhóm — "Biển công trường... chiếm một phần vỉa hè",
  // npc TRAFFIC_LIGHT — và phải ra OBSTACLE_CONSTRUCTION, không phải
  // PEDESTRIAN_CROSSING/INTERSECTION_SIGNAL). 'blocked' không còn tự kích hoạt
  // nhánh công trình (SCN-106A "Đèn xanh..." → INTERSECTION_SIGNAL,
  // SCN-803A "chiếm vỉa hè" → PEDESTRIAN_CROSSING). 'biển' không còn tự kích
  // hoạt nhánh ngã tư; 'ngã ba' được tính là ngã tư (SCN-413A).
  // - pedestrian/intersection trước low_vis/slippery: các case về người đi bộ
  //   trong mưa/sương (701A/706A/710A/715A/811A) ra PEDESTRIAN_CROSSING, các case
  //   nhắc đèn/ngã tư (711A/717A/719A) ra INTERSECTION_SIGNAL.
  // - 'đèn pha' (đèn xe đối diện, SCN-714A) và 'headlight' KHÔNG kích hoạt
  //   nhánh ngã tư — 714A giữ đúng LOW_VISIBILITY (chói). /đèn pha(?!nh)/
  //   để không chặn 'đèn phanh' (SCN-619A, vẫn ra INTERSECTION_SIGNAL như cũ).
  let scene_type: ScenarioVisualSpec['scene_type'] = 'SCHOOL_GATE';
  if (includesAny(raw, ['rail', 'đường sắt', 'thanh chắn'])) scene_type = 'RAILWAY_CROSSING';
  else if (includesAny(raw, ['roundabout', 'vòng xuyến'])) scene_type = 'ROUNDABOUT';
  else if (includesAny(raw, ['door', 'mở cửa'])) scene_type = 'OPENING_DOOR';
  else if (includesAny(raw, ['blind', 'điểm mù', 'truck', 'xe tải'])) scene_type = 'LARGE_VEHICLE_BLIND_SPOT';
  else if (includesAny(raw, ['bus_stop', 'trạm xe', 'điểm dừng', 'xe buýt'])) scene_type = 'BUS_STOP';
  else if (includesAny(raw, ['emergency', 'priority', 'ưu tiên', 'cảnh sát', 'police'])) scene_type = 'EMERGENCY_VEHICLE';
  else if (includesAny(raw, ['overtak', 'vượt xe', 'vượt bên'])) scene_type = 'OVERTAKING';
  else if (includesAny(raw, ['merge', 'lane_change', 'chuyển làn', 'nhập làn'])) scene_type = 'MERGE_LANE_CHANGE';
  else if (includesAny(raw, ['construction', 'obstacle', 'chướng ngại', 'công trình', 'hàng rơi', 'loose_cargo'])) scene_type = 'OBSTACLE_CONSTRUCTION';
  else if (includesAny(raw, ['pedestrian', 'crosswalk', 'qua đường', 'người đi bộ', 'trẻ em'])) scene_type = 'PEDESTRIAN_CROSSING';
  else if (includesAny(raw, ['signal', 'giao lộ', 'ngã tư', 'ngã ba', 'yield'])
    || (/light/.test(raw) && !/headlight/.test(raw))
    || (/đèn/.test(raw) && !/đèn pha(?!nh)/.test(raw))) scene_type = 'INTERSECTION_SIGNAL';
  else if (includesAny(raw, ['fog', 'sương', 'low_visibility', 'chói', 'khuất tầm nhìn'])) scene_type = 'LOW_VISIBILITY';
  else if (includesAny(raw, ['rain', 'wet', 'mưa', 'trơn', 'puddle', 'mud'])) scene_type = 'SLIPPERY_ROAD';
  else if (includesAny(raw, ['narrow', 'ngõ hẹp', 'đường hẹp', 'cổng hẹp'])) scene_type = 'NARROW_ROAD';

  let road_layout: ScenarioVisualSpec['road_layout'] = 'STRAIGHT';
  if (scene_type === 'ROUNDABOUT') road_layout = 'ROUNDABOUT';
  else if (scene_type === 'RAILWAY_CROSSING') road_layout = 'RAIL_CROSSING';
  else if (scene_type === 'NARROW_ROAD') road_layout = 'NARROW_ROAD';
  else if (includesAny(raw, ['ngã ba', 't_intersection'])) road_layout = 'T_INTERSECTION';
  else if (scene_type === 'INTERSECTION_SIGNAL' || includesAny(raw, ['ngã tư', 'intersection', 'crosswalk'])) road_layout = 'CROSS_INTERSECTION';

  const hazards = new Set<ScenarioVisualSpec['hazards'][number]>();
  if (scene_type === 'INTERSECTION_SIGNAL') hazards.add('SIGNAL_CONFLICT');
  if (scene_type === 'PEDESTRIAN_CROSSING') hazards.add('CROSSING_PEDESTRIAN');
  if (scene_type === 'OPENING_DOOR') hazards.add('OPENING_DOOR');
  if (scene_type === 'LARGE_VEHICLE_BLIND_SPOT') hazards.add('BLIND_SPOT');
  if (scene_type === 'LOW_VISIBILITY') hazards.add('REDUCED_VISIBILITY');
  if (scene_type === 'SLIPPERY_ROAD') hazards.add('LOW_GRIP');
  if (scene_type === 'OBSTACLE_CONSTRUCTION') hazards.add('BLOCKED_PATH');
  if (scene_type === 'RAILWAY_CROSSING') hazards.add('RAIL_APPROACH');
  if (scene_type === 'EMERGENCY_VEHICLE') hazards.add('PRIORITY_VEHICLE');
  if (hazards.size === 0) hazards.add('VEHICLE_CONFLICT');

  const actors = new Set<ScenarioVisualSpec['actors'][number]>(['STUDENT']);
  if (scene_type === 'PEDESTRIAN_CROSSING' || includesAny(raw, ['pedestrian', 'người đi bộ'])) actors.add('PEDESTRIAN');
  // 'police_car' chứa 'car' nhưng là xe ưu tiên, không phải ô tô thường.
  // 'door' trần không tính là ô tô — 'bus_door_opening' là cửa xe buýt (SCN-517A).
  if (includesAny(raw, ['family_car', 'ô tô', 'xe con']) || (/car/.test(raw) && !/police_car/.test(raw))) actors.add('CAR');
  if (includesAny(raw, ['bus', 'xe buýt'])) actors.add('BUS');
  if (includesAny(raw, ['truck', 'xe tải'])) actors.add('TRUCK');
  // 'cảnh sát' là NGƯỜI điều tiết chỉ khi không phải "xe cảnh sát" (SCN-105A/415A
  // là người; SCN-808A "Xe cảnh sát phát tín hiệu ưu tiên" là xe ưu tiên).
  // 'đèn điều tiết' là đèn rẽ trái, không phải người điều tiết.
  if (includesAny(raw, ['officer', 'guard', 'tình nguyện viên']) || (/cảnh sát/.test(raw) && !/xe cảnh sát/.test(raw)) || (/điều tiết/.test(raw) && !/đèn điều tiết/.test(raw))) actors.add('TRAFFIC_OFFICER');
  if (scene_type === 'RAILWAY_CROSSING') actors.add('TRAIN');
  if ((scene_type === 'EMERGENCY_VEHICLE' || includesAny(raw, ['ambulance', 'fire_engine', 'xe cứu thương', 'xe cứu hỏa'])) && !actors.has('TRAFFIC_OFFICER')) actors.add('EMERGENCY_VEHICLE');

  // Màu đèn: suy từ sự kiện trước, rồi từ tiêu đề tiếng Việt (trước đây chỉ xét
  // sự kiện nên 12 case nhắc đèn trong tiêu đề bị bỏ qua, và 17 case không khớp
  // màu nào thì đèn tự chạy vòng). 'Đèn xanh đã hết' nghĩa là đèn đã chuyển đỏ.
  // Tiêu đề nhắc đèn mà không nêu màu (vd SCN-703A) mặc định vẽ đèn đỏ — đèn
  // đang chờ ở vạch dừng là trạng thái an toàn cần chuẩn bị dừng.
  let traffic_control: ScenarioVisualSpec['traffic_control'] = 'NONE';
  if (includesAny(event, ['pedestrian_red'])) traffic_control = 'PEDESTRIAN_RED';
  else if (includesAny(event, ['pedestrian_green'])) traffic_control = 'PEDESTRIAN_GREEN';
  else if (includesAny(event, ['yellow'])) traffic_control = 'YELLOW';
  else if (includesAny(event, ['red', 'stop_light'])) traffic_control = 'RED';
  else if (includesAny(event, ['green'])) traffic_control = 'GREEN';
  else if (includesAny(event, ['yield'])) traffic_control = 'YIELD_SIGN';
  else if (includesAny(event, ['stop_sign'])) traffic_control = 'STOP_SIGN';
  else if (includesAny(event, ['officer_stop'])) traffic_control = 'OFFICER_STOP';
  else if (scene_type === 'RAILWAY_CROSSING') traffic_control = 'RAIL_BARRIER';
  else if (title.includes('đèn người đi bộ đỏ')) traffic_control = 'PEDESTRIAN_RED';
  else if (title.includes('đèn người đi bộ xanh')) traffic_control = 'PEDESTRIAN_GREEN';
  else if (title.includes('đèn đỏ') || title.includes('đèn xanh đã hết') || title.includes('đèn xanh hết')) traffic_control = 'RED';
  else if (title.includes('đèn xanh')) traffic_control = 'GREEN';
  else if (title.includes('đèn vàng')) traffic_control = 'YELLOW';
  else if (title.includes('đèn') && title.includes('tắt')) traffic_control = 'OFF';
  else if (title.includes('không đèn') || title.includes('không có đèn')) traffic_control = 'NONE';
  // Không mặc định mọi tiêu đề nhắc 'đèn' thành đèn đỏ: 'đèn cảnh báo'/'đèn khẩn
  // cấp' là đèn xe buýt (SCN-212A/517A), 'đèn pha' là đèn xe đối diện (SCN-714A),
  // 'đèn phanh' là đèn xe phía trước (SCN-619A), 'đèn pin' là đèn cầm tay
  // (SCN-718A), 'thiếu đèn' là không có đèn (SCN-707A). Chỉ 'đèn tín hiệu'/
  // 'đèn giao thông' không nêu màu mới mặc định đỏ (SCN-703A).
  else if (/đèn tín hiệu|đèn giao thông/.test(title)) traffic_control = 'RED';

  const surfaceRaw = (input.surface_state || '').toLowerCase();
  const surface: ScenarioVisualSpec['surface'] = includesAny(surfaceRaw, ['mud', 'bùn'])
    ? 'MUDDY'
    : includesAny(surfaceRaw, ['gravel', 'sỏi']) ? 'GRAVEL'
      : includesAny(surfaceRaw, ['wet', 'ướt']) ? 'WET' : 'DRY';
  const weather: ScenarioVisualSpec['weather'] = includesAny(raw, ['fog', 'sương'])
    ? 'FOG'
    : includesAny(raw, ['rain', 'mưa']) || surface === 'WET' ? 'RAIN' : 'SUNNY';
  const timeRaw = (input.time_of_day || '').toLowerCase();
  const time_of_day: ScenarioVisualSpec['time_of_day'] = includesAny(timeRaw, ['night', 'đêm'])
    ? 'NIGHT'
    : includesAny(timeRaw, ['evening', 'chiều tối']) ? 'EVENING'
      : includesAny(timeRaw, ['afternoon', 'chiều']) ? 'AFTERNOON' : 'MORNING';

  // Đang mưa thật (vệt mưa rơi) khác với đường ướt sau mưa: chỉ vẽ mưa khi tiêu
  // đề/sự kiện nhắc mưa, trừ "sau mưa" (SCN-705A "Mặt đường ướt sau mưa" không
  // vẽ mưa). time_of_day ghi mưa (rainy_morning/heavy_rain...) KHÔNG đủ để vẽ
  // mưa — bản rà soát liệt kê các case đó vào nhóm R1 (vd SCN-605A/611A/713A:
  // đường ướt nhưng tiêu đề không nhắc mưa). 'sau cơn mưa' (SCN-709A) vẫn tính
  // là đang mưa theo quy tắc của bản rà soát (không nằm trong danh sách R1).
  const raining = weather === 'RAIN'
    && /mưa|rain/.test(`${title} ${event}`)
    && !/sau mưa|after_rain/.test(`${title} ${event}`);

  const safeAction = (input.correct_action || '').toUpperCase();
  const safeEffect: ScenarioVisualSpec['decision_effects'][string] = safeAction.includes('SIGNAL')
    ? { action: 'SIGNAL', outcome: 'SAFE_CLEARANCE' }
    : safeAction.includes('YIELD') ? { action: 'YIELD', outcome: 'SAFE_CLEARANCE' }
      : safeAction.includes('STOP') ? { action: 'STOP', outcome: 'CONTROLLED_STOP' }
        : { action: 'BRAKE', outcome: 'SAFE_CLEARANCE' };
  const decision_effects = Object.fromEntries(input.option_ids.map((id, index) => [
    id,
    input.safe_decisions.includes(id)
      ? safeEffect
      : index === 1
        ? { action: 'ACCELERATE', outcome: 'CONFLICT' }
        : { action: 'SWERVE', outcome: 'NEAR_MISS' },
  ])) as ScenarioVisualSpec['decision_effects'];

  const camera: ScenarioVisualSpec['camera'] = road_layout === 'CROSS_INTERSECTION' || road_layout === 'T_INTERSECTION'
    ? 'INTERSECTION'
    : scene_type === 'PEDESTRIAN_CROSSING' || scene_type === 'OPENING_DOOR' ? 'FOLLOW_VEHICLE'
      : scene_type === 'ROUNDABOUT' || scene_type === 'RAILWAY_CROSSING' ? 'TOP_DOWN' : 'CINEMATIC_OVERVIEW';

  return {
    scene_type,
    road_layout,
    hazards: [...hazards],
    actors: [...actors],
    traffic_control,
    weather,
    surface,
    time_of_day,
    camera,
    decision_effects,
    sign: signFor(title, event),
    turn: turnFor(title, event, input.correct_action),
    npc_signal: npcSignalFor(title, event),
    raining,
    at_school: /trường học|cổng trường|trước cổng|cạnh cổng|school/.test(raw),
    crosswalk_faded: /faded_crosswalk/.test(event) || (/vạch/.test(title) && /mờ/.test(title)),
    dual_arrow_light: event === 'left_arrow_red' || /mũi tên xanh.*rẽ trái đỏ/.test(title),
  };
}

function generateOptionsAndRubric(row: SeedRow): {
  options: { id: string; label_vi: string }[];
  safe_decisions: string[];
  critical_hazard_decisions: string[];
  safe_label: string;
} {
  const action = (row.correct_action || '').toUpperCase();
  const event = (row.trigger_condition?.event || row.npc_element || '').toLowerCase();
  const title = (row.scenario_title || '').toLowerCase();

  let safeLabel = '<strong>🛑 Giảm tốc độ</strong>, quan sát kỹ hai bên và nhường đường an toàn';
  let rushLabel = '<strong>⚡ Tăng tốc</strong> lách qua khe hẹp để không bị chậm giờ';
  let ignoreLabel = '<strong>🔔 Bấm còi to</strong> và tiếp tục di chuyển mà không rà phanh';

  if (action === 'STOP' || event.includes('red') || title.includes('đèn đỏ') || title.includes('dừng')) {
    safeLabel = '<strong>🛑 Rà phanh chủ động</strong>, dừng hẳn trước vạch và chờ tín hiệu an toàn';
    rushLabel = '<strong>⚡ Tăng ga rồ máy</strong> cố phóng qua vạch trước khi đèn đỏ bật lâu';
    ignoreLabel = '<strong>🚲 Lách qua khe hẹp</strong> giữa các xe đang dừng để vượt qua ngay';
  } else if (action === 'SLOW_AND_STOP' || event.includes('yellow') || title.includes('đèn vàng')) {
    safeLabel = '<strong>🛑 Chủ động giảm tốc</strong>, rà phanh đều tay và dừng an toàn trước vạch';
    rushLabel = '<strong>⚡ Tăng tốc đột ngột</strong> vượt qua vạch dừng khi đèn vừa chuyển vàng';
    ignoreLabel = '<strong>🔔 Giữ nguyên tốc độ</strong>, bấm còi báo hiệu và cố vượt qua giao lộ';
  } else if (event.includes('blind_spot') || title.includes('điểm mù') || title.includes('xe tải') || title.includes('xe buýt')) {
    safeLabel = '<strong>🛑 Giảm tốc, rà phanh</strong> giữ khoảng cách xa, tránh tuyệt đối vùng điểm mù';
    rushLabel = '<strong>⚡ Tăng tốc lách vào</strong> khoảng trống hẹp bên phải khi xe lớn đang rẽ';
    ignoreLabel = '<strong>🔔 Bấm còi liên tục</strong> rồi vượt song song ngay sát sườn xe lớn';
  } else if (event.includes('door') || title.includes('mở cửa')) {
    safeLabel = '<strong>🛑 Giảm tốc độ</strong>, mở rộng khoảng cách an toàn >1m với hàng xe đang đỗ';
    rushLabel = '<strong>⚡ Áp sát sườn ô tô</strong> để vượt nhanh trước khi cửa xe kịp mở rộng thêm';
    ignoreLabel = '<strong>🚲 Đánh lái gấp</strong> sang làn bên trái mà không quay đầu quan sát';
  } else if (event.includes('rain') || event.includes('wet') || title.includes('mưa') || title.includes('trơn')) {
    safeLabel = '<strong>🛑 Phanh sớm bằng cả hai phanh</strong>, hạ tốc độ và giữ khoảng cách gấp đôi';
    rushLabel = '<strong>⚡ Duy trì tốc độ cao</strong> rồi phanh gấp sát vạch làm xe dễ bị trượt ngã';
    ignoreLabel = '<strong>🚲 Đánh võng tránh vũng nước</strong> mà không bật tín hiệu xin đường';
  }

  return {
    options: [
      { id: 'opt_safe', label_vi: safeLabel },
      { id: 'opt_rush', label_vi: rushLabel },
      { id: 'opt_ignore', label_vi: ignoreLabel },
    ],
    safe_decisions: ['opt_safe'],
    critical_hazard_decisions: ['opt_rush', 'opt_ignore'],
    safe_label: safeLabel,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function anonymizedSchoolName(value: string): string {
  const compact = value.trim().replace(/\s*\([^)]*\)\s*$/, '');
  const match = compact.match(/^Trường\s+(?:THCS\s*&\s*THPT\s+)?([ABC])$/i);
  return match ? `Trường THCS & THPT ${match[1].toUpperCase()}` : compact;
}

function convertSeedRow(row: SeedRow): ScenarioDefinition {
  const objective = row.learning_objective || 'Quan sát, giảm tốc và xử lý an toàn theo tình huống.';
  const risk = row.pedagogical_risk || 'Rủi ro xung đột tại hiện trường nếu tiếp tục di chuyển.';
  const event = row.trigger_condition?.event || row.npc_element || 'tình huống giao thông';
  const zone = anonymizedSchoolName(row.trigger_condition?.school_zone || row.target_grade || 'khu vực cổng trường');

  const { options, safe_decisions, critical_hazard_decisions } = generateOptionsAndRubric(row);

  // Only trusted, generated tags are emitted. Every seed value is encoded first.
  const safeZone = escapeHtml(zone);
  const safeTitle = escapeHtml(row.scenario_title);
  // Mã sự kiện nội bộ (vd: pedestrian_green) không bao giờ hiển thị cho học sinh:
  // dùng luôn tiêu đề tiếng Việt của kịch bản thay cho mã.
  const safeRisk = escapeHtml(risk.includes(event) ? risk.replace(event, row.scenario_title) : risk);
  const safeSkillGroup = escapeHtml(row.skill_group || 'An toàn cơ bản');
  const safeLegalReference = escapeHtml(
    row.legal_reference && row.legal_reference !== 'NEEDS_LEGAL_REVIEW'
      ? row.legal_reference
      : 'Nội dung cần hội đồng chuyên môn/pháp lý rà soát trước khi sử dụng chính thức',
  );

  const richPrompt = `
    <div class="scenario-context-tag">📍 ${safeZone}</div>
    <div class="scenario-rich-prompt">
      Em đang di chuyển tại <strong>${safeZone}</strong>.
      Hiện trường ghi nhận: <mark>${safeTitle}</mark>.
    </div>
  `;

  const richHazard = `
    <span class="hazard-badge">⚠️ HIỂM HỌA</span>
    <strong>${safeRisk}</strong>.
    <br/><small>Nhóm kỹ năng: ${safeSkillGroup}</small>
  `;

  return {
    scenario_id: row.scenario_id,
    version: String(row.version || '1.0'),
    title_vi: row.scenario_title,
    phase_eligibility: phaseFor(row),
    vehicle_group: vehicleFor(row),
    difficulty: difficultyFor(row),
    approved: true,
    prompt_vi: richPrompt,
    hazard_cue_vi: richHazard,
    options,
    rubric: {
      safe_decisions,
      acceptable_decisions: [],
      critical_hazard_decisions,
      target_reaction_ms: [400, 2400],
      error_group: errorGroupFor(row),
      safety_principle_vi: objective,
      standard_explanation_vi: `
        <div class="legal-info">
          <strong>Lý do an toàn:</strong> ${safeRisk}
          <br/>
          <span class="legal-ref-tag">⚖️ Trạng thái tham chiếu</span>
          <em>${safeLegalReference}</em>.
        </div>
      `,
      suggested_practice_vi: `Luyện tập tại ${zone}: quan sát sớm "${safeTitle}", chủ động giảm tốc và giữ khoảng cách an toàn.`,
    },
    npc_element: row.npc_element,
    trigger_event: row.trigger_condition?.event,
    correct_action: row.correct_action,
    target_grade: row.target_grade,
    skill_group: row.skill_group,
    visual_spec: buildScenarioVisualSpec({
      title_vi: row.scenario_title,
      npc_element: row.npc_element,
      trigger_event: row.trigger_condition?.event,
      correct_action: row.correct_action,
      time_of_day: row.trigger_condition?.time_of_day,
      surface_state: row.trigger_condition?.surface_state,
      option_ids: options.map(option => option.id),
      safe_decisions,
    }),
  };
}


export function loadSeedScenarios(): ScenarioDefinition[] {
  try {
    const raw = readFileSync(resolve(process.cwd(), 'data/scenarios.seed.json'), 'utf8');
    const rows = JSON.parse(raw) as SeedRow[];
    if (rows.length) return rows.map(convertSeedRow);
  } catch {
    // Fall back to curated legacy set when seed file is unavailable.
  }
  return LEGACY_SCENARIOS;
}

export const SEED_PLAYABLE_SCENARIOS: ScenarioDefinition[] = loadSeedScenarios();
export const CANONICAL_SCENARIOS: ScenarioDefinition[] = [...LEGACY_SCENARIOS, ...SEED_PLAYABLE_SCENARIOS];

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
    npc_element: def.npc_element,
    trigger_event: def.trigger_event,
    correct_action: def.correct_action,
    target_grade: def.target_grade,
    skill_group: def.skill_group,
    visual_spec: def.visual_spec,
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
    const [minMs, maxMs] = scenario.rubric.target_reaction_ms;
    if (reaction_ms < minMs) {
      flags.push('TOO_FAST_REACTION');
      baseScore = Math.max(0, baseScore - 15);
    } else if (reaction_ms > maxMs + 5000) {
      flags.push('HESITANT_REACTION');
      baseScore = Math.max(0, baseScore - 10);
    }
  }

  return {
    outcome,
    rule_score: baseScore,
    flags,
  };
}

export function transitionStudyRun(
  current: StudyRunRecord,
  action:
    | { type: 'COMPLETE_PRE'; score: number }
    | { type: 'RECORD_TRAINING' }
    | { type: 'COMPLETE_POST'; score: number },
): StudyRunRecord {
  const now = new Date().toISOString();
  if (action.type === 'COMPLETE_PRE') {
    return {
      ...current,
      current_phase: 'TRAINING',
      state: 'TRAINING_IN_PROGRESS',
      pre_completed: true,
      pre_score: action.score,
      updated_at: now,
    };
  }
  if (action.type === 'RECORD_TRAINING') {
    return {
      ...current,
      current_phase: 'POST',
      state: 'POST_IN_PROGRESS',
      training_completed_count: current.training_completed_count + 1,
      updated_at: now,
    };
  }
  if (action.type === 'COMPLETE_POST') {
    if (!current.pre_completed) {
      throw new DomainError(400, 'PRE_NOT_COMPLETED', 'Cannot complete post-test before pre-test.');
    }
    return {
      ...current,
      state: 'COMPLETED',
      post_completed: true,
      post_score: action.score,
      updated_at: now,
    };
  }
  return current;
}

export function buildAssessmentRecord(params: {
  study_run_id: string;
  participant_id: string;
  phase: 'PRE' | 'POST';
  scores: number[];
  completion_time_ms: number;
  flags: string[];
}): AssessmentRecord {
  const raw_score = params.scores.length
    ? Math.round(params.scores.reduce((a, b) => a + b, 0) / params.scores.length)
    : 0;
  return {
    assessment_id: randomUUID(),
    study_run_id: params.study_run_id,
    participant_id: params.participant_id,
    phase: params.phase,
    form_version: RULE_ENGINE_VERSION,
    raw_score,
    normalized_score: raw_score,
    completion_time_ms: params.completion_time_ms,
    validity_flags: params.flags,
    created_at: new Date().toISOString(),
  };
}

