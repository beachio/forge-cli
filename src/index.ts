import { Command, CommanderError } from 'commander';
import { VERSION } from './config/constants.js';
import { setOutputMode, getOutputMode } from './utils/logger.js';
import {
  ForgeError,
  RateLimitError,
  AuthError,
  ScopeError,
  AccountLockedError,
} from './utils/errors.js';
import * as logger from './utils/logger.js';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWhoamiCommand } from './commands/whoami.js';
import { registerTokenCommands } from './commands/token/index.js';
import { registerSitesCommand } from './commands/sites.js';
import { registerCreateCommand } from './commands/create.js';
import { registerAddCommand } from './commands/add.js';
import { registerInfoCommand } from './commands/info.js';
import { registerDeployCommand } from './commands/deploy.js';
import { registerRedeployCommand } from './commands/redeploy.js';
import { registerRollbackCommand } from './commands/rollback.js';
import { registerVersionsCommand } from './commands/versions.js';
import { registerInitCommand } from './commands/init.js';
import { registerSettingsCommands } from './commands/settings/index.js';
import { registerEnvCommands } from './commands/env.js';
import { registerDestroyCommand } from './commands/destroy.js';
import { registerUsageCommand } from './commands/usage.js';
import { registerDomainCommands } from './commands/domain/index.js';
import { registerOrgCommands } from './commands/org/index.js';
import { registerProjectCommands } from './commands/projects/index.js';
import { registerFeedbackCommands } from './commands/feedback/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('forge')
    .description('Command line interface for GetForge.com')
    .version(VERSION, '-v, --version')
    .option('--json', 'Output results as JSON')
    .option('--quiet', 'Suppress all output except errors')
    .option('--debug-http', 'Print full HTTP request/response debug logs')
    .option('--token <token>', 'CLI token for authentication')
    .option('--site-token <token>', 'Site token for authentication')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.json) setOutputMode('json');
      else if (opts.quiet) setOutputMode('quiet');
      if (opts.debugHttp) process.env.FORGE_DEBUG_HTTP = '1';
    });

  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerWhoamiCommand(program);
  registerTokenCommands(program);
  registerSitesCommand(program);
  registerCreateCommand(program);
  registerAddCommand(program);
  registerInfoCommand(program);
  registerDeployCommand(program);
  registerRedeployCommand(program);
  registerRollbackCommand(program);
  registerVersionsCommand(program);
  registerInitCommand(program);
  registerSettingsCommands(program);
  registerEnvCommands(program);
  registerDestroyCommand(program);
  registerUsageCommand(program);
  registerDomainCommands(program);
  registerOrgCommands(program);
  registerProjectCommands(program);
  registerFeedbackCommands(program);

  program.exitOverride((err) => {
    if (err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    throw err;
  });

  process.on('uncaughtException', (err) => handleError(err));
  process.on('unhandledRejection', (err) => handleError(err));

  return program;
}

function handleError(err: unknown): void {
  if (err instanceof CommanderError) {
    if (err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    if (
      err.code === 'commander.missingArgument' ||
      err.code === 'commander.missingMandatoryOptionValue'
    ) {
      logger.error(err.message);
      process.exit(1);
    }
  }

  if (getOutputMode() === 'json' && err instanceof ForgeError) {
    const errorPayload: Record<string, unknown> = {
      error: true,
      message: err.message,
      code: err.exitCode,
    };
    if (err instanceof RateLimitError) errorPayload.retry_after_seconds = err.retryAfterSeconds;
    if (err instanceof ScopeError) {
      errorPayload.required_scope = err.requiredScope;
      errorPayload.token_scopes = err.tokenScopes;
    }
    if (err instanceof AuthError) errorPayload.token_expired = err.tokenExpired;
    if (err instanceof AccountLockedError)
      errorPayload.retry_after_seconds = err.retryAfterSeconds;
    logger.json(errorPayload);
    process.exit(err.exitCode);
  }

  if (err instanceof RateLimitError) {
    logger.error(err.message);
    logger.dim(`  Retry after ${err.retryAfterSeconds} seconds.`);
    process.exit(err.exitCode);
  }

  if (err instanceof AccountLockedError) {
    logger.error(err.message);
    process.exit(err.exitCode);
  }

  if (err instanceof ForgeError) {
    logger.error(err.message);
    process.exit(err.exitCode);
  }

  if (err instanceof Error) {
    logger.error(err.message);
  } else {
    logger.error(String(err));
  }

  process.exit(1);
}

export { VERSION } from './config/constants.js';
export { ApiClient, getApiClient } from './api/client.js';
export { resolveAuth, resolveSiteToken } from './auth/resolver.js';
export { getStoredCredentials, storeCredentials, clearCredentials } from './auth/token-store.js';
export { readForgeConfig, writeForgeConfig } from './config/forge-config.js';
export type { ForgeConfig } from './config/forge-config.js';
export type { AuthContext } from './auth/resolver.js';
export type { StoredCredentials } from './auth/token-store.js';
