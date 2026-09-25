import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPriceGuidePhotoImportFixture } from "../../src/lib/price-guide-photo-import-fixture.ts";
import { priceGuideDraftKey, savePriceGuideTemporaryDraft, readPriceGuideTemporaryDraft, PRICE_GUIDE_DRAFT_TTL } from "../../src/lib/price-guide-temporary-draft.ts";
const storage = () => { const values = new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
test("incomplete imported prices survive storage and remain owner/shop scoped",()=>{
 const store=storage(), key=priceGuideDraftKey("owner-a","shop-a");
 const document=createPriceGuidePhotoImportFixture().document;
 document.rows[0].durationMinutes=null;document.rows[1].priceMinKrw=null;
 savePriceGuideTemporaryDraft(store,key,document,1000);
 assert.deepEqual(readPriceGuideTemporaryDraft(store,key,1001),document);
 assert.equal(readPriceGuideTemporaryDraft(store,priceGuideDraftKey("owner-b","shop-a"),1001),null);
 assert.equal(readPriceGuideTemporaryDraft(store,priceGuideDraftKey("owner-a","shop-b"),1001),null);
 assert.equal(readPriceGuideTemporaryDraft(store,key,1000+PRICE_GUIDE_DRAFT_TTL),null);
 assert.equal(store.getItem(key),null);
});
test("malformed data is discarded and extra file/auth fields cannot enter storage",()=>{
 const store=storage(), key=priceGuideDraftKey("owner","shop");
 store.setItem(key,"invalid json");assert.equal(readPriceGuideTemporaryDraft(store,key),null);
 const document=createPriceGuidePhotoImportFixture().document;
 assert.throws(()=>savePriceGuideTemporaryDraft(store,key,{...document,accessToken:"not-a-real-token",photoUrl:"blob:test"}));
 assert.equal(store.getItem(key),null);
});
test("quota errors propagate rather than report a successful save",()=>{
 const store=storage();store.setItem=()=>{throw new Error("quota");};
 assert.throws(()=>savePriceGuideTemporaryDraft(store,"key",createPriceGuidePhotoImportFixture().document),/quota/);
});

test("editing is automatically persisted across browser sessions and restored in the same editor", async()=>{
 const [hook, photo, manual] = await Promise.all([
  readFile(new URL("../../src/components/owner-web/use-price-guide-temporary-draft.ts", import.meta.url), "utf8"),
  readFile(new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../src/components/owner-web/price-guide-manual-onboarding.tsx", import.meta.url), "utf8"),
 ]);
 assert.match(hook,/const persistedResume = readPriceGuideTemporaryDraft\(localStorage, editingKey\)/);
 assert.match(hook,/const sessionResume = readPriceGuideTemporaryDraft\(sessionStorage, editingKey\)/);
 assert.match(hook,/savePriceGuideTemporaryDraft\(localStorage, editingKey, document\)/);
 assert.match(hook,/localStorage\.setItem\(`\$\{editingKey\}:mode`, editorMode\)/);
 assert.match(hook,/작성 내용이 자동 저장됐어요/);
 assert.match(photo,/setEditorMode\(temporaryDraft\.resumeEditorMode \?\? "photo-review"\)/);
 assert.match(photo,/temporaryDraft\.rememberEditing\(document, "direct"\)/);
 assert.match(photo,/temporaryDraft\.rememberEditing\(document, "photo-review"\)/);
 assert.match(manual,/data-price-guide-autosave-status/);
 assert.doesNotMatch(`${photo}\n${manual}`,/>임시 저장<\/button>/);
});
