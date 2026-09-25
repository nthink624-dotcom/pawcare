// One-time, exact relocation of filesystem references; never alters SQL or data.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink');
    return entry.isDirectory() ? walk(file) : [file];
  });
}
let changed = 0;
for (const app of ['web', 'mobile']) {
  for (const dir of ['tests', 'scripts']) {
    for (const file of walk(path.join(root, 'apps', app, dir))) {
      if (!/\.(cjs|mjs|ts|ps1|cmd)$/.test(file)) continue;
      const before = fs.readFileSync(file, 'utf8');
      let after = before
        .replaceAll('"supabase/', '"../../supabase/')
        .replaceAll('`supabase/', '`../../supabase/')
        .replaceAll('"backend/', '"../../backend/')
        .replace(/((?:path\.join|path\.resolve|resolve)\([^,\n]+, )"supabase"/g, '$1"../../supabase"')
        .replace(/((?:path\.join|path\.resolve|resolve)\([^,\n]+, )"backend"/g, '$1"../../backend"')
        .replaceAll('"supabase\\', '"..\\..\\supabase\\')
        .replaceAll('"backend\\', '"..\\..\\backend\\')
        .replaceAll('"../../petmanager/supabase/', '"../../../supabase/');
      if (after !== before) { fs.writeFileSync(file, after); changed++; }
    }
  }
}
console.log(`${changed} script/test files relocated to the shared backend/migration paths.`);
