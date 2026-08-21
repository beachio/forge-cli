import { getStoredCredentials, type StoredCredentials } from './token-store.js';
import { readForgeConfig } from '../config/forge-config.js';
import { AuthError } from '../utils/errors.js';
import { organisationIdToQuery, resolveOrganisationId } from './org-context.js';
import { siteNotInAccountMessage } from '../utils/site-url-messages.js';

export interface AuthContext {
  token: string;
  tokenType: 'cli' | 'site';
  source: 'flag' | 'env' | 'config' | 'stored';
}

export interface ResolveOptions {
  token?: string;
  siteToken?: string;
}

export function resolveAuth(options: ResolveOptions = {}): AuthContext {
  if (options.token) {
    return { token: options.token, tokenType: 'cli', source: 'flag' };
  }
  if (options.siteToken) {
    return { token: options.siteToken, tokenType: 'site', source: 'flag' };
  }

  const envToken = process.env.FORGE_TOKEN;
  if (envToken) {
    return { token: envToken, tokenType: 'cli', source: 'env' };
  }

  const envSiteToken = process.env.FORGE_SITE_TOKEN;
  if (envSiteToken) {
    return { token: envSiteToken, tokenType: 'site', source: 'env' };
  }

  const config = readForgeConfig();
  if (config?.site_token) {
    return { token: config.site_token, tokenType: 'site', source: 'config' };
  }

  const stored = getStoredCredentials();
  if (stored) {
    return { token: stored.token, tokenType: stored.token_type, source: 'stored' };
  }

  throw new AuthError('Not authenticated. Run `forge login` to get started.');
}

export function findSiteTokenByName(
  siteName: string,
  siteTokens: Record<string, string>,
): string | undefined {
  const normalised = siteName.toLowerCase().replace(/\s+/g, '');

  const direct = siteTokens[siteName] || siteTokens[normalised];
  if (direct) return direct;

  for (const [url, token] of Object.entries(siteTokens)) {
    const urlLower = url.toLowerCase();
    if (
      urlLower === normalised ||
      urlLower === `${normalised}.getforge.io` ||
      urlLower.startsWith(`${normalised}.`)
    ) {
      return token;
    }
  }
  return undefined;
}

export function normalizeSiteName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\/+$/, '');
}

export function siteNameMatches(targetSite: string, candidateUrl: string): boolean {
  const target = normalizeSiteName(targetSite);
  const candidate = normalizeSiteName(candidateUrl);
  if (!target || !candidate) return false;

  const variants = new Set<string>([target]);
  if (target.endsWith('.getforge.io')) {
    variants.add(target.slice(0, -'.getforge.io'.length));
  } else {
    variants.add(`${target}.getforge.io`);
  }

  for (const variant of variants) {
    if (candidate === variant || candidate.startsWith(`${variant}.`)) {
      return true;
    }
  }

  return false;
}

export type SiteTokenLookupEntry = {
  url: string;
  site_token?: string;
};

export function extractSiteTokenLookupEntries(raw: unknown): SiteTokenLookupEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') {
          return { url: item };
        }
        if (!item || typeof item !== 'object') return undefined;

        const candidate = item as Record<string, unknown>;
        if (typeof candidate.url === 'string') {
          return {
            url: candidate.url,
            site_token: typeof candidate.site_token === 'string' ? candidate.site_token : undefined,
          };
        }

        if (candidate.site && typeof candidate.site === 'object') {
          const nested = candidate.site as Record<string, unknown>;
          if (typeof nested.url === 'string') {
            return {
              url: nested.url,
              site_token: typeof nested.site_token === 'string' ? nested.site_token : undefined,
            };
          }
        }

        return undefined;
      })
      .filter((entry): entry is SiteTokenLookupEntry => Boolean(entry));
  }

  if (raw && typeof raw === 'object' && 'sites' in raw) {
    const response = raw as { sites?: unknown };
    return extractSiteTokenLookupEntries(response.sites);
  }

  return [];
}

