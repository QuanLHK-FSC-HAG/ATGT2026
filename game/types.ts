export type GameAction = 'BRAKE' | 'SIGNAL' | 'YIELD' | 'PAUSE' | 'RESUME' | 'HAZARD_VISIBLE';
export type Phase = 'PRE' | 'TRAINING' | 'POST';
import type { ScenarioInteractionSpec, ScenarioVisualSpec } from '../lib/types';

export type Scenario = {
  scenario_id: string;
  version: string;
  title_vi: string;
  prompt_vi: string;
  hazard_cue_vi: string;
  options: { id: string; label_vi: string }[];
  npc_element?: string;
  trigger_event?: string;
  correct_action?: string;
  target_grade?: string;
  skill_group?: string;
  visual_spec?: ScenarioVisualSpec;
  interaction_spec?: ScenarioInteractionSpec;
};
export type AttemptResult = { rule_score: number; outcome: string; feedback?: string };
