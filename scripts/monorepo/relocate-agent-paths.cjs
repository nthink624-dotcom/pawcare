const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
for (const file of walk(path.join(root, 'tooling/agents'))) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replaceAll('D:\\petmanager-shared\\agents', 'D:\\petmanager\\tooling\\agents')
    .replaceAll('D:\\petmanager-shared\\docs', 'D:\\petmanager\\docs\\shared')
    .replaceAll('D:\\petmanager-app', 'D:\\petmanager\\apps\\mobile');
  // Only exact PC root references change; backend/shared root references stay root-relative.
  if (file.endsWith('pc.md') || file.endsWith('deployment-pc.md')) {
    text = text.replaceAll('`D:\\petmanager`', '`D:\\petmanager\\apps\\web`');
  }
  fs.writeFileSync(file, text);
}
console.log('Instruction paths relocated; private env source remains unchanged.');
