import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getAdminStorage(req);
    const overview = await storage.getAdminOverview();
    return json({ admin_email: admin.email, source: new URL(req.url).searchParams.get('source') === 'simulation' ? 'SIMULATION' : 'CURRENT', ...overview });
  } catch (error) {
    return errorResponse(error);
  }
}
