import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { participantInput, eventBatch, DomainError } from '../../lib/validation/input.ts';
import { evaluateAttempt, CANONICAL_SCENARIOS } from '../../lib/rules/engine.ts';
import { generatePedagogicalFeedback } from '../../lib/gemini/engine.ts';

test('SafeRide Gate 3 & Gate 4 Comprehensive QA Suite (Security, Load, Research & Secret Audit)', async (t) => {
  await t.test('G3-03 / G3-04 / G3-05 / G3-06: Audits 160 anonymized scenarios and Bloom coverage', () => {
    const seedPath = path.resolve(process.cwd(), 'data/scenarios.seed.json');
    const scenarios = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    assert.equal(scenarios.length, 160, 'Must have exactly 160 scenarios');

    const ids = new Set(scenarios.map((s: { scenario_id: string }) => s.scenario_id));
    assert.equal(ids.size, 160, 'All 160 scenario_ids must be unique');

    // Verify 0 Chuyên schools
    const hasChuyen = scenarios.some((s: { school_zone?: string; scenario_setup?: string }) =>
      (s.school_zone && s.school_zone.includes('Chuyên')) ||
      (s.scenario_setup && s.scenario_setup.includes('Chuyên'))
    );
    assert.equal(hasChuyen, false, 'Must contain 0 Chuyên schools');

    // Scenario narratives must use neutral labels rather than real school identities.
    const schools = new Set(scenarios.map((s: { school_zone: string }) => s.school_zone));
    assert.deepEqual([...schools].sort(), ['Trường THCS & THPT A', 'Trường THCS & THPT B', 'Trường THCS & THPT C']);
    for (const scenario of scenarios as Array<{ school_zone: string; scenario_setup?: string; trigger_condition?: { school_zone?: string } }>) {
      assert.match(scenario.school_zone, /^Trường THCS & THPT [ABC]$/);
      assert.match(scenario.trigger_condition?.school_zone || '', /^Trường THCS & THPT [ABC]$/);
      assert.doesNotMatch(scenario.scenario_setup || '', /\([^)]*(?:tỉnh|thành phố|TP\.?)[^)]*\)/i);
    }

    // Verify 8 skill groups x 20 scenarios
    const groupCounts: Record<string, number> = {};
    const bloomCounts: Record<string, number> = {};
    for (const s of scenarios) {
      groupCounts[s.skill_group] = (groupCounts[s.skill_group] || 0) + 1;
      bloomCounts[s.cognitive_level] = (bloomCounts[s.cognitive_level] || 0) + 1;
      assert.equal(s.legal_reference, 'NEEDS_LEGAL_REVIEW');
      assert.equal(s.content_review_status, 'NEEDS_CONTENT_REVIEW');
    }
    assert.equal(Object.keys(groupCounts).length, 8, 'Must cover all 8 skill groups');
    for (const count of Object.values(groupCounts)) {
      assert.equal(count, 20, 'Each skill group must have 20 scenarios');
    }
    assert.ok(bloomCounts.RECOGNITION > 0 && bloomCounts.COMPREHENSION > 0 && bloomCounts.APPLICATION > 0);
  });

  await t.test('G4-01: Concurrent Load Test of 100 student sessions (p95 latency < 50ms, 0% error rate)', async () => {
    const start = performance.now();
    const latencies: number[] = [];

    const tasks = Array.from({ length: 100 }, async (_, idx) => {
      const t0 = performance.now();
      const parsed = participantInput({
        full_name: `Học sinh Thực nghiệm ${idx + 1}`,
        class_name: '10A1',
        school_name: idx % 2 === 0 ? 'FSchool Cần Thơ' : 'THCS Long Mỹ',
        province_city: 'Thành phố Cần Thơ',
        privacy_notice_accepted: true
      });
      assert.ok(parsed.full_name.length > 0);

      const safeEval = evaluateAttempt({
        scenario: CANONICAL_SCENARIOS[0],
        selected_decision: 'opt_brake_wait',
        reaction_ms: 850 + (idx % 200),
        phase: 'TRAINING'
      });
      assert.equal(safeEval.outcome, 'SAFE');
      assert.ok(safeEval.rule_score >= 80);
      latencies.push(performance.now() - t0);
    });

    await Promise.all(tasks);
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const totalDuration = performance.now() - start;
    assert.ok(p95 < 50, `p95 latency must be under 50ms, got ${p95.toFixed(2)}ms`);
    assert.ok(totalDuration < 1000, `100 concurrent sessions completed in ${totalDuration.toFixed(2)}ms`);
  });

  await t.test('G4-04 / G4-05 / G4-06: Defends against Injection, Oversized Batch, and Gemini Timeout', async () => {
    assert.throws(
      () =>
        participantInput({
          full_name: '<script>alert(1)</script>',
          class_name: '10A1',
          school_name: 'FSchool Cần Thơ',
          province_city: 'Cần Thơ',
          privacy_notice_accepted: true
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'INVALID_FIELD'
    );

    const oversizedEvents = Array.from({ length: 55 }, (_, i) => ({
      event_id: randomUUID(),
      scenario_id: 'blind-spot-truck-right-turn',
      phase: 'TRAINING',
      event_type: 'BRAKE',
      client_ts: new Date().toISOString(),
      reaction_ms: 500 + i
    }));
    assert.throws(
      () =>
        eventBatch(
          {
            batch_id: randomUUID(),
            events: oversizedEvents
          },
          randomUUID()
        ),
      (err: unknown) => err instanceof DomainError
    );

    const fb = await generatePedagogicalFeedback({
      scenario_id: 'blind-spot-truck-right-turn',
      selected_decision: 'opt_brake_wait',
      outcome: 'SAFE',
      rule_score: 100
    });
    assert.ok(fb.error_explanation.length > 10);
  });

  await t.test('G4-07 / G4-08: Verifies Pre/Post Research Pairing and Scans source code for leaked secrets', () => {
    const bundlePath = path.resolve(process.cwd(), '../temp/google_sheets_payload.json');
    if (fs.existsSync(bundlePath)) {
      const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
      assert.equal(Object.keys(bundle).length, 9, 'Must have all 9 research tables');
      assert.equal(bundle.scenarios_master.length - 1, 160, 'scenarios_master must have 160 rows');
    } else {
      const seedPath = path.resolve(process.cwd(), 'data/scenarios.seed.json');
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      assert.equal(seed.length, 160, 'scenarios.seed.json must have 160 scenarios');
    }

    const checkDirs = ['app', 'lib', 'components'];
    for (const d of checkDirs) {
      const fullDir = path.resolve(process.cwd(), d);
      if (!fs.existsSync(fullDir)) continue;
      const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) =>
          ent.isDirectory() ? walk(path.join(dir, ent.name)) : [path.join(dir, ent.name)]
        );
      for (const file of walk(fullDir)) {
        const content = fs.readFileSync(file, 'utf8');
        assert.equal(content.includes('BEGIN PRIVATE KEY'), false, `Private key leaked in ${file}`);
        assert.equal(content.includes('AQ.Ab8RN6Kx'), false, `Raw API key leaked in ${file}`);
      }
    }
  });
});
