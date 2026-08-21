import { Command } from 'commander';
import { getStoredCredentials } from '../auth/token-store.js';
import { readForgeConfig } from '../config/forge-config.js';
import {
  getLocalSiteTokenSource,
  getOptionalAuth,
  inferLoginMethod,
} from '../auth/resolver.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Show current authentication status')
    .action(async (_, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const auth = getOptionalAuth({
        token: parentOpts.token,
        siteToken: parentOpts.siteToken,
      });

      if (!auth) {
        logger.info('Not authenticated. Run `forge login` to get started.');
        return;
      }

      const stored = getStoredCredentials();
      const config = readForgeConfig();
      const loginMethod = inferLoginMethod(stored);
      const cachedSiteTokens = stored?.site_tokens ? Object.keys(stored.site_tokens).length : 0;
      const linkedSite = config?.site;
      const localSiteToken = linkedSite
        ? getLocalSiteTokenSource({ site: linkedSite, siteToken: parentOpts.siteToken })
        : { source: 'none' as const };

      const info = {
        authenticated: true,
        token_type: auth.tokenType,
        source: auth.source,
        login_method: loginMethod,
        user_email: stored?.user_email,
        user_name: stored?.user_name,
        expires_at: stored?.expires_at,
        cached_site_tokens: cachedSiteTokens,
        linked_site: linkedSite ?? null,
        linked_site_token_source: linkedSite ? localSiteToken.source : null,
        organisation_id: stored?.organisation_id ?? null,
        organisation_name: stored?.organisation_name ?? null,
      };

      handleCommandResult(info);

      if (logger.getOutputMode() === 'human') {
        logger.info(`  Token type:  ${auth.tokenType}`);
        logger.info(`  Source:      ${auth.source}`);
        logger.info(`  Login:       ${loginMethod}`);
        if (stored?.user_email) logger.info(`  Email:       ${stored.user_email}`);
        if (stored?.user_name) logger.info(`  User:        ${stored.user_name}`);
        if (stored?.organisation_id) {
          logger.info(`  Org:         ${stored.organisation_name} (ID: ${stored.organisation_id})`);
        } else {
          logger.info(`  Context:     Personal`);
        }
        if (stored?.expires_at) logger.info(`  Expires:     ${stored.expires_at}`);
        logger.info(`  Cached site tokens: ${cachedSiteTokens} (from login/add)`);
        if (linkedSite) {
          logger.info(`  Linked site: ${linkedSite}`);
          if (localSiteToken.source === 'none') {
            logger.warn(
              '  No local site token for linked site. Run `forge add <site>` or `forge auth doctor`.',
            );
          } else {
            logger.info(`  Site token:  available (${localSiteToken.source})`);
          }
        }
      }
    });
}
