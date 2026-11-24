export type ScenarioArchetype =
  | 'TRAFFIC_CONTROL'
  | 'PEDESTRIAN_CROSSING'
  | 'SCHOOL_GATE'
  | 'OPENING_DOOR'
  | 'LARGE_VEHICLE_BLIND_SPOT'
  | 'BUS_STOP'
  | 'LANE_CHANGE_MERGE'
  | 'OVERTAKING'
  | 'WET_SLIPPERY_ROAD'
  | 'LOW_VISIBILITY'
  | 'RAILWAY_CROSSING'
  | 'ROADWORK_OBSTACLE'
  | 'EMERGENCY_VEHICLE'
  | 'INTERSECTION_YIELD'
  | 'NARROW_ROAD'
  | 'SPEED_DISTANCE'
  | 'GENERAL_ROAD_SAFETY';

export type AuditSeverity = 'BLOCKER' | 'ERROR' | 'WARNING';

export interface ScenarioSeedAuditInput {
  scenario_id?: unknown;
  scenario_title?: unknown;
  title_vi?: unknown;
  npc_element?: unknown;
  correct_action?: unknown;
  vehicle_type?: unknown;
  scenario_setup?: unknown;
  pedagogical_risk?: unknown;
  learning_objective?: unknown;
  trigger_condition?: {
    event?: unknown;
    time_of_day?: unknown;
    surface_state?: unknown;
  };
  trigger_event?: unknown;
  visual_spec?: unknown;
}

export interface ScenarioAuditIssue {
  scenario_id: string;
  severity: AuditSeverity;
  code: string;
  message: string;
}

export interface ScenarioAuditReport {
  schema_version: 1;
  scenario_count: number;
  valid: boolean;
  coverage: Record<ScenarioArchetype, number>;
  action_coverage: Record<string, number>;
  npc_coverage: Record<string, number>;
  severity_counts: Record<AuditSeverity, number>;
  issues: ScenarioAuditIssue[];
}

const ACTIONS = new Set([
  'STOP',
  'SLOW_AND_STOP',
  'SIGNAL_AND_YIELD',
  'EMERGENCY_BRAKE',
  'MAINTAIN_DISTANCE',
  'PULL_OVER_AND_YIELD',
]);

const NPCS = new Set([
  'TRAFFIC_LIGHT',
  'PEDESTRIAN',
  'FAMILY_CAR',
  'SCHOOL_OWNED_BUS',
  'SERVICE_CONTRACT_BUS',
  'TRUCK_LIGHT',
  'BUS_PUBLIC',
  'TRUCK_HEAVY',
]);

const ARCHETYPES: ScenarioArchetype[] = [
  'TRAFFIC_CONTROL',
  'PEDESTRIAN_CROSSING',
  'SCHOOL_GATE',
  'OPENING_DOOR',
  'LARGE_VEHICLE_BLIND_SPOT',
  'BUS_STOP',
  'LANE_CHANGE_MERGE',
  'OVERTAKING',
  'WET_SLIPPERY_ROAD',
  'LOW_VISIBILITY',
  'RAILWAY_CROSSING',
  'ROADWORK_OBSTACLE',
  'EMERGENCY_VEHICLE',
  'INTERSECTION_YIELD',
  'NARROW_ROAD',
  'SPEED_DISTANCE',
  'GENERAL_ROAD_SAFETY',
];

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function searchable(row: ScenarioSeedAuditInput): string {
  return [
    row.scenario_title,
    row.title_vi,
    row.npc_element,
    row.correct_action,
    row.scenario_setup,
    row.pedagogical_risk,
    row.learning_objective,
    row.trigger_condition?.event || row.trigger_event,
    row.trigger_condition?.time_of_day,
    row.trigger_condition?.surface_state,
  ].map(text).join(' ').toLowerCase();
}

