import { buildAdminReadModel } from '../../../../lib/admin/read-model.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';

export async function GET(req: Request) {
  try {
    // getAdminStorage authenticates before resolving either current or simulation storage.
    const storage = getAdminStorage(req);
    const snapshot = await storage.getSnapshot();
    return json(buildAdminReadModel(snapshot));
  } catch (error) {
    return errorResponse(error);
  }
}
