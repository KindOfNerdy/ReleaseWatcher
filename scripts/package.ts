// Creates a ready-to-run release folder: server sources, the production UI build and the
// production dependencies, so the target machine only needs Node.js (no npm install, no Angular build).
//
// Usage: node scripts/package.ts [version]   (version defaults to package.json "version")
// Output: release/releasewatcher-<version>/
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = (process.argv[2] ?? pkg.version).replace(/^v/, '');
const name = `releasewatcher-${version}`;
const out = join(root, 'release', name);

function run(command: string, args: string[], cwd: string): void {
  // shell: true so that npm resolves to npm.cmd on Windows
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--skip-build')) run('npm', ['run', 'build'], root);
if (!existsSync(join(root, 'public', 'index.html'))) {
  console.error('public/index.html is missing, run `npm run build` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of ['src', 'public', 'README.md', '.env.example', 'Dockerfile', 'docker-compose.yml']) {
  cpSync(join(root, entry), join(out, entry), { recursive: true });
}

// Install production dependencies of the server only (the Angular workspace is not needed at runtime).
const install = join(root, 'release', `.install-${version}`);
rmSync(install, { recursive: true, force: true });
mkdirSync(join(install, 'web'), { recursive: true });
for (const file of ['package.json', 'package-lock.json']) cpSync(join(root, file), join(install, file));
cpSync(join(root, 'web', 'package.json'), join(install, 'web', 'package.json'));
run('npm', ['ci', '--omit=dev', '--workspaces=false', '--ignore-scripts', '--no-audit', '--no-fund'], install);
cpSync(join(install, 'node_modules'), join(out, 'node_modules'), { recursive: true });
rmSync(install, { recursive: true, force: true });

// Runtime-only package.json: no workspaces, no dev tooling, dependencies already installed.
const nodeFlags = '--disable-warning=ExperimentalWarning';
const runtimePkg = {
  name: pkg.name,
  version,
  private: true,
  description: pkg.description,
  type: pkg.type,
  engines: pkg.engines,
  scripts: { start: `node ${nodeFlags} src/main.ts`, serve: `node ${nodeFlags} src/main.ts` },
  dependencies: pkg.dependencies,
};
writeFileSync(join(out, 'package.json'), JSON.stringify(runtimePkg, null, 2) + '\n');

console.log(`\nRelease folder ready: release/${name}`);
console.log('Run it with: npm start   (or: node --disable-warning=ExperimentalWarning src/main.ts)');
