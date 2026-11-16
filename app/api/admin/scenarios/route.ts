import fs from 'node:fs';
import path from 'node:path';
import { requireAdmin } from '../../../../lib/auth/session.ts';
import { CANONICAL_SCENARIOS } from '../../../../lib/rules/engine.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const seedPath = path.resolve(process.cwd(), 'data/scenarios.seed.json');
    let seedScenarios: unknown[] = [];
    if (fs.existsSync(seedPath)) {
      seedScenarios = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }

    return json({
      admin_email: admin.email,
      count: seedScenarios.length || CANONICAL_SCENARIOS.length,
      canonical_count: CANONICAL_SCENARIOS.length,
      scenarios: seedScenarios.length > 0 ? seedScenarios : CANONICAL_SCENARIOS,
      canonical_scenarios: CANONICAL_SCENARIOS,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
