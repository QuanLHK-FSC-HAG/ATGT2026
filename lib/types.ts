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
