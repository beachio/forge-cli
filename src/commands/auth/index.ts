import { Command } from 'commander';
import { readForgeConfig } from '../../config/forge-config.js';
import { getStoredCredentials } from '../../auth/token-store.js';
import {
  getLocalSiteTokenSource,
  getOptionalAuth,
  inferLoginMethod,
  lookupSiteViaApi,
  resolveSiteTokenWithFallback,
} from '../../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, resolveOrganisationId, validateOrgOption } from '../../auth/org-context.js';
import { siteNotInAccountSuggestion, toForgeSiteUrl } from '../../utils/site-url-messages.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface AuthCheck {
  id: string;
  status: CheckStatus;
  message: string;
  suggestion?: string;
}

export function registerAuthDoctorCommand(authCmd: Command): void {
  authCmd
    .command('doctor')
    .description('Diagnose authentication, org context, and site token resolution')
    .option('-s, --site <site>', 'Site to diagnose (defaults to forge.json site)')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || cmd.parent?.opts() || {};
      validateOrgOption(options.org);

      const checks: AuthCheck[] = [];
      const stored = getStoredCredentials();
      const config = readForgeConfig();
      const targetSite = options.site || config?.site;
      const orgId = resolveOrganisationId(options.org);

      const auth = getOptionalAuth({
        token: parentOpts.token,
        siteToken: parentOpts.siteToken,
      });

      if (!auth || auth.tokenType !== 'cli') {
        checks.push({
          id: 'cli_auth',
          status: 'fail',
          message: auth?.tokenType === 'site'
            ? 'Only a site token is configured; account commands need a CLI token.'
            : 'No CLI token found.',
          suggestion: 'Run `forge login` or set FORGE_TOKEN.',
        });
      } else {
        checks.push({
          id: 'cli_auth',
          status: 'pass',
          message: `CLI token present (${auth.source}).`,
        });

        const loginMethod = inferLoginMethod(stored);
        if (loginMethod === 'oauth' || loginMethod === 'with-token') {
          checks.push({
            id: 'login_method',
            status: 'warn',
            message:
              loginMethod === 'oauth'
                ? 'Browser/OAuth login does not cache site tokens or deploy watch credentials.'
                : 'Direct token login does not cache site tokens from your account.',
            suggestion:
              'Use email/password login for cached site tokens, or run `forge add <site>` to cache tokens.',
          });
        } else if (loginMethod === 'email') {
          checks.push({
            id: 'login_method',
            status: 'pass',
            message: 'Email login with cached account metadata.',
          });
        }
      }

      if (stored?.organisation_id) {
        checks.push({
          id: 'org_context',
          status: 'pass',
          message: `Org context: ${stored.organisation_name} (ID: ${stored.organisation_id}).`,
        });
      } else {
        checks.push({
          id: 'org_context',
          status: 'pass',
          message: 'Org context: Personal.',
        });
      }

      if (config?.site) {
        checks.push({
          id: 'project_link',
          status: 'pass',
          message: `Project linked: ${config.site}.`,
        });
      } else if (targetSite) {
        checks.push({
          id: 'project_link',
          status: 'pass',
          message: `Target site: ${targetSite} (from --site).`,
        });
      } else {
        checks.push({
          id: 'project_link',
          status: 'warn',
          message: 'No linked site in forge.json.',
          suggestion: 'Run `forge add <site>` from your project directory.',
        });
      }

      if (targetSite) {
        const local = getLocalSiteTokenSource({
          siteToken: parentOpts.siteToken,
          site: targetSite,
        });

        if (local.token) {
          checks.push({
            id: 'site_token_local',
            status: 'pass',
            message: `Site token available locally (${local.source}).`,
          });
        } else {
          checks.push({
            id: 'site_token_local',
            status: 'warn',
            message: 'No local site token for the linked site.',
            suggestion: 'Run `forge add <site>` or provide --site-token / FORGE_SITE_TOKEN.',
          });
        }

        if (auth?.tokenType === 'cli') {
          try {
            await resolveSiteTokenWithFallback({
              token: parentOpts.token,
              siteToken: parentOpts.siteToken,
              site: targetSite,
              organisationId: options.org,
            });
            checks.push({
              id: 'site_token_lookup',
              status: 'pass',
              message: 'Site token resolvable via CLI token (including API lookup).',
            });
          } catch {
            const apiMatch = await lookupSiteViaApi({
              siteName: targetSite,
              token: parentOpts.token,
              organisationId: orgId,
            }).catch(() => undefined);

            if (apiMatch?.site_token) {
              checks.push({
                id: 'site_token_lookup',
                status: 'pass',
                message: 'Site token found via API lookup.',
              });
            } else {
              checks.push({
                id: 'site_token_lookup',
                status: 'fail',
                message: `Site ${toForgeSiteUrl(targetSite)} is not accessible under your CLI token.`,
                suggestion: siteNotInAccountSuggestion(targetSite),
              });
              checks.push({
                id: 'url_ownership',
                status: 'warn',
                message:
                  'If `forge create` reports this URL as already in use, another Forge account likely owns that globally unique subdomain.',
                suggestion:
                  'Create a new site with a unique name: `forge create --name <name>-<suffix>`.',
              });
            }
          }
        }
      }

      const deployReady = Boolean(
        auth?.tokenType === 'cli' &&
          targetSite &&
          (checks.some((c) => c.id === 'site_token_local' && c.status === 'pass') ||
            checks.some((c) => c.id === 'site_token_lookup' && c.status === 'pass')),
      );

      const result = {
        checks,
        deploy_ready: Boolean(deployReady),
        linked_site: config?.site ?? null,
        target_site: targetSite ?? null,
        organisation_id: stored?.organisation_id ?? null,
        organisation_name: stored?.organisation_name ?? null,
      };

      handleCommandResult(result);

      if (logger.getOutputMode() === 'human') {
        logger.info('');
        for (const check of checks) {
          const icon =
            check.status === 'pass' ? logger.statusBadge('success') :
            check.status === 'warn' ? logger.statusBadge('queued') :
            logger.statusBadge('failed');
          logger.info(`${icon} ${check.message}`);
          if (check.suggestion) {
            logger.dim(`    → ${check.suggestion}`);
          }
        }
        logger.info('');
        if (deployReady) {
          logger.success('Ready to deploy: `forge deploy`');
        } else {
          logger.warn('Not ready to deploy yet. Address the items above.');
        }
      }
    });
}

export function registerAuthCommands(program: Command): void {
  const authCmd = program.command('auth').description('Authentication diagnostics and utilities');

  registerAuthDoctorCommand(authCmd);
}
