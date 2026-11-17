import { requireAdmin } from '../../../../../lib/auth/session.ts';
import { syncScenariosToSheets } from '../../../../../lib/google/scenario-sync.ts';
import { errorResponse, json } from '../../../../../lib/api/response.ts';

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const result = await syncScenariosToSheets();
    return json({ admin_email: admin.email, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
