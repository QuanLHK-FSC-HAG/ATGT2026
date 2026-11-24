import { CANONICAL_SCENARIOS } from '../lib/rules/engine.ts';
import { auditScenarioSeeds } from '../lib/scenarios/semantic-audit.ts';

const report = auditScenarioSeeds(CANONICAL_SCENARIOS);

console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
