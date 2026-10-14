import assert from "node:assert/strict";
import test from "node:test";
import { isSameBookingManageLink } from "@petmanager/shared/lib/booking-manage-link";

test("canonical and approved legacy entry preserve the same signed booking token", () => {
  const expected="https://www.petmanager.co.kr/m?t=fixture.signed-token";
  assert.equal(isSameBookingManageLink(expected,expected),true);
  assert.equal(isSameBookingManageLink("https://www.petmanager.co.kr/book/manage?t=fixture.signed-token",expected),true);
  for(const rejected of [
    "https://foreign.example/book/manage?t=fixture.signed-token",
    "http://www.petmanager.co.kr/book/manage?t=fixture.signed-token",
    "https://www.petmanager.co.kr/book/manage?t=another-token",
    "https://www.petmanager.co.kr/book/manage?t=fixture.signed-token&shop=another",
    "https://www.petmanager.co.kr/book/manage?t=fixture.signed-token#another",
    "https://www.petmanager.co.kr/book/another/manage?t=fixture.signed-token",
    "https://name:password@www.petmanager.co.kr/book/manage?t=fixture.signed-token",
    "invalid",
  ]) assert.equal(isSameBookingManageLink(rejected,expected),false,rejected);
  assert.equal(isSameBookingManageLink("https://www.petmanager.co.kr/m","https://www.petmanager.co.kr/m"),false);
});
