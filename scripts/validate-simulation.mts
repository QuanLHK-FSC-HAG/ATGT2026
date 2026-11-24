import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getScenario, evaluateAttempt } from '../lib/rules/engine.ts';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';

const snapshot: LogicalSheetsSnapshot = JSON.parse(readFileSync('.runtime/simulation/logical_store.json', 'utf8'));
const errors: Record<string, number> = {};
const fail = (key: string) => { errors[key] = (errors[key] || 0) + 1; };
for (const attempt of snapshot.ScenarioResults) {
  try {
    const scenario = getScenario(attempt.scenario_id);
    if (!scenario.phase_eligibility.includes(attempt.phase)) fail('phase_not_eligible');
    const result = evaluateAttempt({ scenario, selected_decision: attempt.selected_decision, reaction_ms: attempt.reaction_ms, phase: attempt.phase });
    if (result.rule_score !== attempt.rule_score || result.outcome !== attempt.outcome) fail('score_mismatch');
    const session = snapshot.Sessions.find(s => s.session_id === attempt.session_id);
    if (!session || (session.ended_at && Date.parse(session.ended_at) < Date.parse(attempt.created_at))) fail('session_ends_before_attempt');
  } catch { fail('unknown_scenario'); }
}
for (const batch of Object.values(snapshot.DriveEventBatches)) {
  if (createHash('sha256').update(batch.jsonl).digest('hex') !== batch.checksum) fail('checksum_mismatch');
}
console.log(JSON.stringify({ valid: Object.keys(errors).length === 0, errors, attempts: snapshot.ScenarioResults.length }));
if (Object.keys(errors).length) process.exitCode = 1;
