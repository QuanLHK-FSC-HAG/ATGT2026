import { existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { requireAdmin, isHostedEnvironment } from '../auth/session.ts';
import { DomainError } from '../validation/input.ts';
import { getStorageAdapter, LocalOnlyMockFileAdapter } from './storage.ts';

/** Only authenticated local Admin requests can select the isolated simulation. */
export function getAdminStorage(req: Request) {
  requireAdmin(req);
  const source = new URL(req.url).searchParams.get('source');
  if (!source || source === 'current') return getStorageAdapter();
  if (source !== 'simulation') throw new DomainError(400, 'INVALID_SOURCE', 'Unknown data source');
  if (isHostedEnvironment()) throw new DomainError(403, 'SIMULATION_LOCAL_ONLY', 'Simulation is local-only');
  const root = resolve(process.cwd(), '.runtime');
  const path = resolve(process.cwd(), process.env.SAFERIDE_SIMULATION_FILE || '.runtime/simulation/logical_store.json');
  const within = relative(root, path);
  if (!within || within.startsWith('..') || isAbsolute(within)) throw new DomainError(403, 'INVALID_SIMULATION_PATH', 'Simulation must remain in local runtime storage');
  if (!existsSync(path)) throw new DomainError(404, 'SIMULATION_NOT_GENERATED', 'Generate local simulation first');
  return new LocalOnlyMockFileAdapter(path);
}
