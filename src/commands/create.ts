import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveAuth } from '../auth/resolver.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import { displayDnsInstructions, type DnsInstructions } from '../utils/dns-instructions.js';
import type { ProjectsResponse } from '../api/endpoints.js';

interface CreateSiteResponse {
  site: {
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
  };
  pending_domain?: {
    domain: string;
    dns_valid: boolean;
    error: string;
    instructions: DnsInstructions;
  };
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new Forge site')
    .requiredOption('--name <name>', 'Site name (3-63 chars, alphanumeric and hyphens)')
    .option('--custom <domain>', 'Custom domain to assign (e.g. mysite.com)')
    .option('--org <id>', 'Create site under an organisation')
    .option('--project <id|name>', 'Add site to a project (folder) by ID or name')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const name = options.name.toLowerCase().trim();

      if (!options.custom && !NAME_PATTERN.test(name)) {
        logger.error(
          'Site name must be 3-63 characters, alphanumeric and hyphens only.',
        );
        process.exit(1);
      }

      // Resolve project ID from name if a non-numeric value was given
      let resolvedProjectId: number | null = null;
      let resolvedProjectName: string | null = null;

      if (options.project) {
        const isNumeric = /^\d+$/.test(options.project);
        if (isNumeric) {
          resolvedProjectId = parseInt(options.project, 10);
        } else {
          const lookupSpin = logger.spinner(`Looking up project "${options.project}"...`);
          try {
            const client = getApiClient();
            const projectsResponse = await client.get<ProjectsResponse>(API_PATHS.projects, {
              token: auth.token,
            });
            lookupSpin.stop();
            const match = (projectsResponse.projects || []).find(
              (p) => p.name.toLowerCase() === options.project.toLowerCase(),
            );
            if (!match) {
              logger.error(`Project "${options.project}" not found. Use \`forge projects\` to see available projects.`);
              process.exit(1);
            }
            resolvedProjectId = match.id;
            resolvedProjectName = match.name;
          } catch (err) {
            lookupSpin.stop();
            throw err;
          }
        }
      }

      const spinText = resolvedProjectId
        ? `Creating site "${name}" in project "${resolvedProjectName || resolvedProjectId}"...`
        : `Creating site "${name}"...`;
      const spin = logger.spinner(spinText);

      try {
        const client = getApiClient();
        const body: Record<string, unknown> = { name };
        if (options.custom) {
          body.custom_domain = options.custom;
        }
        if (options.org) {
          body.organisation_id = parseInt(options.org, 10);
        }

        const response = await client.post<CreateSiteResponse>(API_PATHS.create, {
          token: auth.token,
          body,
        });

        const site = response.site;

        // If a project was specified, add the new site to it
        if (resolvedProjectId !== null && site) {
          try {
            await client.post(`${API_PATHS.projects}/${resolvedProjectId}/sites`, {
              token: auth.token,
              body: { site_token: site.site_token },
            });
            if (!resolvedProjectName) resolvedProjectName = String(resolvedProjectId);
          } catch {
            spin.stop();
            // Site was created — don't fail entirely, just warn
            handleCommandResult(response);
            if (logger.getOutputMode() === 'human' && site) {
              logger.success('Site created');
              logger.warn(
                `Could not add site to project "${resolvedProjectName || resolvedProjectId}". ` +
                `Run: forge project add-site ${resolvedProjectId} --site ${site.url}`,
              );
              logger.info('');
              logger.info(`  URL:        ${site.url}`);
              logger.info(`  ID:         ${site.id}`);
              logger.info(`  Token:      ${site.site_token}`);
              logger.info(`  SSL:        ${site.ssl ? 'on' : 'off'}`);
              logger.info('');
              logger.dim(`Link this directory: forge add ${site.url}`);
            }
            return;
          }
        }

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human' && site) {
          if (resolvedProjectName) {
            logger.success(`Site created and added to project "${resolvedProjectName}"`);
          } else {
            logger.success('Site created');
          }
          logger.info('');
          logger.info(`  URL:        ${site.url}`);
          logger.info(`  ID:         ${site.id}`);
          logger.info(`  Token:      ${site.site_token}`);
          logger.info(`  SSL:        ${site.ssl ? 'on' : 'off'}`);
          if (site.organisation_name) {
            logger.info(`  Org:        ${site.organisation_name}`);
          }
          if (resolvedProjectName) {
            logger.info(`  Project:    ${resolvedProjectName} (id: ${resolvedProjectId})`);
          }
          logger.info('');

          if (response.pending_domain) {
            logger.warn('Custom domain DNS is not yet configured.');
            displayDnsInstructions(
              response.pending_domain.domain,
              response.pending_domain.instructions,
            );
          } else {
            logger.dim(`Link this directory: forge add ${site.url}`);
          }
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