export type SiteTokenSource =
  | 'flag'
  | 'env'
  | 'config'
  | 'login_cache'
  | 'api_lookup'
  | 'none';

export function getLocalSiteTokenSource(options: {
  siteToken?: string;
  site?: string;
}): { token?: string; source: SiteTokenSource } {
  if (options.siteToken) {
    return { token: options.siteToken, source: 'flag' };
  }

  const envSiteToken = process.env.FORGE_SITE_TOKEN;
  if (envSiteToken) {
    return { token: envSiteToken, source: 'env' };
  }

  const config = readForgeConfig();
  if (config?.site_token) {
    return { token: config.site_token, source: 'config' };
  }

  const stored = getStoredCredentials();
  const siteName = options.site || config?.site;
  if (stored?.site_tokens && siteName) {
    const found = findSiteTokenByName(siteName, stored.site_tokens);
    if (found) {
      return { token: found, source: 'login_cache' };
    }
  }

  return { source: 'none' };
}

export function resolveSiteToken(options: ResolveOptions = {}): string {
  const local = getLocalSiteTokenSource(options);
  if (local.token) return local.token;

  throw new AuthError(
    'No site token found locally. Provide --site-token, set FORGE_SITE_TOKEN, add site_token to forge.json, or run `forge add <site>` to cache one with your CLI token.',
  );
}

export async function fetchSiteList(options: {
  token?: string;
  organisationId?: string | number | null;
}): Promise<SiteTokenLookupEntry[]> {
  const auth = resolveAuth({ token: options.token });
  const { getApiClient } = await import('../api/client.js');
  const { API_PATHS } = await import('../config/constants.js');
  const client = getApiClient();
  const orgId = resolveOrganisationId(options.organisationId);
  const query = organisationIdToQuery(orgId);

  const raw = await client.get<unknown>(API_PATHS.sites, {
    token: auth.token,
    query,
  });

  return extractSiteTokenLookupEntries(raw);
}

export async function lookupSiteViaApi(options: {
  siteName: string;
  token?: string;
  organisationId?: string | number | null;
}): Promise<SiteTokenLookupEntry | undefined> {
  const sites = await fetchSiteList(options);
  return sites.find((site) => siteNameMatches(options.siteName, site.url));
}

export async function resolveSiteTokenWithFallback(
  options: ResolveOptions & { site?: string; organisationId?: string | number | null } = {},
): Promise<string> {
  try {
    return resolveSiteToken(options);
  } catch {
    // fall through to API lookup
  }

  const siteName = options.site || readForgeConfig()?.site;
  if (!siteName) {
    throw new AuthError(
      'No site token found. Specify the target site with --site, link the directory with `forge add <site>`, or provide --site-token.',
    );
  }

  const orgId = resolveOrganisationId(options.organisationId);
  const match = await lookupSiteViaApi({
    siteName,
    token: options.token,
    organisationId: orgId,
  });

  if (match?.site_token) return match.site_token;

  throw new AuthError(
    siteNotInAccountMessage(siteName, { orgFiltered: orgId !== undefined }),
  );
}

export function mergeSiteTokenIntoCredentials(
  url: string,
  siteToken: string,
  stored?: StoredCredentials,
): StoredCredentials {
  const current = stored ?? getStoredCredentials();
  if (!current) {
    throw new AuthError('Not authenticated. Run `forge login` to get started.');
  }

  return {
    ...current,
    site_tokens: {
      ...(current.site_tokens ?? {}),
      [url]: siteToken,
    },
  };
}

export function requireAuth(options: ResolveOptions = {}): AuthContext {
  return resolveAuth(options);
}

export function getOptionalAuth(options: ResolveOptions = {}): AuthContext | undefined {
  try {
    return resolveAuth(options);
  } catch {
    return undefined;
  }
}

export function inferLoginMethod(stored?: StoredCredentials): 'email' | 'oauth' | 'with-token' | 'unknown' {
  if (!stored) return 'unknown';
  if (stored.user_email || stored.site_tokens) return 'email';
  if (stored.expires_at) return 'oauth';
  return 'with-token';
}
