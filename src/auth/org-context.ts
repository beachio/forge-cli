import { getStoredCredentials } from './token-store.js';
import { ValidationError } from '../utils/errors.js';

export const ORG_OPTION_DESCRIPTION =
  'Organisation ID for site lookup (use "personal" or "0" for personal sites). Defaults to active org from `forge org switch`.';

export function validateOrgOption(org: string | undefined): void {
  if (org !== undefined && org !== 'personal' && org !== '0' && Number.isNaN(parseInt(org, 10))) {
    throw new ValidationError('--org must be a numeric ID, "personal", or "0".', {});
  }
}

/** Resolve org for API calls: explicit flag wins, then stored org context. */
export function resolveOrganisationId(
  explicitOrg?: string | number | null,
): string | number | undefined {
  if (explicitOrg !== undefined && explicitOrg !== null) {
    return explicitOrg;
  }
  const stored = getStoredCredentials();
  if (stored?.organisation_id != null) {
    return stored.organisation_id;
  }
  return undefined;
}

export function organisationIdToQueryValue(orgId: string | number): string {
  if (orgId === 'personal' || orgId === 0 || orgId === '0') return '0';
  return String(orgId);
}

export function organisationIdToQuery(
  orgId: string | number | undefined,
): Record<string, string> | undefined {
  if (orgId === undefined) return undefined;
  return { organisation_id: organisationIdToQueryValue(orgId) };
}
