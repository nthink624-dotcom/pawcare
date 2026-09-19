import assert from "node:assert/strict";
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
