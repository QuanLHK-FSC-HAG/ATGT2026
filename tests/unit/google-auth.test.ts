import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { resetGoogleKeyCache, verifyGoogleIdToken } from '../../lib/auth/google.ts';
import { issueAdminToken } from '../../lib/auth/session.ts';
import { GET as configGet } from '../../app/api/auth/admin/config/route.ts';
import { POST as adminLogin } from '../../app/api/auth/admin/login/route.ts';
import { DomainError } from '../../lib/validation/input.ts';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid: 'test-key-id', alg: 'RS256', use: 'sig' };
const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

function signToken(
  claims: Record<string, unknown>,
  options: { kid?: string; alg?: string } = {},
): string {
  const header = Buffer.from(JSON.stringify({ alg: options.alg ?? 'RS256', typ: 'JWT', kid: options.kid ?? 'test-key-id' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'quanlhk.01@gmail.com',
    email_verified: true,
    name: 'Lê Hữu Kỳ Quan',
    iat: now - 30,
    exp: now + 3600,
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;
const originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const originalNodeEnv = process.env.NODE_ENV;
const originalAdminSecret = process.env.ADMIN_SESSION_SECRET;
const originalParticipantSecret = process.env.PARTICIPANT_SESSION_SECRET;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

after(() => {
  (globalThis as any).fetch = originalFetch;
  restoreEnv('GOOGLE_OAUTH_CLIENT_ID', originalClientId);
  restoreEnv('NODE_ENV', originalNodeEnv);
  restoreEnv('ADMIN_SESSION_SECRET', originalAdminSecret);
  restoreEnv('PARTICIPANT_SESSION_SECRET', originalParticipantSecret);
  resetGoogleKeyCache();
});

describe('Google ID Token verification (JWKS)', () => {
  it('accepts a correctly signed token with the configured audience', async () => {
    const claims = await verifyGoogleIdToken(signToken(validClaims()), {
      clientId: CLIENT_ID,
      jwks: [publicJwk],
    });
    assert.equal(claims.email, 'quanlhk.01@gmail.com');
    assert.equal(claims.sub, '1234567890');
  });

  it('rejects a token issued for a different OAuth client (audience mismatch)', async () => {
    await assert.rejects(
      () =>
        verifyGoogleIdToken(signToken(validClaims({ aud: 'another-app.apps.googleusercontent.com' })), {
          clientId: CLIENT_ID,
          jwks: [publicJwk],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'GOOGLE_TOKEN_WRONG_AUDIENCE',
    );
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    await assert.rejects(
      () =>
        verifyGoogleIdToken(signToken(validClaims({ iat: now - 7200, exp: now - 3600 })), {
          clientId: CLIENT_ID,
          jwks: [publicJwk],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'GOOGLE_TOKEN_EXPIRED',
    );
  });

  it('rejects a tampered signature and an unknown key id', async () => {
    const token = signToken(validClaims());
    const tampered = `${token.slice(0, -4)}AAAA`;
    await assert.rejects(
      () => verifyGoogleIdToken(tampered, { clientId: CLIENT_ID, jwks: [publicJwk] }),
      (err: unknown) => err instanceof DomainError && err.code === 'INVALID_GOOGLE_TOKEN',
    );
    await assert.rejects(
      () => verifyGoogleIdToken(signToken(validClaims(), { kid: 'unknown-kid' }), { clientId: CLIENT_ID, jwks: [publicJwk] }),
      (err: unknown) => err instanceof DomainError && err.code === 'INVALID_GOOGLE_TOKEN',
    );
  });

  it('rejects unverified email and untrusted issuer', async () => {
    await assert.rejects(
      () =>
        verifyGoogleIdToken(signToken(validClaims({ email_verified: false })), {
          clientId: CLIENT_ID,
          jwks: [publicJwk],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'GOOGLE_EMAIL_NOT_VERIFIED',
    );
    await assert.rejects(
      () =>
        verifyGoogleIdToken(signToken(validClaims({ iss: 'https://evil.example.com' })), {
          clientId: CLIENT_ID,
          jwks: [publicJwk],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'INVALID_GOOGLE_TOKEN',
    );
  });

  it('requires configured client id', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    await assert.rejects(
      () => verifyGoogleIdToken(signToken(validClaims()), { jwks: [publicJwk] }),
      (err: unknown) => err instanceof DomainError && err.code === 'GOOGLE_AUTH_NOT_CONFIGURED',
    );
  });
});

describe('Admin Google login route', () => {
  it('reports configuration from server environment without leaking secrets', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    const res = await configGet();
    const data = (await res.json()) as { configured: boolean; client_id: string | null; allow_local_login: boolean };
    assert.equal(data.configured, false);
    assert.equal(data.client_id, null);
    assert.equal(data.allow_local_login, true);
    assert.equal('client_secret' in data, false);
  });

  it('logs in with a valid Google ID token and sets an HttpOnly admin cookie', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = CLIENT_ID;
    resetGoogleKeyCache();
    (globalThis as any).fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes('/oauth2/v3/certs')) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    };

    const res = await adminLogin(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id_token: signToken(validClaims()) }),
      }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { authenticated: boolean; admin: { email: string; auth_method: string } };
    assert.equal(data.authenticated, true);
    assert.equal(data.admin.email, 'quanlhk.01@gmail.com');
    assert.equal(data.admin.auth_method, 'google_oidc');
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.match(cookie, /sr_admin_session=.*HttpOnly/);
  });

  it('rejects non-allowlisted Google accounts', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = CLIENT_ID;
    resetGoogleKeyCache();
    const res = await adminLogin(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id_token: signToken(validClaims({ email: 'intruder@gmail.com' })),
        }),
      }),
    );
    assert.equal(res.status, 403);
    const data = (await res.json()) as { error: { code: string } };
    assert.equal(data.error.code, 'ADMIN_NOT_ALLOWED');
  });

  it('fails closed in hosted environments without a real session secret', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.PARTICIPANT_SESSION_SECRET;
    assert.throws(
      () => issueAdminToken({ email: 'quanlhk.01@gmail.com' }),
      (err: unknown) => err instanceof DomainError && err.code === 'ADMIN_SESSION_SECRET_MISSING',
    );
    restoreEnv('NODE_ENV', originalNodeEnv);
  });
});
