import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface VersionEntry {
  id: number;
  version_number: number;
  description: string | null;
  deploy_status: string;
  status: string;
  created_at: string;
  deployed_at: string | null;
  file_size: number | null;
  user_id: number;
}

interface VersionsResponse {
  site: {
    id: number;
    url: string;
    current_version_id: number;
  };
  versions: VersionEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function registerVersionsCommand(program: Command): void {
  program
    .command('versions')
    .description('List site version history')
    .option('-s, --site <site>', 'Site name')
    .option('--limit <n>', 'Versions per page (default: 20, max: 100)')
    .option('--page <n>', 'Page number')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
      });

      const spin = logger.spinner('Fetching versions...');

      try {
        const client = getApiClient();

        const query: Record<string, string> = { site_token: siteToken };
        if (options.limit) query.limit = options.limit;
        if (options.page) query.page = options.page;

        const response = await client.get<VersionsResponse>(API_PATHS.versions, {
          token: parentOpts.token,
          query,
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() !== 'human') return;

        const { versions, site, pagination } = response;

        if (!versions?.length) {
          logger.info('No versions found.');
          return;
        }

        logger.info('');
        logger.info(`  ${site.url} -- Version History`);
        logger.info('');

        logger.table(
          ['Version', 'Description', 'Status', 'Deployed At', 'Size'],
          versions.map((v) => [
            `v${v.version_number}`,
            v.description || '--',
            logger.statusBadge(v.status),
            v.deployed_at
              ? new Date(v.deployed_at).toLocaleString()
              : '--',
            formatBytes(v.file_size),
          ]),
        );

        if (pagination.total_pages > 1) {
          logger.info('');
          logger.dim(`  Page ${pagination.page} of ${pagination.total_pages} (${pagination.total} versions)`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
