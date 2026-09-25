// Mechanical package/lock relocation. Uses existing exact resolved versions.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
if (fs.existsSync(path.join(root, 'apps/shared'))) throw new Error('Historical one-time initializer: apps/shared is already configured. Do not rerun.');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, ''));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n');
const baseline = '.migration-backup/20260925';
const oldRoot = read(`${baseline}/web/package.json`);
const contracts = read('packages/contracts/package.json');
for (const app of ['web', 'mobile']) {
  const pkg = read(`apps/${app}/package.json`);
  pkg.name = `@petmanager/${app}`;
  pkg.dependencies['@petmanager/contracts'] = '0.0.0';
  pkg.scripts['dev:backend'] = 'npm --prefix ../../backend run dev';
  pkg.scripts['typecheck:backend'] = 'npm --prefix ../../backend run typecheck';
  // Keep CLI operations anchored to the single root migration history.
  for (const key of Object.keys(pkg.scripts)) {
    pkg.scripts[key] = pkg.scripts[key].replaceAll('npx supabase ', 'npx supabase --workdir ../.. ');
  }
  write(`apps/${app}/package.json`, pkg);
}
const scripts = {};
for (const name of Object.keys(oldRoot.scripts)) {
  // npm already invokes lifecycle hooks in the target workspace.
  if (name.startsWith('pre') && oldRoot.scripts[name.slice(3)]) continue;
  scripts[name] = `npm run ${name} --workspace=@petmanager/web`;
}
Object.assign(scripts, {
  'dev:web': 'npm run dev:local --workspace=@petmanager/web',
  'dev:mobile': 'npm run dev:local --workspace=@petmanager/mobile',
  'build:web': 'npm run build --workspace=@petmanager/web',
  'build:mobile': 'npm run build --workspace=@petmanager/mobile',
  'build': 'npm run build:web && npm run build:mobile',
  'typecheck:web': 'npm run typecheck --workspace=@petmanager/web',
  'typecheck:mobile': 'npm run typecheck --workspace=@petmanager/mobile',
  'typecheck': 'npm run typecheck:web && npm run typecheck:mobile',
  'typecheck:backend': 'npm --prefix backend run typecheck',
  'test:workspace': 'node --test scripts/monorepo/workspace-test.mjs',
  'test:mobile': 'npm run test:price-guide-core --workspace=@petmanager/mobile',
  'android:sync': 'npm run cap:sync:android --workspace=@petmanager/mobile',
  'android:open': 'npm run cap:open:android --workspace=@petmanager/mobile',
  'android:build': 'npm exec --workspace=@petmanager/mobile -- cap build android',
  'android:release': 'npm run android:release --workspace=@petmanager/mobile',
  'dev:backend': 'npm --prefix backend run dev',
});
const pkg = { name: 'petmanager', private: true, workspaces: ['apps/web', 'apps/mobile', 'packages/contracts'], scripts };
write('package.json', pkg);

const oldLock = read(`${baseline}/web/package-lock.json`);
const mobileLock = read(`${baseline}/mobile/package-lock.json`);
const lock = { name: pkg.name, lockfileVersion: 3, requires: true, packages: { ...oldLock.packages } };
lock.packages[''] = { name: pkg.name, workspaces: pkg.workspaces };
for (const app of ['web', 'mobile']) {
  const appPkg = read(`apps/${app}/package.json`);
  lock.packages[`apps/${app}`] = { name: appPkg.name, dependencies: appPkg.dependencies, devDependencies: appPkg.devDependencies };
  lock.packages[`node_modules/@petmanager/${app}`] = { resolved: `apps/${app}`, link: true };
}
// Preserve the mobile graph independently, including versions that differ from web.
for (const [location, entry] of Object.entries(mobileLock.packages)) {
  if (location) lock.packages[`apps/mobile/${location}`] = entry;
}
lock.packages['packages/contracts'] = { name: contracts.name, version: contracts.version };
lock.packages['node_modules/@petmanager/contracts'] = { resolved: 'packages/contracts', link: true };
write('package-lock.json', lock);
console.log('Workspace manifests and unified lockfile generated without upgrading dependencies.');
