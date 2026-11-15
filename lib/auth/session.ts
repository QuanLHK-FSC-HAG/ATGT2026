import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DomainError, uuid } from '../validation/input.ts';

export const PARTICIPANT_COOKIE = 'sr_participant_session';
const localSecret = randomBytes(48).toString('base64url');

export interface ParticipantSessionClaims {
  v: 1;
  purpose: 'participant';
  sid: string;
  pid: string;
  srid: string;
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

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(`saferide.participant.v1:${payload}`).digest('base64url');
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

export function requireAdmin(_req: Request): never {
  throw new DomainError(401, 'ADMIN_OIDC_NOT_CONFIGURED', 'Admin access is disabled until Google OIDC verification and server-side allowlist checks are implemented');
}
