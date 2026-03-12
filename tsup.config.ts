import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync } from 'node:fs';

export default defineConfig({
  entry: {
    'bin/forge-cli': 'bin/forge-cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: { entry: 'src/index.ts' },
  onSuccess: async () => {
    const cliPath = 'dist/bin/forge-cli.js';
    const content = readFileSync(cliPath, 'utf-8');
    if (!content.startsWith('#!')) {
      writeFileSync(cliPath, '#!/usr/bin/env node\n' + content);
    }
    const { chmodSync } = await import('node:fs');
    chmodSync(cliPath, 0o755);
  },
});
