import archiver from 'archiver';
import { createWriteStream, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import ignore from 'ignore';
import { IGNORE_FILE } from '../config/constants.js';

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.DS_Store',
  'forge.json',
  '.forgeignore',
];

export async function createDeployArchive(
  sourceDir: string,
  additionalIgnorePatterns: string[] = [],
): Promise<string> {
  const archivePath = join(tmpdir(), `forge-deploy-${randomUUID()}.zip`);
  const ig = ignore.default();

  ig.add(DEFAULT_IGNORE_PATTERNS);
  ig.add(additionalIgnorePatterns);

  const ignoreFilePath = join(sourceDir, IGNORE_FILE);
  if (existsSync(ignoreFilePath)) {
    const ignoreContent = readFileSync(ignoreFilePath, 'utf-8');
    ig.add(ignoreContent);
  }

  const resolvedSource = resolve(sourceDir);

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolvePromise(archivePath));
    archive.on('error', reject);

    archive.pipe(output);

    walkDirectory(resolvedSource, resolvedSource, ig, archive);

    archive.finalize();
  });
}

function walkDirectory(
  baseDir: string,
  currentDir: string,
  ig: ReturnType<typeof ignore.default>,
  archive: archiver.Archiver,
): void {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    const testPath = entry.isDirectory() ? relativePath + '/' : relativePath;
    if (ig.ignores(testPath)) continue;

    if (entry.isDirectory()) {
      walkDirectory(baseDir, fullPath, ig, archive);
    } else if (entry.isFile()) {
      archive.file(fullPath, { name: relativePath });
    }
  }
}
