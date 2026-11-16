import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAdminEmail, issueAdminToken, verifyAdminToken, requireAdmin } from '../../lib/auth/session.ts';
import { POST as adminLogin } from '../../app/api/auth/admin/login/route.ts';
import { DomainError } from '../../lib/validation/input.ts';

describe('Admin Authentication & Allowlist Guard Tests', () => {
  it('allows quanlhk.01@gmail.com and maitronghuu@gmail.com', () => {
    assert.equal(isAllowedAdminEmail('quanlhk.01@gmail.com'), true);
    assert.equal(isAllowedAdminEmail('QUANLHK.01@GMAIL.COM'), true);
    assert.equal(isAllowedAdminEmail('maitronghuu@gmail.com'), true);
    assert.equal(isAllowedAdminEmail('MAITRONGHUU@GMAIL.COM'), true);
  });

  it('rejects unauthorized google accounts', () => {
    assert.equal(isAllowedAdminEmail('hacker@gmail.com'), false);
    assert.equal(isAllowedAdminEmail('student@school.edu.vn'), false);
    assert.equal(isAllowedAdminEmail(''), false);
    assert.equal(isAllowedAdminEmail(null), false);
  });

  it('authenticates allowlisted admin account', async () => {
    const res = await adminLogin(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'quanlhk.01@gmail.com' }),
      }),
    );
    assert.equal(res.status, 200);
    const data = (await res.json()) as { authenticated: boolean; admin: { email: string } };
    assert.equal(data.authenticated, true);
    assert.equal(data.admin.email, 'quanlhk.01@gmail.com');
  });

  it('rejects non-allowlisted email', async () => {
    const res = await adminLogin(
      new Request('http://localhost/api/auth/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'intruder@gmail.com' }),
      }),
    );
    assert.equal(res.status, 403);
  });

  it('issues and verifies valid admin tokens', () => {
    const issued = issueAdminToken({
      email: 'quanlhk.01@gmail.com',
      name: 'Lê Hữu Kỳ Quan',
    });
    assert.ok(issued.token.length > 20);
    assert.match(issued.cookie, /sr_admin_session=/);
    assert.match(issued.cookie, /HttpOnly/);

    const verified = verifyAdminToken(issued.token);
    assert.equal(verified.email, 'quanlhk.01@gmail.com');
    assert.equal(verified.purpose, 'admin');

    const req = new Request('http://localhost/api/admin/overview', {
      headers: { cookie: issued.cookie.split(';')[0] },
    });
    const reqAdmin = requireAdmin(req);
    assert.equal(reqAdmin.email, 'quanlhk.01@gmail.com');
  });

  it('rejects unauthorized admin issue', () => {
    assert.throws(
      () => issueAdminToken({ email: 'unauthorized@gmail.com' }),
      (err: unknown) => err instanceof DomainError && err.status === 403,
    );
  });
});
