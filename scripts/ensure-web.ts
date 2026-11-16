// Builds the Angular UI into public/ when it is missing or older than its sources,
// so `npm start` always serves an up-to-date UI without a separate build step.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const output = join(root, 'public', 'index.html');
const sources = ['web/src', 'web/public', 'web/angular.json', 'web/package.json', 'web/tsconfig.json', 'web/tsconfig.app.json'];

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path)) {
    newest = Math.max(newest, newestMtime(join(path, entry)));
  }
  return newest;
}

const builtAt = existsSync(output) ? statSync(output).mtimeMs : 0;
const changedAt = Math.max(...sources.map((source) => newestMtime(join(root, source))));

if (process.argv.includes('--force') || builtAt < changedAt) {
  console.log(builtAt ? 'UI sources changed, rebuilding the UI...' : 'UI not built yet, building it...');
  // shell: true so that npm resolves to npm.cmd on Windows
  const result = spawnSync('npm', ['run', 'build', '--workspace', 'web'], { cwd: root, stdio: 'inherit', shell: true });
  process.exit(result.status ?? 1);
} else {
  console.log('UI is up to date.');
}
