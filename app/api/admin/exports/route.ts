import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getAdminStorage(req);
    const snapshot = await storage.getSnapshot();
    const format = new URL(req.url).searchParams.get('format') || 'csv';
    if (!['csv', 'jsonl'].includes(format)) {
      return json({ error: 'INVALID_EXPORT_FORMAT' }, { status: 400 });
    }
    const rows = snapshot.Assessments.map(a => ({
      study_run_id: a.study_run_id,
      participant_id: a.participant_id,
      phase: a.phase,
      raw_score: a.raw_score,
      normalized_score: a.normalized_score,
      completion_time_ms: a.completion_time_ms,
      created_at: a.created_at,
      synthetic: snapshot.Settings.synthetic === true,
    }));
    if (format === 'jsonl') {
      return new Response(rows.map(row => JSON.stringify(row)).join('\n') + '\n', {
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'content-disposition': 'attachment; filename="saferide-paired-assessments.jsonl"',
          'x-admin-email': admin.email,
        },
      });
    }
    const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csvRows = [
      Object.keys(rows[0] ?? { study_run_id: '', participant_id: '', phase: '', raw_score: '', normalized_score: '', completion_time_ms: '', created_at: '', synthetic: '' }).map(csv).join(','),
      ...rows.map(row => Object.values(row).map(csv).join(',')),
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
