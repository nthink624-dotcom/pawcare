const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const manifestPath = path.join(root, '.migration-backup/20260925/stage-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const hash = contents => crypto.createHash('sha256').update(contents).digest('hex');
let checked = 0;
const failures = [];
function extractedUiAdapter(app, name) {
  const prefix = app === 'web' ? 'Web' : 'Mobile';
  if (name === 'app-button') return `export { ${prefix}AppButton as AppButton, ${prefix}AppButton as default } from "@petmanager/shared/components/app-button";\nexport type { AppButtonProps } from "@petmanager/shared/components/app-button";\n`;
  if (name === 'app-input') return `export { ${prefix}AppInput as AppInput, ${prefix}AppInput as default } from "@petmanager/shared/components/app-input";\nexport type { AppInputProps } from "@petmanager/shared/components/app-input";\n`;
  if (name === 'form-field') return 'export { FormField, default } from "@petmanager/shared/components/form-field";\nexport type { FormFieldProps } from "@petmanager/shared/components/form-field";\n';
  return 'export { MobileBackButton, MobileBackLinkButton, MobileBackAnchorButton, mobileBackButtonClassName, mobileBackIconClassName } from "@petmanager/shared/components/mobile-back-button";\n';
}
for (const app of manifest.apps) {
  for (const entry of app.files) {
    if (!/^(src|public|android|assets|capacitor-web)\//.test(entry.path)) continue;
    const original = path.join(app.source, entry.path);
    const imported = path.join(app.destination, entry.path);
    if (!fs.existsSync(original) || !fs.existsSync(imported)) {
      failures.push(`${app.app}/${entry.path}: missing file`); continue;
    }
    const originalData = fs.readFileSync(original);
    if (hash(originalData) !== entry.sha256) failures.push(`${app.app}/${entry.path}: original changed after snapshot`);
    let expected = originalData;
    const uiMatch = entry.path.match(/^src\/components\/ui\/(app-button|app-input|form-field|mobile-back-button)\.tsx$/);
    if (uiMatch) {
      const adapter = fs.readFileSync(imported, 'utf8').replaceAll('\r\n', '\n').trim();
      if (adapter !== extractedUiAdapter(app.app, uiMatch[1]).trim()) failures.push(`${app.app}/${entry.path}: unexpected UI adapter edit`);
      checked++; continue;
    }
    if (entry.path === 'src/app/globals.css') {
      const withoutSharedSource = fs.readFileSync(imported, 'utf8').replaceAll('\r\n', '\n').replace('@source "../../../shared/components";\n' + (app.app === 'mobile' ? '\n' : ''), '');
      if (withoutSharedSource !== originalData.toString('utf8').replaceAll('\r\n', '\n')) failures.push(`${app.app}/${entry.path}: unexpected stylesheet edit`);
      checked++; continue;
    }
    if (entry.path === 'src/lib/notification-registry.ts') {
      // apply_patch normalizes line endings; only this import is intentionally different.
      expected = Buffer.from(originalData.toString('utf8').replaceAll('\r\n', '\n').replace('"@petmanager-contract/index"', '"@petmanager/shared/contracts/alimtalk"'));
      const importedData = Buffer.from(fs.readFileSync(imported, 'utf8').replaceAll('\r\n', '\n'));
      if (hash(importedData) !== hash(expected)) failures.push(`${app.app}/${entry.path}: unexpected registry edit`);
    } else if (hash(fs.readFileSync(imported)) !== entry.sha256) {
      failures.push(`${app.app}/${entry.path}: content changed during import`);
    }
    checked++;
  }
}
const result = { checked, failures, verifiedAt: new Date().toISOString() };
fs.writeFileSync(path.join(root, '.migration-backup/20260925/source-preservation.json'), JSON.stringify(result, null, 2) + '\n');
if (failures.length) {
  console.error(failures.join('\n')); process.exitCode = 1;
} else console.log(`${checked} product source/asset/native files preserved apart from the reviewed shared imports, UI adapters and CSS scan paths. Run shared-ui-parity.test.cjs for extracted UI equivalence.`);
