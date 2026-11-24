import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const storage = getAdminStorage(req);
    const snapshot = await storage.getSnapshot();
    return json({
      source: new URL(req.url).searchParams.get('source') === 'simulation' ? 'SIMULATION' : 'CURRENT',
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
