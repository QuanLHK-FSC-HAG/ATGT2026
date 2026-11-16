import { clearAdminCookie } from '../../../../../lib/auth/session.ts';
import { json } from '../../../../../lib/api/response.ts';

export async function POST() {
  const cookieHeader = clearAdminCookie();
  return json(
    { success: true, message: 'Logged out successfully' },
    {
      status: 200,
      headers: {
        'set-cookie': cookieHeader,
      },
    },
  );
}
