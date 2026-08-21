import { Command } from 'commander';
import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { getApiClient } from '../api/client.js';
import { resolveAuth, resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, validateOrgOption } from '../auth/org-context.js';
import { getStoredCredentials } from '../auth/token-store.js';
import { readForgeConfig } from '../config/forge-config.js';
import {
  completeDirectDeploy,
  deployViaLegacyMultipart,
  initDirectDeploy,
  isDirectUploadUnavailable,
  uploadArchiveToPresignedUrl,
} from '../deploy/direct-upload.js';
import { createDeployArchive } from '../utils/archive.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import { ForgePusherClient } from '../realtime/pusher-client.js';
import { DeployRenderer } from '../realtime/deploy-renderer.js';
import type { DeployDetail, DeployResponse } from '../api/endpoints.js';
import type { DeployLogEvent } from '../realtime/types.js';

const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Attaches handlers to an already-subscribed Pusher client and waits for
 * a terminal deploy event. The client must have been subscribed (and
 * buffering events) before the deploy is triggered.
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

function formatDeploySuccess(deploy: DeployDetail): string {
  return [
    `Deployed Version #${deploy.version_number} to ${deploy.url}`,
    logger.getOutputMode() === 'human'
      ? `  Status: ${logger.statusBadge(deploy.status)} | Mode: ${deploy.mode}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function resolveDeployResponse(options: {
  siteToken: string;
  archivePath: string;
  message?: string;
  cliToken?: string;
  legacyUpload: boolean;
}): Promise<DeployResponse> {
  const apiClient = getApiClient();

  if (options.legacyUpload) {
    return deployViaLegacyMultipart(apiClient, options);
  }

  try {
    const init = await initDirectDeploy(apiClient, options);
    await uploadArchiveToPresignedUrl(options.archivePath, init.upload);
    const complete = await completeDirectDeploy(apiClient, {
      deployId: init.deploy_id,
      cliToken: options.cliToken,
    });
    return complete;
  } catch (error) {
    if (!isDirectUploadUnavailable(error)) {
      throw error;
    }

    logger.dim('Direct upload unavailable; falling back to legacy deploy endpoint.');
    return deployViaLegacyMultipart(apiClient, options);
  }
}

async function handleDeployResult(options: {
  response: DeployResponse;
  pusherClient?: ForgePusherClient;
  watch: boolean;
}): Promise<void> {
  const { response, pusherClient, watch } = options;

  if (watch && pusherClient && response.deploy?.version_id) {
    const d = response.deploy;
    const renderer = new DeployRenderer(d.url, d.version_id, d.version_number);

    renderer.start();

    const result = await watchDeploy(pusherClient, d, renderer);

    renderer.finish(result.succeeded, result.failMessage);

    if (!result.succeeded) {
      process.exitCode = 1;
    }
    return;
  }

  pusherClient?.disconnect();

  if (response.deploy) {
    handleCommandResult(response, formatDeploySuccess(response.deploy));
  } else {
    handleCommandResult(
      response,
      `Deployed successfully${response.version ? ` (version ${response.version})` : ''}.`,
    );
  }
}

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy site to Forge')
    .option('-s, --site <site>', 'Site name to deploy to')
    .option('-m, --message <message>', 'Version description')
    .option('-d, --directory <dir>', 'Directory to deploy')
    .option('--no-watch', 'Skip real-time deploy tracking')
    .option('--legacy-upload', 'Upload archive via legacy multipart API endpoint')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const config = readForgeConfig();
      validateOrgOption(options.org);

      const auth = resolveAuth({ token: parentOpts.token });

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

      // Subscribe to Pusher before triggering deploy so we never miss early events.
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

        spin.text = 'Uploading archive...';
        const response = await resolveDeployResponse({
          siteToken,
          archivePath,
          message: options.message,
          cliToken: auth.token,
          legacyUpload: options.legacyUpload === true,
        });

        spin.stop();

        await handleDeployResult({
          response,
          pusherClient,
          watch: options.watch !== false,
        });
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