export function classifyScenarioArchetype(row: ScenarioSeedAuditInput): ScenarioArchetype {
  const raw = searchable(row);
  const event = text(row.trigger_condition?.event || row.trigger_event).toLowerCase();
  const npc = text(row.npc_element).toUpperCase();

  if (/rail|đường sắt|tàu hỏa|barrier/.test(raw)) return 'RAILWAY_CROSSING';
  if (/ambulance|fire_engine|police_priority|priority_convoy|xe ưu tiên|cứu (thương|hỏa)/.test(raw)) return 'EMERGENCY_VEHICLE';
  if (/door|mở cửa|dooring/.test(raw)) return 'OPENING_DOOR';
  if (/blind|điểm mù|khuất.*(xe tải|xe buýt)/.test(raw)) return 'LARGE_VEHICLE_BLIND_SPOT';
  if (/bus_stop|alighting|boarding|trạm|xuống xe|lên xe/.test(raw) && /BUS/.test(npc)) return 'BUS_STOP';
  if (/rain|wet|slip|trơn|ngập|vũng|muddy|bùn/.test(raw)) return 'WET_SLIPPERY_ROAD';
  if (/fog|night|glare|low_visibility|chói|sương|thiếu sáng|tối/.test(raw)) return 'LOW_VISIBILITY';
  if (/roadwork|construction|work_zone|obstacle|debris|ổ gà|chướng ngại|thi công/.test(raw)) return 'ROADWORK_OBSTACLE';
  if (/overtak|vượt xe|vượt bên|do_not_pass/.test(raw)) return 'OVERTAKING';
  if (/merge|lane_change|lane_signal|chuyển làn|nhập làn|làn đường/.test(raw)) return 'LANE_CHANGE_MERGE';
  if (/narrow|alley|hẻm|ngõ|cổng hẹp|đường hẹp/.test(raw)) return 'NARROW_ROAD';
  if (/intersection|yield|roundabout|ngã (ba|tư)|giao (lộ|cắt)|nhường đường/.test(raw)) return 'INTERSECTION_YIELD';
  if (/red_light|yellow_light|traffic_light|arrow|officer_stop|sign|đèn (đỏ|vàng|xanh)|biển (báo|cấm)|tín hiệu/.test(raw) || npc === 'TRAFFIC_LIGHT') return 'TRAFFIC_CONTROL';
  if (/crosswalk|pedestrian|qua đường|người đi bộ|dắt xe|stroller/.test(raw) || npc === 'PEDESTRIAN') return 'PEDESTRIAN_CROSSING';
  if (/school|student|cổng trường|học sinh|tan trường/.test(raw)) return 'SCHOOL_GATE';
  if (/speed|distance|brake|phanh|khoảng cách|tốc độ/.test(raw)) return 'SPEED_DISTANCE';
  if (/bus/.test(event) || /BUS/.test(npc)) return 'BUS_STOP';
  return 'GENERAL_ROAD_SAFETY';
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] || 0) + 1;
}

