import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function readPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '2.0.0';
  }
}

export const VERSION = readPackageVersion();

export const API_BASE_URL = 'https://api.getforge.com';

export const API_PATHS = {
  login: '/api/v2/cli/login',
  sites: '/api/v2/cli/sites',
  create: '/api/v2/cli/create',
  deploy: '/api/v2/cli/deploy',
  redeploy: '/api/v2/cli/redeploy',
  versionsInfo: '/api/v2/cli/versions_info',
  versions: '/api/v2/cli/versions',
  rollback: '/api/v2/cli/rollback',
  tokens: '/api/v2/cli/tokens',
  domainCheck: '/api/v2/cli/domain/check',
  domainSet: '/api/v2/cli/domain/set',
  settings: '/api/v2/cli/settings',
  env: '/api/v2/cli/env',
  siteDelete: '/api/v2/cli/site',
  siteInfo: '/api/v2/cli/site_info',
  usage: '/api/v2/cli/usage',
  organisations: '/api/v2/cli/organisations',
  organisationsSwitch: '/api/v2/cli/organisations/switch',
  projects: '/api/v2/cli/projects',

  oauthAuthorize: '/oauth/authorize',
  oauthToken: '/oauth/token',
} as const;

export const USER_AGENT = `forge-cli/${VERSION}`;

export const CREDENTIALS_DIR = '.forge';
export const CREDENTIALS_FILE = 'credentials';

export const PROJECT_CONFIG_FILE = 'forge.json';
export const IGNORE_FILE = '.forgeignore';

export const DEFAULT_TOKEN_TTL_DAYS = 90;

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  AUTH_FAILURE: 2,
  INSUFFICIENT_SCOPE: 3,
  RATE_LIMITED: 4,
} as const;
