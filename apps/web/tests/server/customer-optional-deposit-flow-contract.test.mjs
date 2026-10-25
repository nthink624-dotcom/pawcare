import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("src/components/booking/booking-policy-notice.tsx");
const bookings = read("src/server/customer-bookings.ts");
const ledger = read("src/server/booking-deposit-ledger.ts");
const cron = read("src/app/api/cron/booking-deposit-expiry/route.ts");
const vercel = JSON.parse(read("vercel.json"));

test("legacy deposit choices cannot override the authoritative booking policy", () => {
  assert.match(bookings, /const depositChoice = depositOptions.required/);
  assert.doesNotMatch(bookings, /depositOptions\.selectable && payload\.depositChoice === true/);
  assert.match(ledger, /admin\.rpc\("pm_deposit_tick"/);
  assert.doesNotMatch(page, /depositOptions\?\.selectable/);
});

test("expired unreported deposits are cancelled by a secret-protected minute cron", () => {
  assert.match(cron, /authorization.*Bearer \$\{secret\}/i);
  assert.match(cron, /runDepositMaintenance\(shopId\)/);
  assert.ok(vercel.crons.some((job) => job.path === "/api/cron/booking-deposit-expiry" && job.schedule === "* * * * *"));
});
