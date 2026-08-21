import { Command } from 'commander';
import { readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, validateOrgOption } from '../auth/org-context.js';
import { getStoredCredentials } from '../auth/token-store.js';
import { readForgeConfig } from '../config/forge-config.js';
import { createDeployArchive } from '../utils/archive.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import { ForgePusherClient } from '../realtime/pusher-client.js';
import { DeployRenderer } from '../realtime/deploy-renderer.js';
import type { DeployResponse, DeployDetail } from '../api/endpoints.js';
import type { DeployLogEvent } from '../realtime/types.js';

const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Attaches handlers to an already-subscribed Pusher client and waits for
 * a terminal deploy event. The client must have been subscribed (and
 * buffering events) before the deploy POST was issued.
 */
function watchDeploy(
  client: ForgePusherClient,
  deploy: DeployDetail,
  renderer: DeployRenderer,
): Promise<{ succeeded: boolean; failMessage?: string }> {
  return new Promise((resolvePromise) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        client.disconnect();
        resolvePromise({ succeeded: false, failMessage: 'Timed out waiting for deploy status.' });
      }
    }, DEPLOY_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      client.disconnect();
    };

    const settle = (result: { succeeded: boolean; failMessage?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(result);
    };

    const onSignal = () => {
      settle({ succeeded: false, failMessage: 'Interrupted.' });
      process.exit(130);
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    client.attach({
      onLog(event: DeployLogEvent) {
        renderer.handleLog(event);

        if (event.version_id !== deploy.version_id) return;

        if (event.status === 'success') {
          settle({ succeeded: true });
        } else if (event.status === 'fail') {
          settle({ succeeded: false, failMessage: event.message });
        }
      },
      onVersionUpdate(event) {
        renderer.handleVersionUpdate(event);
      },
      onSiteUpdate(event) {
        renderer.handleSiteUpdate(event);

        if (event.site.id === deploy.site_id) {
          settle({ succeeded: true });
        }
      },
      onError(error) {
        settle({ succeeded: false, failMessage: `Realtime connection error: ${error.message}` });
      },
    });
  });
}

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy site to Forge')
    .option('-s, --site <site>', 'Site name to deploy to')
    .option('-m, --message <message>', 'Version description')
    .option('-d, --directory <dir>', 'Directory to deploy')
    .option('--no-watch', 'Skip real-time deploy tracking')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const config = readForgeConfig();
      validateOrgOption(options.org);

      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
        organisationId: options.org,
      });

      const deployDir = resolve(options.directory || config?.deploy_directory || '.');
      const stored = getStoredCredentials();
      const canWatch =
        options.watch !== false &&
        stored?.pusher_key &&
        stored?.pusher_channel;

      // Subscribe to Pusher BEFORE submitting the deploy so we never
      // miss events that fire immediately after the POST returns.
      let pusherClient: ForgePusherClient | undefined;
      if (canWatch) {
        pusherClient = new ForgePusherClient(stored.pusher_key!, stored.pusher_channel!);
        pusherClient.subscribe();
      }

      const spin = logger.spinner('Preparing deployment...');

      let archivePath: string | undefined;

      try {
        spin.text = 'Creating archive...';
        archivePath = await createDeployArchive(deployDir, config?.ignore);

        spin.text = 'Uploading...';
        const archiveBuffer = readFileSync(archivePath);
        const formData = new FormData();
        formData.append('site_tokens', siteToken);
        if (options.message) {
          formData.append('message', options.message);
        }
        formData.append(
          'archive',
          new Blob([archiveBuffer], { type: 'application/zip' }),
          'deploy.zip',
        );

        const apiClient = getApiClient();
        const response = await apiClient.post<DeployResponse>(API_PATHS.deploy, {
          body: formData as unknown as Record<string, unknown>,
        });

        spin.stop();

        if (pusherClient && response.deploy?.version_id) {
          const d = response.deploy;
          const renderer = new DeployRenderer(d.url, d.version_id, d.version_number);

          renderer.start();

          const result = await watchDeploy(pusherClient, d, renderer);

          renderer.finish(result.succeeded, result.failMessage);

          if (!result.succeeded) {
            process.exitCode = 1;
          }
        } else {
          pusherClient?.disconnect();

          if (response.deploy) {
            const d = response.deploy;
            handleCommandResult(response, [
              `Deployed Version #${d.version_number} to ${d.url}`,
              logger.getOutputMode() === 'human'
                ? `  Status: ${logger.statusBadge(d.status)} | Mode: ${d.mode}`
                : '',
            ].filter(Boolean).join('\n'));
          } else {
            handleCommandResult(
              response,
              `Deployed successfully${response.version ? ` (version ${response.version})` : ''}.`,
            );
          }
        }
      } catch (err) {
        spin.stop();
        pusherClient?.disconnect();
        throw err;
      } finally {
        if (archivePath) {
          try {
            unlinkSync(archivePath);
          } catch {}
        }
      }
    });
}
