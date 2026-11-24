import { randomUUID } from 'node:crypto';
import { readParticipantFromRequest } from '../auth/session.ts';
import { buildAssessmentRecord, evaluateAttempt, getScenario, transitionStudyRun } from '../rules/engine.ts';
import { getStorageAdapter } from '../google/storage.ts';
import { DomainError, object, text, uuid } from '../validation/input.ts';
import type { DeviceClass, ScenarioResultRecord, StudyPhase } from '../types.ts';

export async function authenticatedSession(req: Request) {
  const claims = readParticipantFromRequest(req);
  const storage = getStorageAdapter();
  const session = await storage.getSession(claims.sid);
  if (!session || session.state !== 'ACTIVE' || session.participant_id !== claims.pid || session.study_run_id !== claims.srid || Date.parse(session.expires_at) <= Date.now()) {
    throw new DomainError(401, 'SESSION_INVALID', 'Participant session is no longer valid');
  }
  return { claims, storage, session };
}

export function deviceClass(value: unknown): DeviceClass {
  return ['DESKTOP', 'MOBILE', 'TABLET'].includes(String(value)) ? value as DeviceClass : 'UNKNOWN';
}

export async function submitAttempt(req: Request, raw: unknown) {
  const { claims, storage, session } = await authenticatedSession(req);
  const input = object(raw);
  const attempt_id = uuid(input.attempt_id, 'attempt_id');
  const scenario_id = text(input.scenario_id, 'scenario_id', 1, 64);
  const selected_decision = text(input.selected_decision, 'selected_decision', 1, 64);
  const phase = String(input.phase) as StudyPhase;
  if (!['PRE', 'TRAINING', 'POST'].includes(phase)) throw new DomainError(400, 'INVALID_PHASE', 'Invalid study phase');
  const clientReaction = input.reaction_ms;
  if (clientReaction !== null && clientReaction !== undefined && (!Number.isInteger(clientReaction) || Number(clientReaction) < 0 || Number(clientReaction) > 300000)) {
    throw new DomainError(400, 'INVALID_REACTION_TIME', 'Invalid reaction time');
  }
  const studyRun = await storage.getStudyRun(claims.srid);
  if (!studyRun) throw new DomainError(404, 'STUDY_RUN_NOT_FOUND', 'Study run missing');
  // A response can be lost after a successful write and phase transition.
  // Resolve retries before checking the new phase, without accepting payload changes.
  const existing = (await storage.getStudyRunAttempts(claims.srid)).find(a => a.attempt_id === attempt_id);
  if (existing) {
    if (existing.session_id !== session.session_id || existing.scenario_id !== scenario_id || existing.phase !== phase || existing.selected_decision !== selected_decision) {
      throw new DomainError(409, 'ATTEMPT_ID_CONFLICT', 'Attempt identifier was already used for another payload');
    }
    return { result: existing, duplicate: true, study_run: studyRun };
  }
  if (studyRun.current_phase !== phase) throw new DomainError(409, 'PHASE_OUT_OF_ORDER', 'Attempt phase does not match study run state');
  const scenario = getScenario(scenario_id);
  if (!scenario.approved || !scenario.phase_eligibility.includes(phase)) throw new DomainError(403, 'SCENARIO_NOT_ELIGIBLE', 'Scenario not available for this phase');

  const events = await storage.getSessionEvents(session.session_id);
  const hazard = events.find(event => event.scenario_id === scenario_id && event.type === 'HAZARD_VISIBLE');
  const decision = events.find(event => event.scenario_id === scenario_id && event.type === 'DECISION_INPUT' && event.payload.decision_id === selected_decision);
  let reaction_ms: number | null = null;
  const flags: string[] = [];
  if (hazard && decision) reaction_ms = Math.max(0, Date.parse(decision.timestamp) - Date.parse(hazard.timestamp));
  else flags.push('MISSING_VERIFIABLE_TELEMETRY');
  if (reaction_ms !== null && clientReaction !== null && clientReaction !== undefined && Math.abs(reaction_ms - Number(clientReaction)) > 250) flags.push('CLIENT_REACTION_IGNORED_SERVER_DERIVED');

  const score = evaluateAttempt({ scenario, selected_decision, reaction_ms, phase });
  const result: ScenarioResultRecord = {
    attempt_id,
    participant_id: claims.pid,
    study_run_id: claims.srid,
    session_id: session.session_id,
    phase,
    scenario_id: scenario.scenario_id,
    scenario_version: scenario.version,
    selected_decision,
    outcome: score.outcome,
    rule_score: score.rule_score,
    rule_engine_version: '2026.1-deterministic',
    reaction_ms,
    flags: [...flags, ...score.flags],
    created_at: new Date().toISOString(),
  };
  const stored = await storage.recordAttempt(result);
  if (stored.duplicate) return { result: stored.result, duplicate: true, study_run: studyRun };

  const phaseAttempts = (await storage.getStudyRunAttempts(claims.srid)).filter(a => a.phase === phase);
  let updatedRun = studyRun;
  let assessment = null;
  if (phase === 'PRE') {
    assessment = buildAssessmentRecord({ study_run_id: claims.srid, participant_id: claims.pid, phase: 'PRE', scores: phaseAttempts.map(a => a.rule_score), completion_time_ms: 0, flags: result.flags });
    await storage.recordAssessment(assessment);
    updatedRun = transitionStudyRun(studyRun, { type: 'COMPLETE_PRE', score: assessment.raw_score });
  } else if (phase === 'TRAINING') {
    updatedRun = transitionStudyRun(studyRun, { type: 'RECORD_TRAINING' });
  } else {
    assessment = buildAssessmentRecord({ study_run_id: claims.srid, participant_id: claims.pid, phase: 'POST', scores: phaseAttempts.map(a => a.rule_score), completion_time_ms: 0, flags: result.flags });
    await storage.recordAssessment(assessment);
    updatedRun = transitionStudyRun(studyRun, { type: 'COMPLETE_POST', score: assessment.raw_score });
  }
  await storage.saveStudyRun(updatedRun);
  return { result, duplicate: false, study_run: updatedRun, assessment };
}

export function newParticipantRecords(input: { full_name: string; class_name: string; school_name: string; province_city: string; privacy_notice_version?: string }) {
  const now = new Date().toISOString();
  const participant_id = randomUUID();
  const study_run_id = randomUUID();
  return {
    player: {
      participant_id,
      full_name: input.full_name,
      class_name: input.class_name,
      school_name: input.school_name,
      province_city: input.province_city,
      province_catalog_version: process.env.PROVINCE_CATALOG_VERSION || 'unconfigured-local',
      privacy_notice_version: input.privacy_notice_version || process.env.PRIVACY_NOTICE_VERSION || 'unconfigured-local',
      created_at: now,
      status: 'ACTIVE' as const,
    },
    studyRun: {
      study_run_id,
      participant_id,
      current_phase: 'PRE' as const,
      state: 'PRE_IN_PROGRESS' as const,
      pre_completed: false,
      training_completed_count: 0,
      post_completed: false,
      created_at: now,
      updated_at: now,
    },
  };
}
