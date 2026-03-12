import { Command } from 'commander';
import inquirer from 'inquirer';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { storeCredentials } from '../auth/token-store.js';
import { AccountLockedError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import type { LoginResponse } from '../api/endpoints.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with Forge')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .option('--with-token <token>', 'Store an existing CLI token directly')
    .option('--browser', 'Use OAuth2 browser-based login')
    .action(async (options, cmd) => {
      const directToken = options.withToken || cmd.parent?.opts()?.token;

      if (directToken) {
        await loginWithToken(directToken);
        return;
      }

      if (options.browser) {
        await loginWithBrowser();
        return;
      }

      await loginWithCredentials(options.email, options.password);
    });
}

async function loginWithToken(token: string): Promise<void> {
  storeCredentials({
    token,
    token_type: 'cli',
  });
  handleCommandResult(
    { success: true, method: 'token' },
    'CLI token stored. Run `forge whoami` to verify.',
  );
}

async function loginWithBrowser(): Promise<void> {
  const { startOAuthFlow } = await import('../auth/oauth-server.js');
  await startOAuthFlow();
}

async function loginWithCredentials(email?: string, password?: string): Promise<void> {
  if (!email || !password) {
    const answers = await inquirer.prompt([
      ...(!email
        ? [{ type: 'input' as const, name: 'email', message: 'Email:' }]
        : []),
      ...(!password
        ? [{ type: 'password' as const, name: 'password', message: 'Password:', mask: '*' }]
        : []),
    ]);
    email = email || answers.email;
    password = password || answers.password;
  }

  const spin = logger.spinner('Logging in...');

  try {
    const client = getApiClient();
    const response = await client.post<LoginResponse>(API_PATHS.login, {
      body: { email, password },
    });

    if (response.locked) {
      spin.fail();
      throw new AccountLockedError(response.retry_after_seconds || 1800);
    }

    storeCredentials({
      token: response.access_token,
      token_type: 'cli',
      user_email: email,
      user_name: response.name,
      site_tokens: response.site_tokens,
      pusher_key: response.pusher_key,
      pusher_channel: response.pusher_channel,
      organisation_id: null,
      organisation_name: null,
    });

    spin.stop();

    const orgs = response.organisations;
    const resultPayload: Record<string, unknown> = {
      success: true,
      method: 'email',
      user: response.name || email,
    };
    if (orgs?.length) {
      resultPayload.organisations = orgs;
    }

    handleCommandResult(
      resultPayload,
      `Logged in as ${response.name || email}`,
    );

    if (logger.getOutputMode() === 'human' && orgs?.length) {
      logger.info(`  Organisations: ${orgs.map((o) => o.name).join(', ')}`);
      logger.dim('  Switch with: forge org switch --id <org-id>');
    }
  } catch (err) {
    spin.stop();
    throw err;
  }
}
