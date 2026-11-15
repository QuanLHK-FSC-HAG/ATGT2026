import { authenticatedSession } from '../../../../lib/api/services.ts';
import { generatePedagogicalFeedback } from '../../../../lib/gemini/engine.ts';
import { errorResponse, json, readJson } from '../../../../lib/api/response.ts';

export async function POST(req: Request) {
  try {
    const { claims, storage } = await authenticatedSession(req);
    const body = await readJson(req);
    const feedback = await generatePedagogicalFeedback(body, { pseudonymousSeed: claims.pid });
    await storage.recordAIAnalysis(feedback);
    return json({
      scenario_id: feedback.scenario_id,
      status: feedback.status,
      model_version: feedback.model_version,
      error_explanation: feedback.error_explanation,
      safety_principle: feedback.safety_principle,
      suggested_practice: feedback.suggested_practice,
      limitations: feedback.confidence_limitations,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
