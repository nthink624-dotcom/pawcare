import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("production blocks temporary web debug endpoints before auth or sensitive work", async () => {
  const [notificationAudit, alimtalkRelay] = await Promise.all([
    read("src/app/api/debug/notification-audit/route.ts"),
    read("src/app/api/debug/alimtalk-relay/route.ts"),
  ]);

  for (const [name, source, signature, sensitiveOperation] of [
    [
      "notification audit",
      notificationAudit,
      /export async function GET\(request: NextRequest\) \{\s*if \(process\.env\.NODE_ENV === "production"\)/,
      /requireAdminSession\(|getBootstrap\(|fetchRelayDiagnostics\(|serverEnv\.alimtalkRelaySecret/,
    ],
    [
      "Alimtalk relay diagnostic",
      alimtalkRelay,
      /export async function GET\(request: NextRequest\) \{\s*if \(process\.env\.NODE_ENV === "production"\)/,
      /requireAdminSession\(|process\.env\.ALIMTALK_RELAY_SECRET|fetch\(/,
    ],
  ]) {
    const handlerStart = source.search(signature);
    assert.notEqual(handlerStart, -1, `${name} must reject production requests immediately`);
    const handler = source.slice(handlerStart);
    assert.match(handler, /return new Response\(null,\s*\{\s*status: 404,\s*headers: \{\s*"Cache-Control": "no-store"/);
    const guardEnd = handler.search(/\n\s*}\s*/);
    const sensitiveIndex = handler.search(sensitiveOperation);
    assert.ok(guardEnd !== -1 && sensitiveIndex > guardEnd, `${name} must stop before auth or sensitive work`);
  }
});

test("production deployments cannot enable development data endpoints through a mistaken environment label", async () => {
  const [demoEnvironment, createOwner, seedDemo, seedMongshop, signupDemo, mobileSeedDemo, testOwnerGuard] = await Promise.all([
    read("src/lib/development-demo.ts"),
    read("src/app/api/dev/create-owner/route.ts"),
    read("src/app/api/dev/seed-demo/route.ts"),
    read("src/app/api/dev/seed-mongshop-demo/route.ts"),
    read("src/app/api/dev/signup-flow-demo/complete/route.ts"),
    read("../mobile/src/app/api/dev/seed-demo/route.ts"),
    read("src/server/dev-test-owner.ts"),
  ]);

  assert.match(demoEnvironment, /process\.env\.NODE_ENV !== "production"/);
  assert.match(demoEnvironment, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(demoEnvironment, /NEXT_PUBLIC_SUPABASE_ENV_NAME === "development"/);
  assert.match(seedDemo, /process\.env\.NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.match(mobileSeedDemo, /process\.env\.NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.match(seedMongshop, /!isDevelopmentDemoEnvironment\(\)/);
  assert.match(signupDemo, /process\.env\.NODE_ENV !== "development" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.match(createOwner, /assertDevelopmentTestOwnerRequest\(request\.nextUrl\.hostname\)/);
  assert.match(testOwnerGuard, /target\.runtimeStage === "production"[\s\S]*404/);
});
