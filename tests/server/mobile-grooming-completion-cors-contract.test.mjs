import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const { NextRequest } = await import("next/server.js");
const { ownerMobileCorsPreflight } = await import("../../src/server/owner-mobile-cors.ts");

const mobileOrigin = "http://127.0.0.1:3100";

function preflight(path, requestedMethod, methods) {
  return ownerMobileCorsPreflight(new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: mobileOrigin,
      "Access-Control-Request-Method": requestedMethod,
      "Access-Control-Request-Headers": "Authorization, Content-Type",
    },
  }), { methods });
}

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("F mobile completion and care-report routes accept authenticated 3100 preflights", () => {
  const cases = [
    ["/api/appointments", "PATCH", "POST, PATCH, OPTIONS"],
    ["/api/owner/grooming-record-drafts", "GET", "GET, PUT, DELETE, OPTIONS"],
    ["/api/owner/care-reports", "PATCH", "GET, POST, PATCH, OPTIONS"],
  ];

  for (const [path, requestedMethod, methods] of cases) {
    const response = preflight(path, requestedMethod, methods);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), mobileOrigin);
    assert.equal(response.headers.get("access-control-allow-methods"), methods);
    assert.equal(response.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");
  }
});

test("completion replay is side-effect free and successful so unfinished care authoring can reopen", async () => {
  const [route, ownerMutations] = await Promise.all([
    read("src/app/api/appointments/route.ts"),
    read("src/server/owner-mutations.ts"),
  ]);
  const statusBranchStart = route.indexOf('if (typeof body?.status === "string")');
  const detailBranchStart = route.indexOf("const bootstrap = await getBootstrap(owner.shopId);", statusBranchStart);
  const statusBranch = route.slice(statusBranchStart, detailBranchStart);
  const statusMutationStart = ownerMutations.indexOf("export async function updateAppointmentStatus");
  const statusMutation = ownerMutations.slice(statusMutationStart);

  assert.ok(statusBranchStart >= 0 && detailBranchStart > statusBranchStart);
  assert.match(statusBranch, /ownerAccess: owner/);
  assert.match(statusBranch, /allowCompletedReplay: true/);
  assert.doesNotMatch(statusBranch, /getBootstrap|appointmentBelongsToStaff/);
  assert.equal(
    statusMutation.match(/options\?\.allowCompletedReplay && payload\.status === "completed"/g)?.length,
    2,
  );
  assert.match(statusMutation, /return appointment;/);
  assert.match(statusMutation, /return currentAppointment;/);
  assert.match(route, /ownerMobileCorsPreflight\(request, APPOINTMENTS_CORS\)/);
  assert.doesNotMatch(route, /const message = error instanceof Error \? error\.message/);
});

test("care-report entry, draft save, and publish all return mobile CORS plus fixed Korean server failures", async () => {
  const [draftRoute, careReportRoute] = await Promise.all([
    read("src/app/api/owner/grooming-record-drafts/route.ts"),
    read("src/app/api/owner/care-reports/route.ts"),
  ]);

  assert.match(draftRoute, /ownerMobileCorsPreflight\(request, GROOMING_DRAFTS_CORS\)/);
  assert.match(careReportRoute, /ownerMobileCorsPreflight\(request, CARE_REPORTS_CORS\)/);
  assert.doesNotMatch(draftRoute, /const message = error instanceof Error \? error\.message/);
  assert.doesNotMatch(careReportRoute, /const message = error instanceof Error \? error\.message/);
  assert.match(draftRoute, /입력한 내용은 유지되었어요\. 다시 시도해 주세요\./);
  assert.match(careReportRoute, /입력한 내용은 유지되었어요\. 다시 시도해 주세요\./);
  assert.match(
    careReportRoute,
    /const saveRequestId = input\.saveRequestId \?\? `save-mobile-\$\{savePayloadFingerprint\.slice\(0, 24\)\}`/,
  );
  assert.match(careReportRoute, /requestId: saveRequestId/);
});
