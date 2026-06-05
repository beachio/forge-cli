import { Command } from 'commander';
import { registerFeedbackListCommand } from './list.js';
import { registerFeedbackShowCommand } from './show.js';
import { registerFeedbackUpdateCommands } from './update.js';
import { registerFeedbackDeleteCommand } from './delete.js';

export function registerFeedbackCommands(program: Command): void {
  const feedback = program
    .command('feedback')
    .description('List and triage user feedback on staging and development sites')
    .option('-s, --site <site>', 'Site ID, name, or token (applies to subcommands)');

  registerFeedbackListCommand(feedback);
  registerFeedbackShowCommand(feedback);
  registerFeedbackUpdateCommands(feedback);
  registerFeedbackDeleteCommand(feedback);
}
