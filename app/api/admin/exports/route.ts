import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getStorageAdapter();
    const snapshot = await storage.getSnapshot();
    const csvRows = [
      ['study_run_id', 'participant_id', 'phase', 'raw_score', 'completion_time_ms', 'created_at'].join(','),
      ...snapshot.Assessments.map(a =>
        [a.study_run_id, a.participant_id, a.phase, a.raw_score, a.completion_time_ms, `"${a.created_at}"`].join(','),
      ),
    ].join('\n');
    return new Response(csvRows, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="saferide-paired-assessments.csv"',
        'x-admin-email': admin.email,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
