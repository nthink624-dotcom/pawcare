import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const devRef = "qefxdtmdtvnzgupmjlom";
const script = "import('./src/lib/server-env.ts').then(({serverEnv})=>console.log(JSON.stringify({relayConfigured:Boolean(serverEnv.alimtalkRelayUrl)})))";

function loadServerEnv(overrides) {
  return spawnSync(process.execPath, [
    "--experimental-transform-types",
    "--loader", "./tests/helpers/ts-paths-loader.mjs",
    "--input-type=module", "-e", script,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      SUPABASE_ENV_NAME: "development",
      SUPABASE_URL: `https://${devRef}.supabase.co`,
      ALLOWED_DEV_SUPABASE_REFS: devRef,
      NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS: "",
      ALIMTALK_API_URL: "",
      ALIMTALK_RELAY_ADMIN_URL: "",
      VERCEL: "",
      VERCEL_ENV: "",
      ...overrides,
    },
  });
}

test("local HTTP relay is allowed in a local next start only for an allowlisted development DB", () => {
  const result = loadServerEnv({ ALIMTALK_RELAY_URL: "http://127.0.0.1:14010" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\{"relayConfigured":true\}/);
});

test("external HTTP relays and hosted runtimes remain blocked", () => {
  const external = loadServerEnv({ ALIMTALK_RELAY_URL: "http://relay.example.invalid" });
  assert.notEqual(external.status, 0);

  const hosted = loadServerEnv({
    ALIMTALK_RELAY_URL: "http://127.0.0.1:14010",
    VERCEL_ENV: "preview",
  });
  assert.notEqual(hosted.status, 0);
});
