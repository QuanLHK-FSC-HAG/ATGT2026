import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getAdminStorage(req);
    const snapshot = await storage.getSnapshot();
    const playerMap = new Map(snapshot.Players.map(p => [p.participant_id, p]));

    const enrichedResults = snapshot.ScenarioResults.map(r => {
      const p = playerMap.get(r.participant_id);
      return {
        ...r,
        full_name: p?.full_name || 'Học sinh',
        school_name: p?.school_name || 'THCS/THPT',
        class_name: p?.class_name || '',
      };
    });

    const enrichedAssessments = snapshot.Assessments.map(a => {
      const p = playerMap.get(a.participant_id);
      return {
        ...a,
        full_name: p?.full_name || 'Học sinh',
        school_name: p?.school_name || 'THCS/THPT',
        class_name: p?.class_name || '',
      };
    });

    return json({
      admin_email: admin.email,
      total_attempts: snapshot.ScenarioResults.length,
      total_assessments: snapshot.Assessments.length,
      assessments: enrichedAssessments,
      scenario_results: enrichedResults,
      study_runs: snapshot.StudyRuns,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
