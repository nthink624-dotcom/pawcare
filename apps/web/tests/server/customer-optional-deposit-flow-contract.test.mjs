import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("src/components/booking/booking-policy-notice.tsx");
const bookings = read("src/server/customer-bookings.ts");
const migration = read("../../supabase/migrations/20261017094826_customer_optional_booking_deposit_flow.sql");
const cron = read("src/app/api/cron/booking-deposit-expiry/route.ts");
const vercel = JSON.parse(read("vercel.json"));

test("eligible optional-deposit customers must choose, while required customers cannot opt out", () => {
  assert.match(page, /depositOptions\?\.selectable/);
  assert.match(page, /네, 납부할게요/);
  assert.match(page, /아니요, 예약금 없이 진행할게요/);
  assert.match(bookings, /depositOptions\.selectable && typeof payload\.depositChoice !== "boolean"/);
  assert.match(bookings, /depositOptions\.required \|\| \(depositOptions\.selectable && payload\.depositChoice === true\)/);
  assert.match(bookings, /depositChoice,\s*customerServiceOptionId/);
});

test("deposit opt-in creates pending appointment preparation and opt-out does not request payment", () => {
  assert.match(migration, /p->>'depositMode' = 'optional' and applies and customer_deposit_choice/);
  assert.match(migration, /if required or \(new\.source = 'customer' and rule = 'approval'\) then new\.status := 'pending'/);
  assert.match(migration, /'status',case when required then 'pending' else 'not_requested' end/);
  assert.match(migration, /'releaseIfUnreported',required,'required',required/);
  assert.match(bookings, /if \(depositChoice\) \{[\s\S]*updateMockAppointment[\s\S]*status: "pending"/);
  assert.match(bookings, /if \(depositChoice && runsAgainstSupabase\)[\s\S]*type: "booking_deposit_request"/);
});

test("expired unreported deposits are cancelled by a secret-protected minute cron", () => {
  assert.match(migration, /create or replace function public\.expire_all_unreported_booking_deposits\(\)/);
  assert.match(migration, /grant execute on function public\.expire_all_unreported_booking_deposits\(\) to service_role/);
  assert.match(cron, /authorization.*Bearer \$\{secret\}/i);
  assert.match(cron, /rpc\("expire_all_unreported_booking_deposits"\)/);
  assert.ok(vercel.crons.some((job) => job.path === "/api/cron/booking-deposit-expiry" && job.schedule === "* * * * *"));
});