export function auditScenarioSeeds(rows: ScenarioSeedAuditInput[]): ScenarioAuditReport {
  const coverage = Object.fromEntries(ARCHETYPES.map(key => [key, 0])) as Record<ScenarioArchetype, number>;
  const actionCoverage: Record<string, number> = {};
  const npcCoverage: Record<string, number> = {};
  const issues: ScenarioAuditIssue[] = [];
  const seen = new Set<string>();

  const add = (scenarioId: string, severity: AuditSeverity, code: string, message: string) => {
    issues.push({ scenario_id: scenarioId, severity, code, message });
  };

  rows.forEach((row, index) => {
    const id = text(row.scenario_id) || `ROW-${index + 1}`;
    const title = text(row.scenario_title || row.title_vi);
    const event = text(row.trigger_condition?.event || row.trigger_event);
    const action = text(row.correct_action).toUpperCase();
    const npc = text(row.npc_element).toUpperCase();
    const raw = searchable(row);
    const hasVisualSpec = Boolean(row.visual_spec && typeof row.visual_spec === 'object');

    coverage[classifyScenarioArchetype(row)] += 1;
    increment(actionCoverage, action || 'MISSING');
    increment(npcCoverage, npc || 'MISSING');

    if (!text(row.scenario_id)) add(id, 'BLOCKER', 'MISSING_SCENARIO_ID', 'Thiếu mã tình huống.');
    else if (seen.has(id)) add(id, 'BLOCKER', 'DUPLICATE_SCENARIO_ID', 'Mã tình huống bị trùng.');
    seen.add(id);

    if (!title) add(id, 'BLOCKER', 'MISSING_TITLE', 'Thiếu tiêu đề tình huống.');
    if (!event && !hasVisualSpec) add(id, 'BLOCKER', 'MISSING_TRIGGER_EVENT', 'Thiếu sự kiện kích hoạt cảnh.');
    if (!ACTIONS.has(action) && !hasVisualSpec) add(id, 'BLOCKER', 'UNKNOWN_CORRECT_ACTION', `Hành động đúng không được hỗ trợ: ${action || 'MISSING'}.`);
    if (!NPCS.has(npc) && !hasVisualSpec) add(id, 'BLOCKER', 'UNKNOWN_NPC', `Đối tượng cảnh không được hỗ trợ: ${npc || 'MISSING'}.`);
    if (!text(row.trigger_condition?.time_of_day) && !hasVisualSpec) add(id, 'ERROR', 'MISSING_TIME_OF_DAY', 'Thiếu thời điểm để dựng ánh sáng cảnh.');
    if (!text(row.trigger_condition?.surface_state) && !hasVisualSpec) add(id, 'ERROR', 'MISSING_SURFACE_STATE', 'Thiếu trạng thái mặt đường.');

    if (/red_light|pedestrian_red|officer_stop|rail_barrier/.test(event.toLowerCase()) && !['STOP', 'SLOW_AND_STOP'].includes(action)) {
      add(id, 'ERROR', 'STOP_EVENT_ACTION_MISMATCH', 'Sự kiện yêu cầu dừng nhưng hành động đúng không phải dừng/giảm tốc và dừng.');
    }
    if (/emergency_brake|sudden|đột ngột|lao ra/.test(raw) && action === 'MAINTAIN_DISTANCE') {
      add(id, 'WARNING', 'SUDDEN_HAZARD_ACTION_REVIEW', 'Nguy cơ bất ngờ đang dùng hành động giữ khoảng cách; cần duyệt lại phản ứng trực quan.');
    }
    if (/signal_and_yield|turn|rẽ|chuyển làn|nhập làn/.test(raw) && action === 'SIGNAL_AND_YIELD' && !/signal|xi-nhan|tín hiệu/.test(raw)) {
      add(id, 'WARNING', 'SIGNAL_CUE_NOT_EXPLICIT', 'Hành động yêu cầu báo hiệu nhưng nội dung chưa nêu rõ tín hiệu.');
    }
    const visualActors = hasVisualSpec && Array.isArray((row.visual_spec as Record<string, unknown>).actors)
      ? (row.visual_spec as { actors: unknown[] }).actors.map(text)
      : [];
    if (/truck|xe tải/.test(raw) && !/TRUCK/.test(npc) && !/BUS/.test(npc) && !visualActors.includes('TRUCK')) {
      add(id, 'WARNING', 'LARGE_VEHICLE_NPC_MISMATCH', 'Nội dung có xe tải nhưng NPC chính không phải phương tiện lớn.');
    }
    if (/pedestrian|người đi bộ|qua đường/.test(raw) && npc === 'TRAFFIC_LIGHT' && !/light|đèn|tín hiệu/.test(raw)) {
      add(id, 'WARNING', 'PEDESTRIAN_NPC_MISMATCH', 'Nội dung tập trung người đi bộ nhưng NPC đang là đèn tín hiệu.');
    }
    if (!hasVisualSpec) {
      add(id, 'WARNING', 'MISSING_VISUAL_SPEC', 'Chưa có metadata hình ảnh tường minh; renderer có thể phải suy đoán từ từ khóa.');
    } else {
      const spec = row.visual_spec as Record<string, unknown>;
      if (!text(spec.scene_type) || !text(spec.road_layout)) add(id, 'ERROR', 'INCOMPLETE_VISUAL_SPEC', 'Metadata hình ảnh thiếu loại cảnh hoặc bố cục đường.');
      if (!Array.isArray(spec.hazards) || spec.hazards.length === 0) add(id, 'ERROR', 'MISSING_VISUAL_HAZARD', 'Metadata hình ảnh chưa khai báo hiểm họa.');
      if (!Array.isArray(spec.actors) || spec.actors.length === 0) add(id, 'ERROR', 'MISSING_VISUAL_ACTORS', 'Metadata hình ảnh chưa khai báo đối tượng tham gia.');
      if (!spec.decision_effects || typeof spec.decision_effects !== 'object') add(id, 'ERROR', 'MISSING_DECISION_EFFECTS', 'Metadata hình ảnh chưa mô tả phản ứng theo lựa chọn.');
    }
  });

  const severityCounts: Record<AuditSeverity, number> = { BLOCKER: 0, ERROR: 0, WARNING: 0 };
  issues.forEach(issue => { severityCounts[issue.severity] += 1; });

  return {
    schema_version: 1,
    scenario_count: rows.length,
    valid: severityCounts.BLOCKER === 0,
    coverage,
    action_coverage: actionCoverage,
    npc_coverage: npcCoverage,
    severity_counts: severityCounts,
    issues,
  };
}
