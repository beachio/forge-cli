import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveSiteTokenWithFallback } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';

interface SettingsResponse {
  site: Record<string, unknown>;
}

const COMPILER_NAMES: Record<string, string> = {
  '0': 'nothing',
  '1': 'hammer',
  '2': 'jekyll',
  '3': 'middleman',
  '4': 'webpack',
};

export function registerSettingsCommands(program: Command): void {
  program
    .command('settings')
    .description('Update site settings')
    .option('-s, --site <site>', 'Site name')
    .option('--ssl <on|off>', 'Enable or disable SSL')
    .option('--force-ssl <on|off>', 'Enable or disable forced HTTPS redirects')
    .option('--compiler <compiler>', 'Compiler (nothing, hammer, jekyll, middleman, webpack)')
    .option('--build-command <cmd>', 'Custom build command (e.g. "npm run build")')
    .option('--build-folder <folder>', 'Build output folder (e.g. "dist")')
    .option('--squish <on|off>', 'Enable or disable TurboJS minification')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
      });

      const body: Record<string, unknown> = { site_token: siteToken };
      const changes: [string, string][] = [];

      if (options.ssl) {
        body.ssl_enabled = options.ssl === 'on';
        changes.push(['SSL', options.ssl]);
      }
      if (options.forceSsl) {
        body.force_ssl_enabled = options.forceSsl === 'on';
        changes.push(['Force SSL', options.forceSsl]);
      }
      if (options.compiler) {
        body.compiler = options.compiler;
        changes.push(['Compiler', options.compiler]);
      }
      if (options.buildCommand) {
        body.build_command = options.buildCommand;
        changes.push(['Build Command', options.buildCommand]);
      }
      if (options.buildFolder) {
        body.build_folder = options.buildFolder;
        changes.push(['Build Folder', options.buildFolder]);
      }
      if (options.squish) {
        body.squish = options.squish === 'on';
        changes.push(['TurboJS', options.squish]);
      }

      if (!changes.length) {
        logger.error('No settings provided. Use --ssl, --compiler, --build-command, etc.');
        logger.dim('  Run `forge settings --help` for all options.');
        process.exit(1);
      }

      const spin = logger.spinner('Updating settings...');

      try {
        const client = getApiClient();
        const response = await client.request<SettingsResponse>(API_PATHS.settings, {
          method: 'PATCH',
          body,
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          const url = response.site?.url || 'site';
          logger.success(`Settings updated for ${url}:`);
          for (const [label, value] of changes) {
            logger.label(label, logger.statusBadge(value));
          }
          logger.info('');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
