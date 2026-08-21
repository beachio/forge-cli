import { Command } from 'commander';
import { writeForgeConfig, readForgeConfig } from '../config/forge-config.js';
import {
  resolveAuth,
  lookupSiteViaApi,
  mergeSiteTokenIntoCredentials,
} from '../auth/resolver.js';
import { getStoredCredentials, storeCredentials } from '../auth/token-store.js';
import { ORG_OPTION_DESCRIPTION, resolveOrganisationId, validateOrgOption } from '../auth/org-context.js';
import { AuthError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import { siteNotInAccountMessage } from '../utils/site-url-messages.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add <site>')
    .description('Link the current directory to a remote Forge site')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .option('--save-token', 'Write the site token to forge.json (useful for CI and agents)')
    .action(async (site: string, options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org);

      const spin = logger.spinner(`Linking to "${site}"...`);

      try {
        resolveAuth({ token: parentOpts.token });

        const match = await lookupSiteViaApi({
          siteName: site,
          token: parentOpts.token,
          organisationId: options.org,
        });

        if (!match?.site_token) {
          spin.stop();
          throw new AuthError(
            siteNotInAccountMessage(site, {
              orgFiltered: resolveOrganisationId(options.org) !== undefined,
            }),
          );
        }

        const matchedUrl = match.url;
        const siteToken = match.site_token;

        storeCredentials(
          mergeSiteTokenIntoCredentials(matchedUrl, siteToken, getStoredCredentials()),
        );

        const existing = readForgeConfig() || {};
        writeForgeConfig({
          ...existing,
          site: matchedUrl,
          ...(options.saveToken ? { site_token: siteToken } : {}),
        });

        spin.stop();

        handleCommandResult(
          {
            success: true,
            site: matchedUrl,
            directory: process.cwd(),
            token_cached: true,
            token_saved_to_config: Boolean(options.saveToken),
          },
          [
            `Linked to "${matchedUrl}". Site token cached in credentials.`,
            options.saveToken ? 'Site token saved to forge.json.' : undefined,
            'Deploy with `forge deploy`.',
          ]
            .filter(Boolean)
            .join(' '),
        );
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
