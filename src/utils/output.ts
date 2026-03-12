import { getOutputMode } from './logger.js';
import * as logger from './logger.js';

export function formatOutput(data: unknown): void {
  const mode = getOutputMode();
  if (mode === 'json') {
    logger.json(data);
  }
}

export function handleCommandResult(data: unknown, humanMessage?: string): void {
  const mode = getOutputMode();

  if (mode === 'json') {
    logger.json(data);
    return;
  }

  if (mode === 'quiet') return;

  if (humanMessage) {
    logger.success(humanMessage);
  }
}
