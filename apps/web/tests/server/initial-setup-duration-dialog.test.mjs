import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("duration editor uses a native modal with contained cancel and focus restoration",async()=>{
 const control=await readFile(new URL("../../src/components/owner-web/price-guide-service-duration-control.tsx",import.meta.url),"utf8");
 assert.match(control,/<dialog/);assert.match(control,/dialog\?\.showModal\(\)/);
 assert.match(control,/event.preventDefault\(\); event.stopPropagation\(\); close\(\)/);
 assert.match(control,/triggerRef.current\?\.focus\(\)/);
 assert.match(control,/data-price-guide-service-duration-dialog="true"/);
 assert.doesNotMatch(control,/text-\[14px\]/);
});