import { authenticatedSession } from '../../../../lib/api/services.ts';
import { CANONICAL_SCENARIOS, toPublicScenarioView } from '../../../../lib/rules/engine.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requested = url.searchParams.get('phase');
    let phase: 'PRE' | 'TRAINING' | 'POST' | undefined =
      requested === 'PRE' || requested === 'TRAINING' || requested === 'POST' ? requested : undefined;

    // Chế độ chơi thử: không cần session, vẫn lấy ngẫu nhiên từ kho 160 kịch bản.
    try {
      const { storage, claims } = await authenticatedSession(req);
      const studyRun = await storage.getStudyRun(claims.srid);
      if (!phase) phase = studyRun?.current_phase;
    } catch {
      // public demo — dùng phase từ query hoặc để trống.
    }

    const views = CANONICAL_SCENARIOS
      .filter(s => s.scenario_id.startsWith('SCN-'))
      .filter(s => s.approved && (!phase || s.phase_eligibility.includes(phase)))
      .map(toPublicScenarioView);

    return json({ phase: phase || 'PRE', count: views.length, scenarios: views });
  } catch (error) {
    return errorResponse(error);
  }
}
