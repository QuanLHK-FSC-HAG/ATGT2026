import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedGoogleCredentials, getStorageAdapter } from '../../lib/google/storage.ts';
import { getGoogleAuthConfig } from '../../lib/auth/google.ts';
import { generatePedagogicalFeedback } from '../../lib/gemini/engine.ts';
import { syncScenariosToSheets } from '../../lib/google/scenario-sync.ts';
import { externalProvidersAreDisabled } from '../../lib/runtime/local-acceptance.ts';
import { POST as login } from '../../app/api/auth/admin/login/route.ts';

test('local acceptance isolates providers even when real-shaped config exists', async () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: 'test', SAFERIDE_LOCAL_ACCEPTANCE: 'true', GOOGLE_SHEETS_ID: 'configured', GOOGLE_DRIVE_FOLDER_ID: 'configured', GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: 'configured', GOOGLE_OAUTH_CLIENT_ID: 'configured', GEMINI_API_KEY: 'configured', GEMINI_LIVE_ENABLED: 'true' });
    for (const key of ['VERCEL', 'K_SERVICE', 'AWS_LAMBDA_FUNCTION_NAME']) delete process.env[key];
    assert.equal(hasVerifiedGoogleCredentials(), false);
    assert.equal(getStorageAdapter().mode, 'LOCAL_DEMO_MOCK');
    assert.equal(getGoogleAuthConfig().configured, false);
    const feedback = await generatePedagogicalFeedback({ scenario_id: 'blind-spot-truck-right-turn', selected_decision: 'opt_brake_wait', outcome: 'SAFE', rule_score: 100 }, {
      fetchImpl: async () => { throw new Error('External fetch must not be reached'); },
    });
    assert.equal(feedback.status, 'DETERMINISTIC_FALLBACK');
    await assert.rejects(syncScenariosToSheets(), /disabled during local acceptance/);
    const response = await login(new Request('http://localhost/api/auth/admin/login', { method: 'POST', body: JSON.stringify({ access_token: 'not-real' }) }));
    assert.equal(response.status, 403);
    Object.assign(process.env, { NODE_ENV: 'production' });
    assert.throws(externalProvidersAreDisabled, /forbidden on hosted/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
