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
      total: snapshot.Sessions.length,
      sessions: snapshot.Sessions,
      event_batches: snapshot.EventsIndex,
      ai_logs: snapshot.AIAnalysis,
      system_logs: snapshot.SystemLogs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
