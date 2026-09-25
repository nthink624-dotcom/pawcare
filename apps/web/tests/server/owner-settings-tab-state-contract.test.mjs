import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelPath = new URL("../../src/components/owner-web/settings-shop-info-panel.tsx", import.meta.url);

test("settings menu owns one active tab state and preserves the body scroll rail", async () => {
  const panel = await readFile(panelPath, "utf8");

  assert.match(panel, /const \[activeSectionId, setActiveSectionId\] = useState\(sectionTabs\[0\]\?\.id \?\? "basic"\);/);
  assert.match(panel, /function changeActiveSection\(sectionId: string\) \{[\s\S]*setActiveSectionId\(sectionId\);[\s\S]*scrollTo\(\{ top: 0, behavior: "auto" \}\);/);
  assert.doesNotMatch(panel, /function scrollToSection|addEventListener\("scroll", updateActiveSection/, "scroll position must not independently select a tab");

  assert.match(panel, /role="tablist"[\s\S]*aria-label="설정 메뉴"/);
  assert.match(panel, /role="tab"[\s\S]*aria-controls=\{`shop-info-panel-\$\{tab\.id\}`\}[\s\S]*aria-selected=\{activeSectionId === tab\.id\}/);
  assert.match(panel, /onClick=\{\(\) => changeActiveSection\(tab\.id\)\}[\s\S]*onKeyDown=\{\(event\) => handleSectionTabKeyDown\(event, tab\.id\)\}/);
  assert.match(panel, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\] focus-visible:ring-offset-2/);

  for (const id of ["basic", "staff-profile", "hours", "menu"]) {
    assert.match(
      panel,
      new RegExp(`id="shop-info-panel-${id}" role="tabpanel" aria-labelledby="shop-info-tab-${id}" hidden=\\{activeSectionId !== "${id}"\\}`),
      `${id} must render only while its matching tab is selected`,
    );
  }

  assert.match(panel, /min-h-\[54px\][\s\S]*overflow-x-auto overflow-y-hidden[\s\S]*\[scrollbar-width:none\] \[&::\-webkit-scrollbar\]:hidden/, "only the tab strip suppresses its cross-axis rail while retaining horizontal access");
  assert.match(panel, /ref=\{settingsScrollRef\} className="min-h-0 overflow-y-auto bg-white/, "the settings body retains its normal vertical scroll rail");
});
