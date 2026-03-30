import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import type { RedeployResponse, RedeployDetail } from '../api/endpoints.js';
import { ValidationError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

function formatSource(source: RedeployDetail['source']): string {
  if (source === 'github') return 'GitHub';
  if (source === 'bitbucket') return 'Bitbucket';
  if (source === 'dropbox') return 'Dropbox';
  return 'source provider';
}

export function registerRedeployCommand(program: Command): void {
  program
    .command('redeploy')
    .description('Redeploy site from connected source provider')
    .option('-s, --site <site>', 'Site name')
    .option('--org <id>', 'Organisation ID for site lookup (use "personal" or "0" for personal sites)')
    .option('--cache', 'Redeploy current version without pulling from source')
    .option('--delay <seconds>', 'Delay deploy start by N seconds')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const org = options.org as string | undefined;
      if (org !== undefined && org !== 'personal' && org !== '0' && Number.isNaN(parseInt(org, 10))) {
        throw new ValidationError('--org must be a numeric ID, "personal", or "0".', {});
      }

      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
        organisationId: org,
      });

      let delay: number | undefined;
      if (options.delay !== undefined) {
        delay = parseInt(options.delay, 10);
        if (Number.isNaN(delay) || delay < 0) {
          throw new ValidationError('--delay must be a non-negative integer.', {});
        }
      }

      const spin = logger.spinner('Queueing redeploy...');

      try {
        const client = getApiClient();
        const response = await client.post<RedeployResponse>(API_PATHS.redeploy, {
          body: {
            site_token: siteToken,
            ...(options.cache ? { cache: true } : {}),
            ...(delay !== undefined ? { delay } : {}),
          },
          token: parentOpts.token,
        });

        spin.stop();
        handleCommandResult(response);

        if (logger.getOutputMode() !== 'human' || !response.redeploy) return;

        const r = response.redeploy;
        if (options.cache || r.same_version) {
          logger.success(`Redeploying ${r.url} (current version, no source pull)...`);
          logger.info('  Deploy queued.');
          return;
        }

        logger.success(`Redeploying ${r.url} from ${formatSource(r.source)}...`);
        logger.info(`  New version queued. Source: ${r.source ?? 'none'}`);
        logger.dim(`  Monitor with: forge versions --site-token ${siteToken}`);
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
