// Generates an apply_patch input. Refuses extraction if the reviewed inputs differ.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replaceAll('\r\n', '\n');
let patch = '*** Begin Patch\n';
const add = (file, text) => { patch += `*** Add File: ${path.join(root, file)}\n` + text.trimEnd().split('\n').map(l => '+' + l).join('\n') + '\n'; };
const replace = (file, text) => {
  const old = read(file);
  patch += `*** Update File: ${path.join(root, file)}\n@@\n` + old.trimEnd().split('\n').map(l => '-' + l).join('\n') + '\n' + text.trimEnd().split('\n').map(l => '+' + l).join('\n') + '\n';
};
const commonImport = s => s.replace('"@/lib/utils"', '"../lib/cn"');
for (const name of ['form-field', 'mobile-back-button']) {
  const web = read(`apps/web/src/components/ui/${name}.tsx`);
  if (web !== read(`apps/mobile/src/components/ui/${name}.tsx`)) throw new Error('Components differ: ' + name);
  add(`apps/shared/components/${name}.tsx`, commonImport(web));
}
const buttonWeb = read('apps/web/src/components/ui/app-button.tsx');
const buttonMobile = read('apps/mobile/src/components/ui/app-button.tsx');
const sizeMap = /const SIZE_CLASS_MAP: Record<AppButtonSize, string> = \{[\s\S]*?\n\};/;
const webSizes = buttonWeb.match(sizeMap)?.[0], mobileSizes = buttonMobile.match(sizeMap)?.[0];
if (!webSizes || !mobileSizes || buttonWeb.replace(sizeMap, '') !== buttonMobile.replace(sizeMap, '')) throw new Error('Unreviewed button difference');
let button = commonImport(buttonWeb)
  .replace(sizeMap, webSizes.replace('SIZE_CLASS_MAP', 'WEB_SIZE_CLASS_MAP') + '\n\n' + mobileSizes.replace('SIZE_CLASS_MAP', 'MOBILE_SIZE_CLASS_MAP'))
  .replace('export const AppButton = forwardRef', 'function createAppButton(sizeClassMap: Record<AppButtonSize, string>) {\nreturn forwardRef')
  .replace('SIZE_CLASS_MAP[size]', 'sizeClassMap[size]')
  .replace('export default AppButton;', '}\n\nexport const WebAppButton = createAppButton(WEB_SIZE_CLASS_MAP);\nexport const MobileAppButton = createAppButton(MOBILE_SIZE_CLASS_MAP);');
add('apps/shared/components/app-button.tsx', button);
const inputWeb = read('apps/web/src/components/ui/app-input.tsx');
const inputMobile = read('apps/mobile/src/components/ui/app-input.tsx');
const inputStyle = /"h-12 w-full[^"\n]+"/;
const webInputStyle = inputWeb.match(inputStyle)?.[0], mobileInputStyle = inputMobile.match(inputStyle)?.[0];
if (!webInputStyle || !mobileInputStyle || inputWeb.replace(inputStyle, '') !== inputMobile.replace(inputStyle, '')) throw new Error('Unreviewed input difference');
const input = commonImport(inputWeb)
  .replace('export const AppInput = forwardRef', 'function createAppInput(inputClassName: string) {\nreturn forwardRef')
  .replace(inputStyle, 'inputClassName')
  .replace('export default AppInput;', `}\n\nexport const WebAppInput = createAppInput(${webInputStyle});\nexport const MobileAppInput = createAppInput(${mobileInputStyle});`);
add('apps/shared/components/app-input.tsx', input);
for (const [app, prefix] of [['web', 'Web'], ['mobile', 'Mobile']]) {
  replace(`apps/${app}/src/components/ui/app-button.tsx`, `export { ${prefix}AppButton as AppButton, ${prefix}AppButton as default } from "@petmanager/shared/components/app-button";\nexport type { AppButtonProps } from "@petmanager/shared/components/app-button";\n`);
  replace(`apps/${app}/src/components/ui/app-input.tsx`, `export { ${prefix}AppInput as AppInput, ${prefix}AppInput as default } from "@petmanager/shared/components/app-input";\nexport type { AppInputProps } from "@petmanager/shared/components/app-input";\n`);
  replace(`apps/${app}/src/components/ui/form-field.tsx`, 'export { FormField, default } from "@petmanager/shared/components/form-field";\nexport type { FormFieldProps } from "@petmanager/shared/components/form-field";\n');
  replace(`apps/${app}/src/components/ui/mobile-back-button.tsx`, 'export { MobileBackButton, MobileBackLinkButton, MobileBackAnchorButton, mobileBackButtonClassName, mobileBackIconClassName } from "@petmanager/shared/components/mobile-back-button";\n');
}
add('apps/shared/contracts/alimtalk.ts', read('packages/contracts/index.ts'));
patch += `*** Delete File: ${path.join(root, 'packages/contracts/index.ts')}\n`;
patch += `*** Delete File: ${path.join(root, 'packages/contracts/package.json')}\n`;
process.stdout.write(patch + '*** End Patch\n');
