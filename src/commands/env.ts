import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, validateOrgOption } from '../auth/org-context.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface EnvResponse {
  environment: Record<string, string>;
}

export function registerEnvCommands(program: Command): void {
  const env = program
    .command('env')
    .description('Manage environment variables for a site')
    .option('-s, --site <site>', 'Site name')
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

      const spin = logger.spinner('Fetching environment variables...');

      try {
        const client = getApiClient();
        const response = await client.get<EnvResponse>(API_PATHS.env, {
          query: { site_token: siteToken },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          const vars = response.environment || {};
          const keys = Object.keys(vars);

          if (!keys.length) {
            logger.info('No environment variables set.');
            return;
          }

          logger.info('');
          const maxKey = Math.max(...keys.map((k) => k.length));
          for (const key of keys) {
            logger.info(`  ${key.padEnd(maxKey + 2)} ${vars[key]}`);
          }
          logger.info('');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  env
    .command('set')
    .description('Set environment variables (KEY=VALUE pairs)')
    .option('-s, --site <site>', 'Site name')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .argument('<pairs...>', 'KEY=VALUE pairs to set')
    .action(async (pairs: string[], options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const envOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org ?? envOpts.org);
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site || envOpts.site,
        organisationId: options.org ?? envOpts.org,
      });

      const vars: Record<string, string> = {};
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
          logger.error(`Invalid format: "${pair}". Use KEY=VALUE.`);
          process.exit(1);
        }
        vars[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
      }

      const spin = logger.spinner('Setting environment variables...');

      try {
        const client = getApiClient();
        const response = await client.request<EnvResponse>(API_PATHS.env, {
          method: 'PUT',
          body: { site_token: siteToken, vars },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success('Updated environment variables:');
          for (const [key, value] of Object.entries(vars)) {
            logger.label(key, value);
          }
          logger.info('');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });

  env
    .command('unset')
    .description('Remove environment variables by key')
    .option('-s, --site <site>', 'Site name')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .argument('<keys...>', 'Variable names to remove')
    .action(async (keys: string[], options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const envOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org ?? envOpts.org);
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site || envOpts.site,
        organisationId: options.org ?? envOpts.org,
      });

      const spin = logger.spinner('Removing environment variables...');

      try {
        const client = getApiClient();
        const response = await client.delete<EnvResponse>(API_PATHS.env, {
          body: { site_token: siteToken, keys },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(`Removed: ${keys.join(', ')}`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
