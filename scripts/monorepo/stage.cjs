// Non-destructive import. Originals, ignored secrets, Git and caches stay put.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const backup = path.join(root, '.migration-backup/20260925');
const directories = new Set(['src', 'public', 'scripts', 'tests', 'docs', 'android', 'assets', 'capacitor-web']);
const configs = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'eslint.config.mjs', 'postcss.config.mjs', 'playwright.config.ts', 'capacitor.config.ts', '.gitignore', '.vercelignore', 'vercel.json', 'codemagic.yaml', '.env.example', '.env.local.example', 'README.md']);

function inside(base, relative) {
  const result = path.resolve(base, relative);
  if (!result.startsWith(base + path.sep)) throw new Error('Unsafe path: ' + relative);
  return result;
}
function assertPhysicalDirectory(directory) {
  const physical = fs.realpathSync(directory);
  if (physical.toLowerCase().startsWith('d:\\onedrive\\')) throw new Error('OneDrive destination prohibited');
  if (physical.toLowerCase() !== directory.toLowerCase()) throw new Error('Unexpected reparse point: ' + directory);
}
function git(source, args) {
  return cp.execFileSync('git', ['-c', 'safe.directory=' + source.replaceAll('\\', '/'), '-C', source, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function copyChecked(source, destination) {
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Refuse to follow link: ' + source);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  const hash = digest(source);
  if (digest(destination) !== hash) throw new Error('Copy verification failed: ' + source);
  return hash;
}

assertPhysicalDirectory(root);
fs.mkdirSync(backup, { recursive: true });
if (fs.existsSync(path.join(backup, 'stage-manifest.json'))) throw new Error('Stage already exists; inspect instead of overwriting.');
const manifest = { createdAt: new Date().toISOString(), originalsUnchanged: true, apps: [] };
for (const [app, source] of [['web', root], ['mobile', 'D:\\petmanager-app']]) {
  assertPhysicalDirectory(source);
  const destination = inside(root, 'apps/' + app);
  if (fs.existsSync(destination)) throw new Error('Destination already exists: ' + destination);
  const files = [...new Set(git(source, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))];
  const selected = files.filter(file => (directories.has(file.split('/')[0]) || configs.has(file)) && !file.startsWith('scripts/monorepo/') && file !== 'docs/monorepo-migration-progress.md');
  const item = { app, source, destination, head: git(source, ['rev-parse', 'HEAD']).trim(), branch: git(source, ['branch', '--show-current']).trim(), files: [], missingTrackedFiles: [] };
  for (const file of selected) {
    const from = inside(source, file);
    if (!fs.existsSync(from)) { item.missingTrackedFiles.push(file); continue; }
    const hash = copyChecked(from, inside(destination, file));
    item.files.push({ path: file, sha256: hash });
  }
  fs.mkdirSync(path.join(backup, app), { recursive: true });
  git(source, ['diff', '--binary', '--output=' + path.join(backup, app, 'working-tree.patch')]);
  git(source, ['diff', '--cached', '--binary', '--output=' + path.join(backup, app, 'index.patch')]);
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'AGENTS.md', '.gitignore']) {
    if (fs.existsSync(path.join(source, name))) copyChecked(path.join(source, name), path.join(backup, app, name));
  }
  manifest.apps.push(item);
  console.log(`${app}: ${item.files.length} files copied and SHA256 verified; original preserved.`);
}
fs.writeFileSync(path.join(backup, 'stage-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const originalContract = path.join(root, 'packages/alimtalk-contract/index.ts');
const mobileContract = 'D:\\petmanager-app\\packages\\alimtalk-contract\\index.ts';
if (digest(originalContract) !== digest(mobileContract)) throw new Error('Contract sources disagree; review required.');
copyChecked(originalContract, path.join(root, 'packages/contracts/index.ts'));
console.log('Shared contract source copied byte-for-byte. No DB, remote Git or deployment writes.');
