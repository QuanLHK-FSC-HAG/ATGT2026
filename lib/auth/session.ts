import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DomainError, uuid } from '../validation/input.ts';

export const PARTICIPANT_COOKIE = 'sr_participant_session';
export const ADMIN_COOKIE = 'sr_admin_session';

export const DEFAULT_ADMIN_ALLOWLIST = [
  'quanlhk.01@gmail.com',
  'maitronghuu@gmail.com',
];

const localSecret = randomBytes(48).toString('base64url');
const localAdminSecret = randomBytes(48).toString('base64url');

export interface ParticipantSessionClaims {
  v: 1;
  purpose: 'participant';
  sid: string;
  pid: string;
  srid: string;
  iat: number;
  exp: number;
}

export interface AdminSessionClaims {
  v: 1;
  purpose: 'admin';
  email: string;
  name?: string;
  picture?: string;
  auth_method: 'google_oidc' | 'google_allowlist_session';
  iat: number;
  exp: number;
}

export function isHostedEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || Boolean(process.env.K_SERVICE) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function secret(): string {
  const configured = process.env.PARTICIPANT_SESSION_SECRET?.trim();
  if (configured && Buffer.byteLength(configured) >= 32) return configured;
  if (isHostedEnvironment()) throw new DomainError(503, 'AUTH_SECRET_MISSING', 'A strong participant session secret is required');
  return localSecret;
}

function adminSecret(): string {
  const configured = (process.env.ADMIN_SESSION_SECRET || process.env.PARTICIPANT_SESSION_SECRET)?.trim();
  if (configured && Buffer.byteLength(configured) >= 32) return configured;
  // Trên môi trường serverless (Vercel/Cloud Run/Lambda), secret ngẫu nhiên theo
  // từng instance sẽ khiến cookie vừa phát hành không thể xác minh ở request sau.
  // Fail-closed với thông báo rõ ràng thay vì đăng nhập "thành công rồi mất phiên".
  if (isHostedEnvironment()) {
    throw new DomainError(
      503,
      'ADMIN_SESSION_SECRET_MISSING',
      'ADMIN_SESSION_SECRET chưa được cấu hình (tối thiểu 32 ký tự). Không thể cấp phiên đăng nhập quản trị an toàn.',
    );
  }
  return localAdminSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(`saferide.participant.v1:${payload}`).digest('base64url');
}

function signAdmin(payload: string): string {
  return createHmac('sha256', adminSecret()).update(`saferide.admin.v1:${payload}`).digest('base64url');
}

export function getAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST?.trim();
  const list = raw
    ? raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];
  const merged = new Set<string>([...DEFAULT_ADMIN_ALLOWLIST.map(e => e.toLowerCase()), ...list]);
  return Array.from(merged);
}

export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminAllowlist().includes(normalized);
}

export function issueParticipantToken(ids: { session_id: string; participant_id: string; study_run_id: string }, ttlSeconds = 7200, nowMs = Date.now()): { token: string; cookie: string; expires_at: string } {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86400) throw new DomainError(500, 'INVALID_SESSION_TTL', 'Invalid session lifetime');
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ v: 1, purpose: 'participant', sid: uuid(ids.session_id, 'session_id'), pid: uuid(ids.participant_id, 'participant_id'), srid: uuid(ids.study_run_id, 'study_run_id'), iat, exp } satisfies ParticipantSessionClaims)).toString('base64url');
  const token = `${body}.${sign(body)}`;
  const secure = isHostedEnvironment() ? '; Secure' : '';
  return { token, cookie: `${PARTICIPANT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secure}`, expires_at: new Date(exp * 1000).toISOString() };
}

export function clearParticipantCookie(): string {
  return `${PARTICIPANT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHostedEnvironment() ? '; Secure' : ''}`;
}

