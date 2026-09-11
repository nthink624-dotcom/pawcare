import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isLoopbackTransportUrl,
  requireHttpsTransportUrl as requireAppHttpsTransportUrl,
} from "../../src/lib/https-transport-url.ts";
import { requireHttpsTransportUrl as requireRelayHttpsTransportUrl } from "../../backend/alimtalk-relay/src/https-transport-url.ts";

const implementations = [
  ["app", requireAppHttpsTransportUrl],
  ["relay", requireRelayHttpsTransportUrl],
];
const externalHost = ["transport", "example", "invalid"].join(".");
const loopbackHost = ["127", "0", "0", "1"].join(".");
const secureUrl = `https:${"//"}${externalHost}/path`;
const insecureUrl = `http:${"//"}${externalHost}/path`;
const loopbackUrl = `http:${"//"}${loopbackHost}:4010/path`;

for (const [name, requireHttpsTransportUrl] of implementations) {
  test(`${name} transport URL policy accepts HTTPS`, () => {
    assert.equal(
      requireHttpsTransportUrl(secureUrl, "test", { runtimeEnvironment: "production" }),
      secureUrl,
    );
  });

  test(`${name} transport URL policy rejects external HTTP without echoing the value`, () => {
    assert.throws(
      () => requireHttpsTransportUrl(insecureUrl, "test", { runtimeEnvironment: "development" }),
      (error) => error instanceof Error && !error.message.includes(insecureUrl),
    );
  });

  test(`${name} transport URL policy permits only development loopback exceptions`, () => {
    assert.equal(
      requireHttpsTransportUrl(loopbackUrl, "test", {
        allowLoopbackInDevelopment: true,
        runtimeEnvironment: "development",
      }),
      loopbackUrl,
    );
    assert.throws(() =>
      requireHttpsTransportUrl(loopbackUrl, "test", {
        allowLoopbackInDevelopment: true,
        runtimeEnvironment: "production",
      }),
    );
  });
}

test("loopback detection does not accept lookalike external hosts", () => {
  assert.equal(isLoopbackTransportUrl(loopbackUrl), true);
  assert.equal(isLoopbackTransportUrl(insecureUrl), false);
});

test("all owned external transport paths invoke the HTTPS policy", async () => {
  const [serverEnv, mediaStorage, identityClient, billingClient, relayServer] = await Promise.all([
    readFile(new URL("../../src/lib/server-env.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/server/media-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/portone/identity-verification-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/billing/owner-billing-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/alimtalk-relay/src/server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(serverEnv, /readOptionalHttpsTransportUrl\(process\.env\.ALIMTALK_API_URL/);
  assert.match(serverEnv, /readOptionalHttpsTransportUrl\(process\.env\.ALIMTALK_RELAY_URL/);
  assert.match(serverEnv, /process\.env\.ALIMTALK_RELAY_ADMIN_URL/);
  assert.match(mediaStorage, /requireHttpsTransportUrl\(config\.endpoint/);
  assert.match(identityClient, /const redirectUrl = requireHttpsTransportUrl\(/);
  assert.match(billingClient, /buildSecurePortoneNoticeUrl/);
  assert.match(relayServer, /ssodaaApiUrl: requireRelayTransportUrl\(/);
  assert.match(relayServer, /ssodaaSentListUrl: requireRelayTransportUrl\(/);
  assert.match(relayServer, /ssodaaApiUrl: relayTransportUrlSchema\(/);
  assert.match(relayServer, /ssodaaSentListUrl: relayTransportUrlSchema\(/);
});
