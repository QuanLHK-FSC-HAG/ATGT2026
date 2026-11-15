import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getStorageAdapter();
    const overview = await storage.getAdminOverview();
    return json({ admin_email: admin.email, ...overview });
  } catch (error) {
    return errorResponse(error);
  }
}
