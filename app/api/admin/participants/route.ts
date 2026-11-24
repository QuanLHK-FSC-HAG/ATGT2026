import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getAdminStorage(req);
    const snapshot = await storage.getSnapshot();
    return json({
      admin_email: admin.email,
      total: snapshot.Players.length,
      participants: snapshot.Players.map(p => ({
        participant_id: p.participant_id,
        full_name: p.full_name,
        school_name: p.school_name,
        class_name: p.class_name,
        province_city: p.province_city,
        created_at: p.created_at,
        status: p.status,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
