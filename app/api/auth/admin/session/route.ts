import { requireAdmin, clearAdminCookie } from '../../../../../lib/auth/session.ts';
import { errorResponse, json } from '../../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    return json({
      authenticated: true,
      admin: {
        email: admin.email,
        name: admin.name || admin.email,
        picture: admin.picture || null,
        auth_method: admin.auth_method,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
