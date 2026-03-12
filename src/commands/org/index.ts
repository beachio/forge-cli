import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import { getStoredCredentials, storeCredentials } from '../../auth/token-store.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import type { OrganisationsResponse, OrgSwitchResponse } from '../../api/endpoints.js';

export function registerOrgCommands(program: Command): void {
  program
    .command('orgs')
    .description('List your organisations')
    .action(async (_, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner('Fetching organisations...');

      try {
        const client = getApiClient();
        const response = await client.get<OrganisationsResponse>(
          API_PATHS.organisations,
          { token: auth.token },
        );

        spin.stop();

        const orgs = response.organisations || [];

        handleCommandResult(orgs);

        if (logger.getOutputMode() === 'human') {
          if (!orgs.length) {
            logger.info('You are not a member of any organisations.');
            return;
          }

          logger.info(`${orgs.length} organisation${orgs.length === 1 ? '' : 's'}:\n`);

          logger.table(
            ['ID', 'Name', 'Role', 'Subscription', 'Sites', 'Projects'],
            orgs.map((o) => [
              String(o.id),
              o.name,
              o.role,
              logger.statusBadge(o.subscription_active ? 'on' : 'off'),
              String(o.sites_count ?? '-'),
              String(o.projects_count ?? '-'),
            ]),
          );
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  const orgCmd = program
    .command('org')
    .description('Manage organisation context');

  orgCmd
    .command('switch')
    .description('Switch active organisation context')
    .requiredOption('--id <id>', 'Organisation ID (use "personal" or "0" for personal context)')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const isPersonal = options.id === 'personal' || options.id === '0';
      const orgId = isPersonal ? null : parseInt(options.id, 10);

      if (!isPersonal && isNaN(orgId as number)) {
        logger.error('Organisation ID must be a number, or "personal" / "0" for personal context.');
        process.exit(1);
      }

      const spin = logger.spinner(
        isPersonal ? 'Switching to personal context...' : `Switching to organisation ${orgId}...`,
      );

      try {
        const client = getApiClient();
        const response = await client.post<OrgSwitchResponse>(
          API_PATHS.organisationsSwitch,
          {
            token: auth.token,
            body: { organisation_id: orgId },
          },
        );

        spin.stop();

        const stored = getStoredCredentials();
        if (stored) {
          storeCredentials({
            ...stored,
            organisation_id: response.organisation_id,
            organisation_name: response.organisation_name || null,
          });
        }

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(response.message);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
