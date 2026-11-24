import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.K_SERVICE || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  throw new Error('Local acceptance cannot run on a hosted environment');
}
const { values } = parseArgs({ options: {
  store: { type: 'string' },
  existing: { type: 'boolean', default: false },
}, strict: true, allowPositionals: false });
if (!values.store) throw new Error('Use --store .runtime/NEW-RUN/logical_store.json');
const runtimeRoot = resolve('.runtime');
const storePath = resolve(values.store);
const storeRelative = relative(runtimeRoot, storePath);
if (!storeRelative || storeRelative.startsWith(`..${sep}`) || !storeRelative.endsWith(`${sep}logical_store.json`)) {
  throw new Error('Store must be .runtime/NEW-RUN/logical_store.json');
}
if (values.existing) {
  if (!existsSync(storePath)) throw new Error('Existing acceptance store was not found');
  const snapshot = JSON.parse(readFileSync(storePath, 'utf8'));
  if (snapshot?.Settings?.synthetic !== true || snapshot?.Settings?.research_evidence !== false) {
    throw new Error('Existing preview store must be explicitly synthetic and non-research');
  }
} else if (existsSync(storePath) || existsSync(dirname(storePath))) {
  throw new Error('Acceptance store directory must not exist');
}
const simulationRunId = storeRelative.split(sep)[0];
const env = { ...process.env,
  SAFERIDE_LOCAL_ACCEPTANCE: 'true',
  SAFERIDE_FORCE_LOCAL_MOCK: 'true',
  SAFERIDE_LOCAL_MOCK_FILE: storePath,
  SAFERIDE_SIMULATION_FILE: storePath,
  SAFERIDE_SYNTHETIC_RUN_ID: simulationRunId,
  SAFERIDE_SYNTHETIC_SCHOOL_SOURCE: 'public cantho.edu.vn school websites; names only',
  ALLOW_LOCAL_ADMIN_LOGIN: 'true',
  ADMIN_ALLOWLIST: 'local-admin@example.test',
  ADMIN_SESSION_SECRET: randomBytes(48).toString('base64url'),
  PARTICIPANT_SESSION_SECRET: randomBytes(48).toString('base64url'),
  GEMINI_LIVE_ENABLED: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
};
// Define empty values rather than deleting them: Next must not reload real
// provider credentials from an existing .env.local during this launch.
for (const key of ['GOOGLE_OAUTH_CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_SHEETS_ID', 'GOOGLE_DRIVE_FOLDER_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64', 'GEMINI_API_KEY']) env[key] = '';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3001'], { env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
