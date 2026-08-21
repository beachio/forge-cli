import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, validateOrgOption } from '../auth/org-context.js';
import { ValidationError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface RollbackResponse {
  rollback: {
    site_id: number;
    url: string;
    version_id: number;
    version_number: number;
    previous_version_id: number;
    previous_version_number: number;
    status: string;
  };
}

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback')
    .description('Rollback site to a previous version')
    .option('-s, --site <site>', 'Site name')
    .requiredOption('--version-id <id>', 'Version ID to rollback to (from `forge versions` output)')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org);
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
        organisationId: options.org,
      });

      const versionId = parseInt(options.versionId, 10);
      if (isNaN(versionId)) {
        throw new ValidationError('--version-id must be a number.', {});
      }

      const spin = logger.spinner('Rolling back...');

      try {
        const client = getApiClient();
        const response = await client.post<RollbackResponse>(API_PATHS.rollback, {
          body: {
            site_token: siteToken,
            version_id: versionId,
          },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human' && response.rollback) {
          const r = response.rollback;
          logger.success(`Rolling back ${r.url}`);
          logger.info(`  v${r.previous_version_number} → v${r.version_number}`);
          logger.dim(`  Status: ${logger.statusBadge(r.status)}`);
          logger.info('');
          logger.dim(`  Monitor with: forge versions --site ${r.url}`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
