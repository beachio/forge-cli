import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveAuth } from '../auth/resolver.js';
import {
  organisationIdToQuery,
  resolveOrganisationId,
  validateOrgOption,
} from '../auth/org-context.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface SiteEntry {
  id: number;
  url: string;
  site_token: string;
  mode: string;
  deployed_at: string | null;
  ssl: boolean;
  parent_site_id: number | null;
  organisation_id?: number | null;
  organisation_name?: string | null;
  project_id?: number | null;
}

interface SitesApiResponse {
  sites: SiteEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export function registerSitesCommand(program: Command): void {
  program
    .command('sites')
    .description('List your Forge sites')
    .option('--environment <env>', 'Filter by environment (production, staging, development)')
    .option('--org <id>', 'Filter by organisation ID (use "personal" or "0" for personal sites only)')
    .option('--page <n>', 'Page number (shows single page instead of all results)')
    .option('--limit <n>', 'Results per page (default: 100, max: 500)')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org);
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner('Fetching sites...');

      try {
        const client = getApiClient();
        const query: Record<string, string> = {};
        if (options.environment) query.environment = options.environment;
        const orgQuery = organisationIdToQuery(resolveOrganisationId(options.org));
        if (orgQuery) Object.assign(query, orgQuery);
        if (options.limit) query.limit = options.limit;

        const explicitPage = options.page != null;

        const fetchPage = async (page: number): Promise<SitesApiResponse> => {
          const pageQuery = { ...query, page: String(page) };
          const raw = await client.get<SitesApiResponse | string[]>(
            API_PATHS.sites,
            { token: auth.token, query: pageQuery },
          );

          if (Array.isArray(raw)) {
            return {
              sites: raw.map((url, i) => ({
                id: i,
                url: String(url),
                site_token: '',
                mode: '',
                deployed_at: null,
                ssl: false,
                parent_site_id: null,
              })),
            };
          }
          if (raw && typeof raw === 'object' && 'sites' in raw && Array.isArray(raw.sites)) {
            return raw;
          }
          return { sites: [] };
        };

        let sites: SiteEntry[];
        let pagination: SitesApiResponse['pagination'];

        if (explicitPage) {
          const result = await fetchPage(parseInt(options.page, 10));
          sites = result.sites;
          pagination = result.pagination;
        } else {
          const first = await fetchPage(1);
          sites = first.sites;
          pagination = first.pagination;

          if (pagination && pagination.total_pages > 1) {
            for (let p = 2; p <= pagination.total_pages; p++) {
              const next = await fetchPage(p);
              sites.push(...next.sites);
            }
          }
        }

        spin.stop();

        handleCommandResult(explicitPage ? { sites, pagination } : sites);

        if (logger.getOutputMode() === 'human') {
          if (!sites.length) {
            logger.info('No sites found. Create one with `forge create --name <name>`.');
            return;
          }

          logger.info(`${sites.length} site${sites.length === 1 ? '' : 's'}:\n`);

          const hasOrgs = sites.some((s) => s.organisation_name);
          const headers = hasOrgs
            ? ['ID', 'URL', 'Organisation', 'Environment', 'SSL', 'Last Deployed']
            : ['ID', 'URL', 'Environment', 'SSL', 'Last Deployed'];

          logger.table(
            headers,
            sites.map((s) => {
              const row = [
                String(s.id),
                s.url,
                ...(hasOrgs ? [s.organisation_name || 'Personal'] : []),
                s.mode || '-',
                logger.statusBadge(s.ssl ? 'on' : 'off'),
                s.deployed_at ? new Date(s.deployed_at).toLocaleDateString() : '-',
              ];
              return row;
            }),
          );

          if (explicitPage && pagination && pagination.total_pages > 1) {
            logger.info('');
            logger.dim(`  Page ${pagination.page} of ${pagination.total_pages} (${pagination.total} sites)`);
          }
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
