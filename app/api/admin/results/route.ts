import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getStorageAdapter();
    const snapshot = await storage.getSnapshot();
    return json({
      admin_email: admin.email,
      total_attempts: snapshot.ScenarioResults.length,
      total_assessments: snapshot.Assessments.length,
      assessments: snapshot.Assessments,
      scenario_results: snapshot.ScenarioResults,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
