import { DomainError } from '../validation/input.ts';
import { isHostedEnvironment } from '../auth/session.ts';

/**
 * Local acceptance is an explicit, non-hosted test mode. It prevents a machine
 * with real credentials in .env.local from contacting external providers.
 */
export function isLocalAcceptanceMode(): boolean {
  return process.env.SAFERIDE_LOCAL_ACCEPTANCE === 'true';
}

export function assertLocalAcceptanceMode(): void {
  if (isLocalAcceptanceMode() && isHostedEnvironment()) {
    throw new DomainError(503, 'LOCAL_ACCEPTANCE_FORBIDDEN_ON_HOSTED', 'Local acceptance mode is forbidden on hosted environments.');
  }
}

export function externalProvidersAreDisabled(): boolean {
  assertLocalAcceptanceMode();
  return isLocalAcceptanceMode();
}
