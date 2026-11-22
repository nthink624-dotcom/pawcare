import assert from "node:assert/strict";
import test from "node:test";
import { isProviderOperationAllowed, isRelayOperationAllowed, readRelayAccessMode } from "../src/access-mode.js";

test("production default is preserved; invalid access mode fails closed", () => {
  assert.equal(readRelayAccessMode(undefined), "full");
  assert.equal(readRelayAccessMode("full"), "full");
  assert.equal(readRelayAccessMode("read-only"), "read-only");
  assert.throws(() => readRelayAccessMode("readonly"));
});

test("read-only provider transport permits only catalog endpoints, never sending or mutation", () => {
  for (const path of ["detail", "list", "category/all"]) {
    assert.equal(isProviderOperationAllowed("read-only", "https://apis.ssodaa.com/kakao/template/" + path), true);
  }
  for (const path of ["/kakao/send/alimtalk", "/kakao/template/add", "/kakao/template/request", "/kakao/template/stop", "/kakao/template/request/cancel", "/kakao/template/codeCheck"]) {
    assert.equal(isProviderOperationAllowed("read-only", "https://apis.ssodaa.com" + path), false);
    assert.equal(isProviderOperationAllowed("full", "https://apis.ssodaa.com" + path), true);
  }
  assert.equal(isProviderOperationAllowed("read-only", "https://other.example/kakao/template/list"), false);
  assert.equal(isRelayOperationAllowed("read-only", "GET", "/admin/config"), false);
  assert.equal(isRelayOperationAllowed("read-only", "POST", "/admin/templates"), false);
});
