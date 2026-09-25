import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sheetPath = new URL("../src/components/ui/kakao-postcode-sheet.tsx", import.meta.url);
const sheet = await readFile(sheetPath, "utf8");

function loadFunction(name) {
  const sourceFile = ts.createSourceFile("kakao-postcode-sheet.tsx", sheet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${name} declaration should exist`);
  const output = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(`${output}; return ${name};`)();
}

test("postcode viewport detects an already-open keyboard and resets its baseline after rotation", () => {
  const resolvePostcodeViewportFrame = loadFunction("resolvePostcodeViewportFrame");
  const initialKeyboardFrame = resolvePostcodeViewportFrame({
    viewportHeight: 480,
    viewportWidth: 390,
    offsetTop: 12,
    layoutHeight: 480,
    screenHeight: 844,
    previousBaseline: { width: 0, height: 0 },
  });
  assert.deepEqual(
    { height: initialKeyboardFrame.height, offsetTop: initialKeyboardFrame.offsetTop, keyboardVisible: initialKeyboardFrame.keyboardVisible },
    { height: 480, offsetTop: 12, keyboardVisible: true },
  );

  const rotatedFrame = resolvePostcodeViewportFrame({
    viewportHeight: 390,
    viewportWidth: 844,
    offsetTop: 0,
    layoutHeight: 390,
    screenHeight: 390,
    previousBaseline: initialKeyboardFrame.baseline,
  });
  assert.equal(rotatedFrame.keyboardVisible, false);
  assert.equal(rotatedFrame.baseline.height, 390);
});

test("postcode sheet follows visual viewport resize and pan without a fixed 420 to 460 pixel frame", () => {
  assert.match(sheet, /window\.visualViewport/);
  assert.match(sheet, /viewport\?\.addEventListener\("resize", syncViewport\)/);
  assert.match(sheet, /viewport\?\.addEventListener\("scroll", syncViewport\)/);
  assert.match(sheet, /height: `\$\{viewportFrame\.height\}px`/);
  assert.match(sheet, /top: `\$\{viewportFrame\.offsetTop\}px`/);
  assert.match(sheet, /data-keyboard-visible=/);
  assert.doesNotMatch(sheet, /setFrameHeight|Math\.max\(420|h-\[460px\]/);
});

test("postcode search keeps only its embed in the remaining scrollable-height plane", () => {
  assert.match(sheet, /flex h-full max-h-\[680px\] min-h-0/);
  assert.match(sheet, /relative min-h-\[180px\] flex-1 overflow-hidden overscroll-contain/);
  assert.match(sheet, /data-testid="kakao-postcode-embed"/);
  assert.match(sheet, /className="h-full w-full"/);
  assert.match(sheet, /!keyboardVisible/);
});

test("postcode selection, close, detail-address guidance, and accessible close sizing stay intact", () => {
  assert.match(sheet, /onSelectRef\.current\(buildKakaoPostcodeAddress\(data\)\)/);
  assert.match(sheet, /onClick=\{onClose\}/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /min-h-11/);
  assert.match(sheet, /상세 주소는 아래 입력칸에 이어서 적을 수 있어요/);
  assert.match(sheet, /q: initialQueryRef\.current\.trim\(\) \|\| undefined/);
  assert.match(sheet, /autoClose: true/);
});
