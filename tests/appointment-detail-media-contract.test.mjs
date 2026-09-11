import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");

test("appointment detail resolves media URLs in one batch", () => {
  const detailStart = source.indexOf("function AppointmentDetailMediaHistory");
  const detailEnd = source.indexOf("function AppointmentDetail(", detailStart);
  const detailSource = source.slice(detailStart, detailEnd);

  assert.match(detailSource, /\/api\/owner\/media\/signed-urls/);
  assert.doesNotMatch(detailSource, /\/api\/owner\/media\/signed-url\?/);
  assert.match(detailSource, /signedUrlByAssetId/);
});

test("appointment detail includes canonical start and completion media kinds", () => {
  const detailStart = source.indexOf("function AppointmentDetailMediaHistory");
  const detailEnd = source.indexOf("function AppointmentDetail(", detailStart);
  const detailSource = source.slice(detailStart, detailEnd);

  assert.match(detailSource, /"grooming_before"/);
  assert.match(detailSource, /"grooming_after"/);
  assert.match(detailSource, /"grooming_result"/);
});
