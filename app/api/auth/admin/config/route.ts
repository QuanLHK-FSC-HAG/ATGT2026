import { getGoogleAuthConfig } from '../../../../../lib/auth/google.ts';
import { json } from '../../../../../lib/api/response.ts';

/**
 * Cấu hình công khai cho màn hình đăng nhập quản trị.
 * Client ID của Google OAuth không phải bí mật (nó xuất hiện trong mọi request
 * đăng nhập), nên có thể trả về cho trình duyệt. Tuyệt đối không trả secret.
 */
export async function GET() {
  return json(getGoogleAuthConfig());
}
