import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveAuth } from '../auth/resolver.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { readForgeConfig } from '../config/forge-config.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

const COMPILER_MAP: Record<number, string> = {
  0: 'nothing',
  1: 'hammer',
  2: 'jekyll',
  3: 'middleman',
  4: 'webpack',
};

interface SiteInfoResponse {
  id?: number;
  url?: string;
  site_token?: string;
  mode?: string;
  kind?: string | null;
  deployed_at?: string | null;
  created_at?: string | null;
  ssl?: boolean;
  ssl_enabled?: boolean;
  force_ssl_enabled?: boolean;
  compiler?: string | number;
  squish?: boolean;
  build_command?: string | null;
  build_folder?: string | null;
  deployment_method?: string;
  github_path?: string | null;
  github_branch?: string | null;
  github_autodeploy?: boolean;
  parent_site_id?: number | null;
  organisation_id?: number | null;
  organisation_name?: string | null;
  project_id?: number | null;
  environment?: Record<string, string>;
  current_version?: {
    id: number;
    version_number: number;
    deploy_status: string;
    deployed_at: string | null;
  };
  [key: string]: unknown;
}

export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('Show detailed information about a site')
    .option('-s, --site <site>', 'Site name')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const config = readForgeConfig();
      const siteName = options.site || config?.site;

      const spin = logger.spinner('Fetching site info...');

      try {
        let siteInfo: SiteInfoResponse | undefined;

        const siteToken = await resolveSiteTokenWithFallback({
          siteToken: parentOpts.siteToken,
          token: parentOpts.token,
          site: options.site,
        }).catch(() => undefined);

        if (siteToken) {
          const client = getApiClient();
          const auth = resolveAuth({ token: parentOpts.token });
          const response = await client.get<Record<string, unknown>>(API_PATHS.siteInfo, {
            token: auth.token,
            query: { site_token: siteToken },
          });

          if (response.site && typeof response.site === 'object') {
            siteInfo = response.site as SiteInfoResponse;
          } else {
            siteInfo = response as unknown as SiteInfoResponse;
          }
        }

        if (!siteInfo && siteName) {
          const auth = resolveAuth({ token: parentOpts.token });
          const client = getApiClient();
          const raw = await client.get<{ sites: SiteInfoResponse[] }>(
            API_PATHS.sites,
            { token: auth.token },
          );

          if (raw.sites) {
            const name = siteName.toLowerCase();
            siteInfo = raw.sites.find((s) => {
              const url = (s.url || '').toLowerCase();
              return url === name || url === `${name}.getforge.io` || url.startsWith(`${name}.`);
            });
          }
        }

        spin.stop();

        if (!siteInfo) {
          logger.error('Site not found. Provide --site <name> or run from a directory with forge.json.');
          process.exit(1);
        }

        handleCommandResult(siteInfo);

        if (logger.getOutputMode() === 'human') {
          logger.info('');
          logger.bold(`  ${siteInfo.url || 'Unknown site'}`);
          logger.info('');

          if (siteInfo.id != null) logger.label('ID', String(siteInfo.id));
          if (siteInfo.url) logger.label('URL', siteInfo.url);
          if (siteInfo.site_token) logger.label('Site Token', siteInfo.site_token);
          if (siteInfo.mode) logger.label('Environment', siteInfo.mode);

          const ssl = siteInfo.ssl ?? siteInfo.ssl_enabled;
          if (ssl != null) logger.label('SSL', logger.statusBadge(ssl ? 'on' : 'off'));
          if (siteInfo.force_ssl_enabled != null) logger.label('Force SSL', logger.statusBadge(siteInfo.force_ssl_enabled ? 'on' : 'off'));

          const compiler = typeof siteInfo.compiler === 'number'
            ? COMPILER_MAP[siteInfo.compiler] || String(siteInfo.compiler)
            : siteInfo.compiler;
          if (compiler) logger.label('Compiler', compiler);
          if (siteInfo.build_command) logger.label('Build Command', siteInfo.build_command);
          if (siteInfo.build_folder) logger.label('Build Folder', siteInfo.build_folder);
          if (siteInfo.squish != null) logger.label('TurboJS', logger.statusBadge(siteInfo.squish ? 'on' : 'off'));
          if (siteInfo.deployment_method) logger.label('Deploy Method', siteInfo.deployment_method);

          if (siteInfo.github_path) {
            logger.label('GitHub', `${siteInfo.github_path}${siteInfo.github_branch ? ` (${siteInfo.github_branch})` : ''}`);
            if (siteInfo.github_autodeploy) logger.label('Auto-deploy', logger.statusBadge('on'));
          }

          if (siteInfo.current_version) {
            const cv = siteInfo.current_version;
            logger.label('Current Version', `v${cv.version_number} (${logger.statusBadge(cv.deploy_status)})`);
          }

          if (siteInfo.organisation_name) {
            logger.label('Organisation', `${siteInfo.organisation_name} (ID: ${siteInfo.organisation_id})`);
          }
          if (siteInfo.project_id != null) logger.label('Project ID', String(siteInfo.project_id));

          if (siteInfo.environment && Object.keys(siteInfo.environment).length) {
            logger.label('Env Vars', `${Object.keys(siteInfo.environment).length} set`);
          }

          if (siteInfo.created_at) logger.label('Created', new Date(siteInfo.created_at).toLocaleString());
          if (siteInfo.deployed_at) logger.label('Last Deployed', new Date(siteInfo.deployed_at).toLocaleString());
          if (siteInfo.parent_site_id) logger.label('Parent Site', String(siteInfo.parent_site_id));

          logger.info('');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
