import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { DomainError } from '../validation/input.ts';
import { getAdminAllowlist, isHostedEnvironment } from './session.ts';

/**
 * Xác thực Google ID Token (GIS / OIDC) bằng JWKS chính thức của Google.
 *
 * Không phụ thuộc thư viện ngoài: tải bộ khóa công khai tại
 * https://www.googleapis.com/oauth2/v3/certs, cache theo Cache-Control,
 * rồi xác minh chữ ký RS256 + các claim iss/aud/exp/iat/email_verified.
 */

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_TOKEN_LENGTH = 8192;

interface GoogleJwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface KeyCache {
  keys: GoogleJwk[];
  expires_at: number;
}

let keyCache: KeyCache | null = null;

export interface GoogleIdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  nonce?: string;
  iat: number;
  exp: number;
  hd?: string;
}

export interface GoogleAuthConfig {
  configured: boolean;
  client_id: string | null;
  allow_local_login: boolean;
}

/**
 * Client ID dùng cho Google Identity Services.
 * Ưu tiên biến server-side GOOGLE_OAUTH_CLIENT_ID (đã có trong .env.example),
 * sau đó tới biến public NEXT_PUBLIC_GOOGLE_CLIENT_ID.
 */
export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  const clientId = getGoogleClientId();
  return {
    configured: Boolean(clientId),
    client_id: clientId || null,
    allow_local_login: !isHostedEnvironment() && process.env.ALLOW_LOCAL_ADMIN_LOGIN !== 'false',
  };
}

export function resetGoogleKeyCache(): void {
  keyCache = null;
}

function decodePart(part: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', `Google token không hợp lệ (${label}).`);
  }
}

function parseMaxAge(header: string | null): number {
  const match = header?.match(/max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 3600;
  return Math.min(Math.max(seconds, 60), 3600) * 1000;
}

async function fetchGoogleKeys(force = false): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (!force && keyCache && keyCache.expires_at > now) return keyCache.keys;

  let response: Response;
  try {
    response = await fetch(GOOGLE_CERTS_URL, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new DomainError(503, 'GOOGLE_KEYS_UNAVAILABLE', 'Không kết nối được tới Google để xác minh chữ ký đăng nhập. Vui lòng thử lại.');
  }

  if (!response.ok) {
    throw new DomainError(503, 'GOOGLE_KEYS_UNAVAILABLE', 'Google từ chối yêu cầu lấy khóa công khai. Vui lòng thử lại sau.');
  }

  const body = (await response.json()) as { keys?: GoogleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys.filter(key => key.kty === 'RSA' && key.n && key.e) : [];
  if (!keys.length) {
    throw new DomainError(503, 'GOOGLE_KEYS_UNAVAILABLE', 'Bộ khóa công khai của Google rỗng hoặc không hợp lệ.');
  }

  keyCache = { keys, expires_at: now + parseMaxAge(response.headers.get('cache-control')) };
  return keys;
}

function normalizeAudience(aud: unknown): string[] {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) return aud.filter((item): item is string => typeof item === 'string');
  return [];
}

export async function verifyGoogleIdToken(
  idToken: string,
  options: { clientId?: string; jwks?: GoogleJwk[]; nowMs?: number } = {},
): Promise<GoogleIdTokenClaims> {
  const clientId = (options.clientId ?? getGoogleClientId()).trim();
  if (!clientId) {
    throw new DomainError(
      503,
      'GOOGLE_AUTH_NOT_CONFIGURED',
      'Chưa cấu hình GOOGLE_OAUTH_CLIENT_ID. Hãy tạo OAuth Client ID (Web application) trên Google Cloud Console và thêm biến môi trường này.',
    );
  }
  if (!idToken || idToken.length > MAX_TOKEN_LENGTH) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Thiếu Google ID Token hợp lệ.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Google ID Token sai định dạng JWT.');
  }

  const header = decodePart(parts[0], 'header');
  if (header.alg !== 'RS256') {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Google ID Token không dùng thuật toán RS256.');
  }

  const claims = decodePart(parts[1], 'payload') as unknown as GoogleIdTokenClaims;

  const keys = options.jwks ?? (await fetchGoogleKeys());
  let jwk = keys.find(key => key.kid && key.kid === header.kid);
  if (!jwk && !options.jwks) {
    // Google xoay khóa định kỳ: tải lại một lần nếu kid chưa có trong cache.
    jwk = (await fetchGoogleKeys(true)).find(key => key.kid && key.kid === header.kid);
  }
  if (!jwk) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Không tìm thấy khóa công khai tương ứng với Google ID Token.');
  }

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({
      key: { kty: jwk.kty, n: jwk.n, e: jwk.e } as JsonWebKey,
      format: 'jwk',
    });
    signatureValid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url'),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Chữ ký số của Google ID Token không hợp lệ.');
  }

  const now = options.nowMs ?? Date.now();
  if (!GOOGLE_ISSUERS.has(String(claims.iss))) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Google ID Token không đúng nhà phát hành (iss).');
  }
  if (!normalizeAudience(claims.aud).includes(clientId)) {
    throw new DomainError(401, 'GOOGLE_TOKEN_WRONG_AUDIENCE', 'Google ID Token không được phát hành cho ứng dụng này (audience mismatch). Kiểm tra lại GOOGLE_OAUTH_CLIENT_ID.');
  }
  if (!Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= now) {
    throw new DomainError(401, 'GOOGLE_TOKEN_EXPIRED', 'Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (!Number.isSafeInteger(claims.iat) || claims.iat * 1000 > now + CLOCK_SKEW_MS) {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Thời điểm phát hành Google ID Token không hợp lệ.');
  }
  if (!claims.sub || typeof claims.sub !== 'string') {
    throw new DomainError(401, 'INVALID_GOOGLE_TOKEN', 'Google ID Token thiếu định danh người dùng (sub).');
  }
  if (!claims.email || typeof claims.email !== 'string') {
    throw new DomainError(401, 'GOOGLE_EMAIL_MISSING', 'Tài khoản Google không cung cấp email đã xác minh.');
  }
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new DomainError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Email của tài khoản Google chưa được xác minh.');
  }

  return {
    ...claims,
    email: claims.email.trim().toLowerCase(),
  };
}

/**
 * Kiểm tra nhanh allowlist để trả thông báo thân thiện trước khi phát hành cookie.
 */
export function isGoogleAdminEmailAllowed(email: string): boolean {
  return getAdminAllowlist().includes(email.trim().toLowerCase());
}
