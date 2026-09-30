import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOwnerShellConfig,
  CANONICAL_OWNER_MOBILE_WEB_URL,
} from "../src/config/owner-web.ts";

test("the canonical owner mobile URL is direct and uses the app host", () => {
  const config = buildOwnerShellConfig(CANONICAL_OWNER_MOBILE_WEB_URL);

  assert.equal(config.url, CANONICAL_OWNER_MOBILE_WEB_URL);
  assert.deepEqual(config.allowNavigation, ["app.petmanager.co.kr"]);
  assert.equal(config.cleartext, false);
});

test("the public www site cannot be used as the native shell URL", () => {
  assert.throws(
    () => buildOwnerShellConfig("https://www.petmanager.co.kr"),
    /OWNER_MOBILE_WEB_URL must point directly to https:\/\/app\.petmanager\.co\.kr\/owner\/mobile/,
  );
});

test("the app host must include the owner mobile route", () => {
  assert.throws(
    () => buildOwnerShellConfig("https://app.petmanager.co.kr"),
    /OWNER_MOBILE_WEB_URL must include the owner route/,
  );
});
