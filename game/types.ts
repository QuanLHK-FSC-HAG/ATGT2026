export type GameAction = 'BRAKE' | 'SIGNAL' | 'YIELD' | 'PAUSE' | 'RESUME' | 'HAZARD_VISIBLE';
export type Phase = 'PRE' | 'TRAINING' | 'POST';
export type Scenario = { scenario_id: string; version: string; title_vi: string; prompt_vi: string; hazard_cue_vi: string; options: { id: string; label_vi: string }[] };
export type AttemptResult = { rule_score: number; outcome: string; feedback?: string };