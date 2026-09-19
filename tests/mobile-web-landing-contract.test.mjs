import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const landingUrl = new URL("../src/components/landing/mobile-web-landing.tsx", import.meta.url);

test("public root server-redirects to login with the owner mobile return path", () => {
  assert.match(page, /import \{ redirect \} from "next\/navigation"/);
  assert.match(page, /redirect\("\/login\?next=\/owner\/mobile"\);/);
  assert.doesNotMatch(page, /MobileWebLanding|"use client"|return\s*</);
});

test("the removed landing component no longer exists", async () => {
  await assert.rejects(
    access(landingUrl),
    (error) => error instanceof Error && "code" in error && error.code === "ENOENT",
  );
});

test("login keeps the authenticated session redirect and unauthenticated form", () => {
  assert.match(loginPage, /const nextPath = getSafeLoginNextPath\(/);
  assert.match(loginPage, /const user = await getServerSessionUser\(\);/);
  assert.match(loginPage, /if \(user\) \{\s*redirect\(nextPath as never\);\s*\}/);
  assert.match(loginPage, /<LoginForm[\s\S]*?nextPath=\{nextPath\}/);
});

test("existing public booking and legal route files remain available", async () => {
  await Promise.all(
    [
      "../src/app/book/[shopId]/page.tsx",
      "../src/app/terms/page.tsx",
      "../src/app/privacy/page.tsx",
      "../src/app/business/page.tsx",
    ].map((path) => access(new URL(path, import.meta.url))),
  );
});
