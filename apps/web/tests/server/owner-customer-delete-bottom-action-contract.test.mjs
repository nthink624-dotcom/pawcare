import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer bulk delete action shares measured bottom chrome with the scroll clearance", async () => {
  const [ownerApp, selectionPanel] = await Promise.all([
    source("src/components/owner/owner-app.tsx"),
    source("src/components/owner/customer-delete-selection-panel.tsx"),
  ]);

  assert.match(ownerApp, /const bottomNavRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(ownerApp, /const customerDeleteActionRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(ownerApp, /new ResizeObserver\(measureChrome\)/);
  assert.match(ownerApp, /bottomNav\.getBoundingClientRect\(\)\.height/);
  assert.match(ownerApp, /deleteAction\.getBoundingClientRect\(\)\.height/);
  assert.match(
    ownerApp,
    /paddingBottom: `\$\{customerDeleteChromeMetrics\.navHeight \+ customerDeleteChromeMetrics\.actionHeight\}px`/,
  );
  assert.match(ownerApp, /style=\{[\s\S]*bottom: `\$\{customerDeleteChromeMetrics\.navHeight\}px`/);
  assert.match(ownerApp, /data-testid="customer-delete-bottom-action"/);
  assert.match(ownerApp, /aria-busy=\{saving\}/);
  assert.match(ownerApp, /className="fixed[^\"]*border-t border-\[var\(--border\)\] bg-white px-4 py-2"/);
  assert.match(ownerApp, /isCustomerDeleteActionVisible \? "pb-0" : "pb-4"/);
  assert.match(selectionPanel, /px-4 pb-2\.5 pt-3\.5/);
  assert.doesNotMatch(ownerApp, /pb-\[160px\]/);
  assert.doesNotMatch(ownerApp, /bottom-\[74px\]/);
});

test("customer bulk delete remains one guarded action with the established flow", async () => {
  const [ownerApp, ownerAppUi] = await Promise.all([
    source("src/components/owner/owner-app.tsx"),
    source("src/components/owner/owner-app-ui.tsx"),
  ]);

  assert.equal(ownerApp.match(/선택한 고객 삭제/g)?.length, 1);
  assert.match(ownerApp, /disabled=\{selectedGuardianCount === 0 \|\| saving\}/);
  assert.match(ownerApp, /onClick=\{deleteSelectedGuardians\}/);
  assert.match(ownerApp, /focus-visible:outline-\[#2563eb\]/);
  assert.match(ownerApp, /window\.confirm\(`선택한 고객 \$\{guardianIds\.length\}명을 삭제하시겠어요\?/);
  assert.match(ownerApp, /setSelectedGuardianIds\(\[\]\)/);
  assert.match(ownerAppUi, /flex h-\[46px\] w-full items-center justify-center/);
});
