import { authenticatedSession } from '../../../../lib/api/services.ts';
import { CANONICAL_SCENARIOS, toPublicScenarioView } from '../../../../lib/rules/engine.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const { storage, claims } = await authenticatedSession(req);
    const studyRun = await storage.getStudyRun(claims.srid);
    const phase = studyRun?.current_phase;
    const views = CANONICAL_SCENARIOS
      .filter(s => s.approved && (!phase || s.phase_eligibility.includes(phase)))
      .map(toPublicScenarioView);
    return json({
      phase: phase || 'PRE',
      count: views.length,
      scenarios: views,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