export function verifyParticipantToken(token: string | undefined | null, nowMs = Date.now()): ParticipantSessionClaims {
  if (!token || token.length > 2048) throw new DomainError(401, 'UNAUTHORIZED', 'Missing participant session');
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(body)) throw new DomainError(401, 'UNAUTHORIZED', 'Malformed session token');
  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new DomainError(401, 'UNAUTHORIZED', 'Invalid session signature');
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ParticipantSessionClaims;
    if (claims.v !== 1 || claims.purpose !== 'participant' || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat * 1000 > nowMs + 30000 || claims.exp <= claims.iat || claims.exp - claims.iat > 86400) throw new Error('Invalid claims');
    if (claims.exp * 1000 <= nowMs) throw new DomainError(401, 'SESSION_EXPIRED', 'Participant session expired');
    uuid(claims.sid, 'sid');
    uuid(claims.pid, 'pid');
    uuid(claims.srid, 'srid');
    return claims;
  } catch (error) {
    if (error instanceof DomainError && error.code === 'SESSION_EXPIRED') throw error;
    throw new DomainError(401, 'UNAUTHORIZED', 'Invalid session payload');
  }
}

export function readParticipantFromRequest(req: Request): ParticipantSessionClaims {
  const matches = (req.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${PARTICIPANT_COOKIE}=`));
  if (matches.length !== 1) throw new DomainError(401, 'UNAUTHORIZED', 'Missing or ambiguous participant cookie');
  return verifyParticipantToken(matches[0].slice(PARTICIPANT_COOKIE.length + 1));
}

export function issueAdminToken(
  admin: { email: string; name?: string; picture?: string; auth_method?: 'google_oidc' | 'google_allowlist_session' },
  ttlSeconds = 28800,
  nowMs = Date.now(),
): { token: string; cookie: string; expires_at: string; claims: AdminSessionClaims } {
  const normalizedEmail = admin.email.trim().toLowerCase();
  if (!isAllowedAdminEmail(normalizedEmail)) {
    throw new DomainError(403, 'ADMIN_NOT_IN_ALLOWLIST', `Tài khoản Google (${normalizedEmail}) không nằm trong danh sách Quản trị viên được cấp quyền.`);
  }
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttlSeconds;
  const claims: AdminSessionClaims = {
    v: 1,
    purpose: 'admin',
    email: normalizedEmail,
    name: admin.name,
    picture: admin.picture,
    auth_method: admin.auth_method || 'google_oidc',
    iat,
    exp,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const token = `${body}.${signAdmin(body)}`;
  const secure = isHostedEnvironment() ? '; Secure' : '';
  return {
    token,
    cookie: `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secure}`,
    expires_at: new Date(exp * 1000).toISOString(),
    claims,
  };
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHostedEnvironment() ? '; Secure' : ''}`;
}

export function verifyAdminToken(token: string | undefined | null, nowMs = Date.now()): AdminSessionClaims {
  if (!token || token.length > 2048) throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Missing admin session');
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Malformed admin token');
  }
  const expected = Buffer.from(signAdmin(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Invalid admin signature');
  }
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminSessionClaims;
    if (
      claims.v !== 1 ||
      claims.purpose !== 'admin' ||
      !claims.email ||
      !isAllowedAdminEmail(claims.email) ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp * 1000 <= nowMs
    ) {
      throw new Error('Invalid or expired admin claims');
    }
    return claims;
  } catch {
    throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Invalid or expired admin session');
  }
}

export function requireAdmin(req: Request): AdminSessionClaims {
  const cookies = (req.headers.get('cookie') ?? '')
    .split(';')
    .map(part => part.trim())
    .filter(part => part.startsWith(`${ADMIN_COOKIE}=`));
  if (cookies.length === 1) {
    return verifyAdminToken(cookies[0].slice(ADMIN_COOKIE.length + 1));
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    return verifyAdminToken(bearer);
  }
  throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Admin access requires verified Google OAuth login from an allowlisted account');
}
