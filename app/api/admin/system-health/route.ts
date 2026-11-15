import { requireAdmin } from '../../../../lib/auth/session.ts';
import { hasVerifiedGoogleCredentials } from '../../../../lib/google/storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const hasGoogle = hasVerifiedGoogleCredentials();
    const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
    return json({
      admin_email: admin.email,
      status: hasGoogle ? 'READY' : 'LOCAL_DEMO_MODE',
      connectors: {
        google_storage: {
          configured: hasGoogle,
          mode: hasGoogle ? 'GOOGLE_SHEETS_DRIVE' : 'LOCAL_DEMO_MOCK',
          notice: hasGoogle ? 'Credentials provided' : 'Local demo mock adapter active; production will fail closed.',
        },
        gemini_ai: {
          configured: hasGemini,
          fallback_mode: 'DETERMINISTIC_RULE_FALLBACK_ACTIVE',
        },
      },
      env_flags: {
        node_env: process.env.NODE_ENV || 'development',
        has_participant_secret: Boolean(process.env.PARTICIPANT_SESSION_SECRET),
        has_admin_secret: Boolean(process.env.ADMIN_SESSION_SECRET),
        admin_allowlist_count: (process.env.ADMIN_ALLOWLIST || '').split(',').filter(Boolean).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
