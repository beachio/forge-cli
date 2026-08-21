import { Command } from 'commander';
import inquirer from 'inquirer';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import {
  organisationIdToQuery,
  resolveOrganisationId,
  validateOrgOption,
} from '../../auth/org-context.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import type { ProjectsResponse, ProjectResponse, Project } from '../../api/endpoints.js';

function renderProjectTree(projects: Project[]): void {
  if (!projects.length) {
    logger.info('No projects found.');
    return;
  }

  const personal = projects.filter((p) => p.organisation_id == null);
  const byOrg = new Map<number, { name: string; projects: Project[] }>();

  for (const p of projects) {
    if (p.organisation_id != null) {
      if (!byOrg.has(p.organisation_id)) {
        byOrg.set(p.organisation_id, {
          name: p.organisation_name || String(p.organisation_id),
          projects: [],
        });
      }
      byOrg.get(p.organisation_id)!.projects.push(p);
    }
  }

  function printProjects(group: Project[]): void {
    for (const project of group) {
      const siteCount = project.sites_count ?? project.sites?.length ?? 0;
      logger.info(`  ${project.name} (${siteCount} site${siteCount === 1 ? '' : 's'})  [id: ${project.id}]`);
      const sites = project.sites || [];
      for (let i = 0; i < sites.length; i++) {
        const isLast = i === sites.length - 1;
        logger.info(`    ${isLast ? '└──' : '├──'} ${sites[i].url}`);
      }
    }
  }

  if (personal.length) {
    logger.bold('Personal Projects:');
    printProjects(personal);
    logger.info('');
  }

  for (const [, { name, projects: orgProjects }] of byOrg) {
    logger.bold(`${name} Projects:`);
    printProjects(orgProjects);
    logger.info('');
  }
}

export function registerProjectCommands(program: Command): void {
  // forge projects — list
  program
    .command('projects')
    .description('List your projects (folders)')
    .option('--org <id>', 'Filter by organisation ID (defaults to active org from `forge org switch`)')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org);
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner('Fetching projects...');

      try {
        const client = getApiClient();
        const query = organisationIdToQuery(resolveOrganisationId(options.org)) ?? {};

        const response = await client.get<ProjectsResponse>(API_PATHS.projects, {
          token: auth.token,
          query,
        });

        spin.stop();

        const projects = response.projects || [];
        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          renderProjectTree(projects);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  // forge project — subcommand group
  const projectCmd = program
    .command('project')
    .description('Manage projects (folders)');

  // forge project create <name>
  projectCmd
    .command('create <name>')
    .description('Create a new project')
    .option('--org <id>', 'Create under an organisation')
    .action(async (name: string, options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner(`Creating project "${name}"...`);

      try {
        const client = getApiClient();
        const body: Record<string, unknown> = { name };
        if (options.org) body.organisation_id = parseInt(options.org, 10);

        const response = await client.post<ProjectResponse>(API_PATHS.projects, {
          token: auth.token,
          body,
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          const project = response.project;
          logger.success(`Project "${project.name}" created.`);
          logger.info('');
          logger.info(`  ID:   ${project.id}`);
          logger.info(`  Name: ${project.name}`);
          if (project.organisation_name) {
            logger.info(`  Org:  ${project.organisation_name}`);
          }
          logger.info('');
          logger.dim(`Add a site: forge project add-site ${project.id} --site <url>`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  // forge project delete <id>
  projectCmd
    .command('delete <id>')
    .description('Delete a project')
    .option('--force', 'Skip confirmation and delete even if project contains sites')
    .action(async (id: string, options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete project ${id}? This cannot be undone.`,
            default: false,
          },
        ]);

        if (!confirm) {
          logger.info('Aborted.');
          process.exit(0);
        }
      }

      const spin = logger.spinner(`Deleting project ${id}...`);

      try {
        const client = getApiClient();
        const body: Record<string, unknown> = {};
        if (options.force) body.force = true;

        const response = await client.delete<{ message: string }>(
          `${API_PATHS.projects}/${id}`,
          { token: auth.token, body },
        );

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(response.message || `Project ${id} deleted.`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  // forge project add-site <project-id>
  projectCmd
    .command('add-site <project-id>')
    .description('Add a site to a project')
    .option('-s, --site <url>', 'Site URL to add (defaults to linked site from forge.json)')
    .option('--site-id <id>', 'Site ID to add')
    .option('--site-token <token>', 'Site token to add')
    .action(async (projectId: string, options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      if (!options.site && !options.siteId && !options.siteToken) {
        // Try to resolve from forge.json
        const { readForgeConfig } = await import('../../config/forge-config.js');
        const config = readForgeConfig();
        if (!config?.site) {
          logger.error(
            'No site specified. Use --site <url>, --site-id <id>, or run from a directory with forge.json.',
          );
          process.exit(1);
        }
        options.site = config.site;
      }

      const spin = logger.spinner(`Adding site to project ${projectId}...`);

      try {
        const client = getApiClient();
        const body: Record<string, unknown> = {};
        if (options.siteToken) {
          body.site_token = options.siteToken;
        } else if (options.siteId) {
          body.site_id = parseInt(options.siteId, 10);
        } else {
          // Pass as site_token or url — resolve via sites list if needed
          body.url = options.site;
        }

        const response = await client.post<{ message: string; project: ProjectResponse['project'] }>(
          `${API_PATHS.projects}/${projectId}/sites`,
          { token: auth.token, body },
        );

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(response.message || 'Site added to project.');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  // forge project remove-site <project-id>
  projectCmd
    .command('remove-site <project-id>')
    .description('Remove a site from a project')
    .requiredOption('--site-id <id>', 'ID of the site to remove')
    .action(async (projectId: string, options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner(`Removing site ${options.siteId} from project ${projectId}...`);

      try {
        const client = getApiClient();
        const response = await client.delete<{ message: string }>(
          `${API_PATHS.projects}/${projectId}/sites/${options.siteId}`,
          { token: auth.token },
        );

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(response.message || 'Site removed from project.');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
