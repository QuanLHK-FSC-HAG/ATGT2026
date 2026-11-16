import { isAllowedAdminEmail, issueAdminToken, isHostedEnvironment } from '../../../../../lib/auth/session.ts';
import { verifyGoogleIdToken } from '../../../../../lib/auth/google.ts';
import { errorResponse, json } from '../../../../../lib/api/response.ts';
import { DomainError, object } from '../../../../../lib/validation/input.ts';

const ACCESS_TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}

function localLoginEnabled(): boolean {
  return !isHostedEnvironment() && process.env.ALLOW_LOCAL_ADMIN_LOGIN !== 'false';
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const input = object(raw);
    const idToken = typeof input.id_token === 'string' ? input.id_token.trim() : '';
    const accessToken = typeof input.access_token === 'string' ? input.access_token.trim() : '';
    const directEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';

    let verifiedEmail = '';
    let adminName = '';
    let adminPicture = '';
    let authMethod: 'google_oidc' | 'google_allowlist_session' = 'google_oidc';

    if (idToken) {
      // Luồng chính: Google Identity Services trả về ID Token (JWT).
      // Xác minh chữ ký RS256 bằng JWKS + audience/issuer/expiry/email_verified.
      const claims = await verifyGoogleIdToken(idToken);
      verifiedEmail = claims.email;
      adminName = claims.name || '';
      adminPicture = claims.picture || '';
    } else if (accessToken) {
      // Luồng dự phòng: Google OAuth2 access token.
      let info: GoogleUserInfo | null = null;
      try {
        const userRes = await fetch(ACCESS_TOKEN_INFO_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (userRes.ok) info = (await userRes.json()) as GoogleUserInfo;
      } catch {
        throw new DomainError(503, 'GOOGLE_USERINFO_UNAVAILABLE', 'Không kết nối được tới Google để xác minh tài khoản. Vui lòng thử lại.');
      }
      if (!info?.email || !(info.email_verified === true || info.verified_email === true)) {
        throw new DomainError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Không xác minh được email của tài khoản Google.');
      }
      verifiedEmail = info.email.trim().toLowerCase();
      adminName = info.name || '';
      adminPicture = info.picture || '';
    } else if (directEmail) {
      // Chỉ dùng khi chạy local/dev và chưa cấu hình Google Client ID.
      if (!localLoginEnabled()) {
        throw new DomainError(
          403,
          'LOCAL_LOGIN_DISABLED',
          'Đăng nhập nhanh bằng email chỉ khả dụng trên máy local. Trên môi trường triển khai bắt buộc đăng nhập Google.',
        );
      }
      verifiedEmail = directEmail;
      authMethod = 'google_allowlist_session';
    }

    if (!verifiedEmail) {
      throw new DomainError(
        400,
        'GOOGLE_ACCOUNT_REQUIRED',
        'Vui lòng đăng nhập bằng tài khoản Google Quản trị viên đã được cấp quyền.',
      );
    }

    if (!isAllowedAdminEmail(verifiedEmail)) {
      throw new DomainError(
        403,
        'ADMIN_NOT_ALLOWED',
        `Tài khoản Google (${verifiedEmail}) không có quyền truy cập. Chỉ chấp nhận: quanlhk.01@gmail.com (Lê Hữu Kỳ Quan) và maitronghuu@gmail.com (Mai Trọng Hữu).`,
      );
    }

    const defaultName =
      verifiedEmail === 'quanlhk.01@gmail.com'
        ? 'Lê Hữu Kỳ Quan'
        : verifiedEmail === 'maitronghuu@gmail.com'
          ? 'Mai Trọng Hữu'
          : verifiedEmail;

    const { cookie, claims } = issueAdminToken({
      email: verifiedEmail,
      name: adminName || defaultName,
      picture: adminPicture,
      auth_method: authMethod,
    });

    return json(
      {
        authenticated: true,
        admin: {
          email: claims.email,
          name: claims.name,
          picture: claims.picture,
          auth_method: claims.auth_method,
        },
      },
      {
        status: 200,
        headers: {
          'set-cookie': cookie,
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
