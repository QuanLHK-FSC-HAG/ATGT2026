export type StudyPhase = 'PRE' | 'TRAINING' | 'POST';
export type StudyRunState = 'CREATED' | 'PRE_IN_PROGRESS' | 'TRAINING_IN_PROGRESS' | 'POST_IN_PROGRESS' | 'COMPLETED';
export type SessionState = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'COMPLETED';
export type DeviceClass = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
export type StorageMode = 'GOOGLE' | 'LOCAL_DEMO_MOCK';

export interface ParticipantInput {
  full_name: string;
  class_name: string;
  school_name: string;
  province_city: string;
  privacy_notice_accepted: boolean;
  privacy_notice_version?: string;
}

export interface PlayerRecord {
  participant_id: string;
  full_name: string;
  class_name: string;
  school_name: string;
  province_city: string;
  province_catalog_version: string;
  privacy_notice_version: string;
  created_at: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
}

export interface StudyRunRecord {
  study_run_id: string;
  participant_id: string;
  current_phase: StudyPhase;
  state: StudyRunState;
  pre_completed: boolean;
  training_completed_count: number;
  post_completed: boolean;
  pre_score?: number;
  post_score?: number;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  session_id: string;
  participant_id: string;
  study_run_id: string;
  device_class: DeviceClass;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  state: SessionState;
}

export interface ScenarioDecisionOption {
  id: string;
  label_vi: string;
}

export interface ScenarioRuleRubric {
  safe_decisions: string[];
  acceptable_decisions: string[];
  critical_hazard_decisions: string[];
  target_reaction_ms: [number, number];
  error_group: 'BLIND_SPOT' | 'SPEED_DISTANCE' | 'SIGNAL_TURN' | 'SCHOOL_GATE' | 'LEGAL_AGE_HELMET' | 'INTERSECTION_YIELD';
  safety_principle_vi: string;
  standard_explanation_vi: string;
  suggested_practice_vi: string;
}

export type ScenarioSceneType =
  | 'INTERSECTION_SIGNAL'
  | 'PEDESTRIAN_CROSSING'
  | 'SCHOOL_GATE'
  | 'OPENING_DOOR'
  | 'LARGE_VEHICLE_BLIND_SPOT'
  | 'BUS_STOP'
  | 'MERGE_LANE_CHANGE'
  | 'OVERTAKING'
  | 'LOW_VISIBILITY'
  | 'SLIPPERY_ROAD'
  | 'RAILWAY_CROSSING'
  | 'ROUNDABOUT'
  | 'OBSTACLE_CONSTRUCTION'
  | 'EMERGENCY_VEHICLE'
  | 'NARROW_ROAD';

export type ScenarioHazardType =
  | 'SIGNAL_CONFLICT'
  | 'CROSSING_PEDESTRIAN'
  | 'OPENING_DOOR'
  | 'BLIND_SPOT'
  | 'VEHICLE_CONFLICT'
  | 'REDUCED_VISIBILITY'
  | 'LOW_GRIP'
  | 'BLOCKED_PATH'
  | 'RAIL_APPROACH'
  | 'PRIORITY_VEHICLE';

export interface ScenarioVisualDecisionEffect {
  action: 'STOP' | 'BRAKE' | 'YIELD' | 'SIGNAL' | 'PROCEED' | 'ACCELERATE' | 'SWERVE';
  outcome: 'SAFE_CLEARANCE' | 'CONTROLLED_STOP' | 'CONFLICT' | 'NEAR_MISS';
}

