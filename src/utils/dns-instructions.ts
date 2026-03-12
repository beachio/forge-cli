import chalk from 'chalk';
import * as logger from './logger.js';

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
}

export interface DnsInstructions {
  message: string;
  record: DnsRecord;
  verify_command: string;
  note: string;
}

export function displayDnsInstructions(domain: string, instructions: DnsInstructions): void {
  const { record, note } = instructions;

  logger.info('');
  logger.info(`  Domain:     ${domain}`);
  logger.info(`  DNS Status: ${chalk.yellow('NOT CONFIGURED')}`);
  logger.info('');
  logger.info('  Add this DNS record at your registrar:');

  logger.table(
    ['Type', 'Host', 'Value'],
    [[record.type, record.host, record.value]],
  );

  logger.info('');
  logger.dim(`  ${note}`);
  logger.info('');
  logger.dim(`  Then run: forge domain check --domain ${domain}`);
}

export function displayDnsVerified(domain: string): void {
  logger.info('');
  logger.info(`  Domain:     ${domain}`);
  logger.info(`  DNS Status: ${chalk.green('VERIFIED')} ${chalk.green('✓')}`);
  logger.info('');
  logger.dim(`  Ready to assign. Run:`);
  logger.dim(`  forge domain set --site-token <your-site-token> --domain ${domain}`);
}
