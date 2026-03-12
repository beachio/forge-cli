import { Command } from 'commander';
import inquirer from 'inquirer';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveAuth, resolveSiteTokenWithFallback } from '../auth/resolver.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface DestroyResponse {
  message: string;
}

export function registerDestroyCommand(program: Command): void {
  program
    .command('destroy')
    .description('Permanently delete a Forge site')
    .option('-s, --site <site>', 'Site name')
    .option('--force', 'Skip confirmation prompt')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
      });

      if (!options.force) {
        logger.warn('This will permanently delete the site and all its versions.');

        const { confirm } = await inquirer.prompt([
          {
            type: 'input',
            name: 'confirm',
            message: 'Type the site name to confirm:',
          },
        ]);

        const siteName = options.site || '';
        if (confirm !== siteName && !confirm.endsWith('.getforge.io')) {
          logger.error('Confirmation did not match. Aborting.');
          process.exit(1);
        }
      }

      const spin = logger.spinner('Deleting site...');

      try {
        const client = getApiClient();
        const response = await client.delete<DestroyResponse>(API_PATHS.siteDelete, {
          token: auth.token,
          body: { site_token: siteToken },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(response.message || 'Site deleted.');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