export interface ScenarioVisualSpec {
  scene_type: ScenarioSceneType;
  road_layout: 'STRAIGHT' | 'T_INTERSECTION' | 'CROSS_INTERSECTION' | 'ROUNDABOUT' | 'RAIL_CROSSING' | 'NARROW_ROAD';
  hazards: ScenarioHazardType[];
  actors: Array<'STUDENT' | 'PEDESTRIAN' | 'CAR' | 'BUS' | 'TRUCK' | 'TRAFFIC_OFFICER' | 'TRAIN' | 'EMERGENCY_VEHICLE'>;
  traffic_control: 'NONE' | 'RED' | 'YELLOW' | 'GREEN' | 'PEDESTRIAN_RED' | 'PEDESTRIAN_GREEN' | 'YIELD_SIGN' | 'STOP_SIGN' | 'OFFICER_STOP' | 'RAIL_BARRIER';
  weather: 'SUNNY' | 'RAIN' | 'FOG';
  surface: 'DRY' | 'WET' | 'MUDDY' | 'GRAVEL';
  time_of_day: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  camera: 'INTERSECTION' | 'FOLLOW_VEHICLE' | 'TOP_DOWN' | 'CINEMATIC_OVERVIEW';
  decision_effects: Record<string, ScenarioVisualDecisionEffect>;
}

export interface ScenarioDefinition {
  scenario_id: string;
  version: string;
  title_vi: string;
  phase_eligibility: StudyPhase[];
  vehicle_group: 'BICYCLE' | 'E_BIKE' | 'UNDER_50CC' | 'PEDESTRIAN' | 'MIXED_TRAFFIC';
  difficulty: 1 | 2 | 3;
  approved: boolean;
  prompt_vi: string;
  hazard_cue_vi: string;
  options: ScenarioDecisionOption[];
  rubric: ScenarioRuleRubric;
  // Mỗi dòng kich_ban_goc là một cảnh tương tác riêng biệt.
  npc_element?: string;
  trigger_event?: string;
  correct_action?: string;
  target_grade?: string;
  skill_group?: string;
  visual_spec: ScenarioVisualSpec;
}

export interface PublicScenarioView {
  scenario_id: string;
  version: string;
  title_vi: string;
  phase_eligibility: StudyPhase[];
  vehicle_group: ScenarioDefinition['vehicle_group'];
  difficulty: ScenarioDefinition['difficulty'];
  prompt_vi: string;
  hazard_cue_vi: string;
  options: ScenarioDecisionOption[];
  npc_element?: string;
  trigger_event?: string;
  correct_action?: string;
  target_grade?: string;
  skill_group?: string;
  visual_spec: ScenarioVisualSpec;
}

export interface TelemetryEvent {
  event_id: string;
  session_id: string;
  seq: number;
  timestamp: string;
  schema_version: string;
  type: 'SCENARIO_START' | 'HAZARD_VISIBLE' | 'DECISION_INPUT' | 'BRAKE' | 'SIGNAL' | 'PAUSE' | 'RESUME' | 'SCENARIO_END';
  scenario_id: string;
  payload: Record<string, string | number | boolean | null>;
}

export interface EventsIndexRecord {
  batch_id: string;
  session_id: string;
  event_count: number;
  first_seq: number;
  last_seq: number;
  drive_file_id: string;
  checksum: string;
  created_at: string;
  write_status: 'COMMITTED' | 'PENDING_INDEX' | 'FAILED';
  storage_mode: StorageMode;
}

export interface ScenarioResultRecord {
  attempt_id: string;
  participant_id: string;
  study_run_id: string;
  session_id: string;
  phase: StudyPhase;
  scenario_id: string;
  scenario_version: string;
  selected_decision: string;
  outcome: 'SAFE' | 'SUBOPTIMAL' | 'HAZARDOUS' | 'INVALID';
  rule_score: number;
  rule_engine_version: string;
  reaction_ms: number | null;
  flags: string[];
  created_at: string;
}

export interface AssessmentRecord {
  assessment_id: string;
  study_run_id: string;
  participant_id: string;
  phase: 'PRE' | 'POST';
  form_version: string;
  raw_score: number;
  normalized_score: number;
  completion_time_ms: number;
  validity_flags: string[];
  created_at: string;
}

export interface AIAnalysisRecord {
  analysis_id: string;
  pseudonymous_ref: string;
  scenario_id: string;
  model_version: string;
  prompt_version: string;
  error_explanation: string;
  safety_principle: string;
  suggested_practice: string;
  confidence_limitations: string;
  status: 'LIVE_GEMINI' | 'DETERMINISTIC_FALLBACK' | 'CACHED';
  created_at: string;
}

export interface SystemLogRecord {
  log_id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';
  category: string;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
}
