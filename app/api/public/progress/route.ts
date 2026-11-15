import { authenticatedSession } from '../../../../lib/api/services.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const { claims, storage, session } = await authenticatedSession(req);
    const studyRun = await storage.getStudyRun(claims.srid);
    const attempts = await storage.getStudyRunAttempts(claims.srid);
    const snapshot = await storage.getSnapshot();
    const assessments = snapshot.Assessments.filter(a => a.study_run_id === claims.srid);
    return json({
      session_id: session.session_id,
      participant_id: claims.pid,
      study_run: studyRun,
      attempts_count: attempts.length,
      attempts: attempts.map(a => ({
        attempt_id: a.attempt_id,
        scenario_id: a.scenario_id,
        phase: a.phase,
        outcome: a.outcome,
        rule_score: a.rule_score,
        reaction_ms: a.reaction_ms,
      })),
      assessments: assessments.map(a => ({
        phase: a.phase,
        raw_score: a.raw_score,
        validity_flags: a.validity_flags,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
