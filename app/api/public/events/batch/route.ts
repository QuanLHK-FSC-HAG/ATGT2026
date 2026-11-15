import { authenticatedSession } from '../../../../../lib/api/services.ts';
import { errorResponse, json, readJson } from '../../../../../lib/api/response.ts';
import { eventBatch } from '../../../../../lib/validation/input.ts';

export async function POST(req: Request) {
  try {
    const { claims, storage, session } = await authenticatedSession(req);
    const body = await readJson(req);
    const { batch_id, events } = eventBatch(body, session.session_id);
    const { index, duplicate } = await storage.appendEventBatch(batch_id, claims.sid, events);
    return json({
      batch_id: index.batch_id,
      session_id: index.session_id,
      event_count: index.event_count,
      checksum: index.checksum,
      duplicate,
      write_status: index.write_status,
    }, { status: duplicate ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

