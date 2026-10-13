import assert from "node:assert/strict";
import test from "node:test";
import { depositHoldDeadline, expireUnreportedDeposits } from "../../src/server/booking-deposit-hold.ts";

test("owner-configured minutes apply within the visit boundary", () => {
  const at = Date.parse("2026-10-12T01:00:00Z");
  assert.equal(depositHoldDeadline("2026-10-12T03:00:00Z", at, 60), new Date(at + 3600000).toISOString());
  assert.equal(depositHoldDeadline("2026-10-12T01:05:00Z", at, 60), new Date(at + 300000).toISOString());
  for (const minutes of [0, -1, 1.5, 1441, NaN]) assert.throws(() => depositHoldDeadline("2026-10-12T03:00:00Z", at, minutes));
});
test("request deadline is twenty minutes and cannot extend past the visit", () => {
  const at=Date.parse('2026-10-12T10:00:00+09:00');
  assert.equal(depositHoldDeadline('2026-10-12T12:00:00+09:00',at),new Date(at+1200000).toISOString());
  assert.equal(depositHoldDeadline('2026-10-12T10:05:00+09:00',at),new Date(at+300000).toISOString());
  assert.throws(()=>depositHoldDeadline('2026-10-12T09:59:00+09:00',at));
  assert.throws(()=>depositHoldDeadline('invalid',at));
});
test("expiry RPC is scoped to the authorized shop and appointment", async () => {
  let args;
  await expireUnreportedDeposits({rpc:async(name,payload)=>{args={name,payload};return {error:null};}},'authorized-shop','appointment');
  assert.deepEqual(args,{name:'expire_unreported_booking_deposits',payload:{p_shop:'authorized-shop',p_appointment:'appointment',p_staff:null}});
});
test("expiry service errors do not masquerade as a free time slot or expose raw errors", async () => {
  await assert.rejects(()=>expireUnreportedDeposits({rpc:async()=>({error:{code:'XX000',message:'secret raw DB detail'}})},'shop'),e=>!e.message.includes('secret')&&e.message.includes('기한'));
  await expireUnreportedDeposits({rpc:async()=>({error:{code:'PGRST202'}})},'legacy-shop');
});
