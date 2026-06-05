import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export type OutputMode = 'human' | 'json' | 'quiet';

let currentMode: OutputMode = 'human';

export function setOutputMode(mode: OutputMode): void {
  currentMode = mode;
}

export function getOutputMode(): OutputMode {
  return currentMode;
}

export function info(message: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.log(message);
}

export function success(message: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.log(chalk.green('✔') + ' ' + message);
}

export function warn(message: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.warn(chalk.yellow('⚠') + ' ' + message);
}

export function error(message: string): void {
  if (currentMode === 'json') return;
  console.error(chalk.red('✖') + ' ' + message);
}

export function dim(message: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.log(chalk.dim(message));
}

export function label(name: string, value: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.log(`  ${chalk.dim(name.padEnd(18))} ${value}`);
}

export function bold(message: string): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;
  console.log(chalk.bold(message));
}

export function statusBadge(value: string): string {
  switch (value) {
    case 'active':
    case 'deployed':
    case 'on':
    case 'true':
    case 'success':
      return chalk.green(value);
    case 'previous':
    case 'queued':
    case 'deploying':
      return chalk.yellow(value);
    case 'superseded':
    case 'off':
    case 'false':
      return chalk.dim(value);
    case 'failed':
      return chalk.red(value);
    case 'open':
      return chalk.yellow(value);
    case 'resolved':
      return chalk.green(value);
    case 'dismissed':
      return chalk.dim(value);
    default:
      return value;
  }
}

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function spinner(text: string): Ora {
  if (currentMode !== 'human') {
    return ora({ text, isSilent: true });
  }
  return ora(text).start();
}

export function table(headers: string[], rows: string[][]): void {
  if (currentMode === 'quiet') return;
  if (currentMode === 'json') return;

  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map((w) => '─'.repeat(w)).join('──');

  console.log(chalk.bold(headerLine));
  console.log(chalk.dim(separator));
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(colWidths[i])).join('  '));
  }
}
