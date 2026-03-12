import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import {
  displayDnsInstructions,
  displayDnsVerified,
  type DnsInstructions,
} from '../../utils/dns-instructions.js';

interface DomainCheckResponse {
  domain: string;
  dns_valid: boolean;
  a_record: {
    found: boolean;
    records: string[];
    expected: string[];
  };
  instructions: DnsInstructions | null;
}

export function registerDomainCheckCommand(domain: Command): void {
  domain
    .command('check')
    .description('Check DNS configuration for a custom domain')
    .requiredOption('--domain <domain>', 'Domain to check (e.g. mysite.com)')
    .action(async (options, cmd) => {
      const rootOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: rootOpts.token });

      const spin = logger.spinner(`Checking DNS for ${options.domain}...`);

      try {
        const client = getApiClient();
        const response = await client.get<DomainCheckResponse>(API_PATHS.domainCheck, {
          token: auth.token,
          query: { domain: options.domain },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          if (response.dns_valid) {
            displayDnsVerified(response.domain);
          } else if (response.instructions) {
            displayDnsInstructions(response.domain, response.instructions);
          }
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
