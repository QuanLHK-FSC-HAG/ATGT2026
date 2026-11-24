import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_SCENARIOS } from '../lib/rules/engine.ts';

const target = resolve(process.argv[2] || '');
if (!target.endsWith('logical_store.json')) throw new Error('Expected a local logical_store.json path');

const store = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown> & {
  Settings?: { synthetic?: boolean; research_evidence?: boolean };
};
if (store.Settings?.synthetic !== true || store.Settings?.research_evidence !== false) {
  throw new Error('Only a synthetic, non-research local store can be refreshed');
}

copyFileSync(target, `${target}.before-scenario-refresh`);
store.Scenarios = CANONICAL_SCENARIOS;
writeFileSync(target, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ scenarios: CANONICAL_SCENARIOS.length, backup: `${target}.before-scenario-refresh` }));
