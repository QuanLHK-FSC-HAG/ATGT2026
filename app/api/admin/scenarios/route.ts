import { requireAdmin } from '../../../../lib/auth/session.ts';
import { CANONICAL_SCENARIOS } from '../../../../lib/rules/engine.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    return json({
      admin_email: admin.email,
      count: CANONICAL_SCENARIOS.length,
      scenarios: CANONICAL_SCENARIOS,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
