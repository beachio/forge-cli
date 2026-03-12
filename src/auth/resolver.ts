import { getStoredCredentials, type StoredCredentials } from './token-store.js';
import { readForgeConfig } from '../config/forge-config.js';
import { AuthError } from '../utils/errors.js';

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

function findSiteTokenByName(siteName: string, siteTokens: Record<string, string>): string | undefined {
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

export function resolveSiteToken(options: ResolveOptions = {}): string {
  if (options.siteToken) return options.siteToken;

  const envSiteToken = process.env.FORGE_SITE_TOKEN;
  if (envSiteToken) return envSiteToken;

  const config = readForgeConfig();
  if (config?.site_token) return config.site_token;

  const stored = getStoredCredentials();
  if (stored?.site_tokens) {
    const siteName = config?.site;
    if (siteName) {
      const found = findSiteTokenByName(siteName, stored.site_tokens);
      if (found) return found;
    }
  }

  throw new AuthError(
    'No site token found. Link a site with `forge add <site>` or provide --site-token.',
  );
}

export async function resolveSiteTokenWithFallback(options: ResolveOptions & { site?: string } = {}): Promise<string> {
  try {
    return resolveSiteToken(options);
  } catch {
    // fall through to API lookup
  }

  const siteName = options.site || readForgeConfig()?.site;
  if (!siteName) {
    throw new AuthError(
      'No site token found. Use --site <name>, --site-token <token>, or run `forge add <site>`.',
    );
  }

  const auth = resolveAuth({ token: options.token });
  const { getApiClient } = await import('../api/client.js');
  const { API_PATHS } = await import('../config/constants.js');
  const client = getApiClient();
  const raw = await client.get<{ sites: Array<{ url: string; site_token: string }> } | string[]>(
    API_PATHS.sites,
    { token: auth.token },
  );

  if (!Array.isArray(raw) && raw.sites) {
    const name = siteName.toLowerCase();
    const match = raw.sites.find((s) => {
      const url = s.url.toLowerCase();
      return url === name || url === `${name}.getforge.io` || url.startsWith(`${name}.`);
    });
    if (match?.site_token) return match.site_token;
  }

  throw new AuthError(
    `Could not find site token for "${siteName}". Check the site name or provide --site-token.`,
  );
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
