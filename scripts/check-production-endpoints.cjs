const TARGETS = [
  { name: "web", baseUrl: "https://www.petmanager.co.kr" },
  { name: "mobile", baseUrl: "https://app.petmanager.co.kr" },
];

const reportOnly = process.argv.includes("--report-only");
const includeReadiness = process.argv.includes("--include-readiness");
const expectedReleaseIndex = process.argv.indexOf("--expected-release");
const expectedRelease = expectedReleaseIndex >= 0 ? process.argv[expectedReleaseIndex + 1] : "";

async function fetchJson(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await response.text();
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {
      // Keep response diagnostics bounded and never print the body.
    }
    return {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      json,
    };
  } catch (error) {
    return {
      status: null,
      requestId: null,
      error: error instanceof Error ? error.name : "unknown_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function contractFailureReason(result, expectedStatus, expectedRelease = "") {
  if (result.error) return "REQUEST_FAILED";
  if (result.status !== expectedStatus) return "HTTP_STATUS_MISMATCH";
  if (!result.json || typeof result.json !== "object") return "INVALID_JSON";
  if (!result.requestId || typeof result.json.requestId !== "string") return "REQUEST_ID_MISSING";
  if (result.json.requestId !== result.requestId) return "REQUEST_ID_MISMATCH";
  if (result.json.release === "unknown") return "RELEASE_UNKNOWN";
  if (typeof result.json.release !== "string" || !/^[0-9a-f]{40}$/i.test(result.json.release)) {
    return "RELEASE_INVALID";
  }
  if (expectedRelease && result.json.release !== expectedRelease) return "RELEASE_MISMATCH";
  return null;
}

function contractStatus(result, expectedStatus, expectedRelease = "") {
  return contractFailureReason(result, expectedStatus, expectedRelease) === null ? "PASS" : "FAIL";
}

async function runProductionEndpointChecks({
  targets = TARGETS,
  expectedRelease = "",
  includeReadiness = false,
  fetchImpl = fetch,
} = {}) {
  const results = [];
  for (const target of targets) {
    const health = await fetchJson(`${target.baseUrl}/api/healthz`, fetchImpl);
    const healthStatus = contractStatus(health, 200, expectedRelease);
    const healthFailureReason = contractFailureReason(health, 200, expectedRelease);
    let readinessResult;
    if (!includeReadiness) {
      readinessResult = { status: null, contract: "NOT_REQUESTED" };
    } else if (healthStatus !== "PASS") {
      // /api/readyz performs a read-only query against production Supabase.
      // Never touch the database when the deployed release identity is already invalid.
      readinessResult = { status: null, contract: "SKIPPED_HEALTH_GATE" };
    } else {
      const readiness = await fetchJson(`${target.baseUrl}/api/readyz`, fetchImpl);
      readinessResult = {
        status: readiness.status,
        contract: contractStatus(readiness, 200, expectedRelease),
        failureReason: contractFailureReason(readiness, 200, expectedRelease),
      };
    }
    results.push({
      target: target.name,
      health: { status: health.status, contract: healthStatus, failureReason: healthFailureReason },
      readiness: readinessResult,
    });
  }

  return {
    status: results.every((result) => result.health.contract === "PASS" &&
      (!includeReadiness || result.readiness.contract === "PASS")) ? "PASS" : "FAIL",
    includeReadiness,
    results,
  };
}

async function main() {
  const result = await runProductionEndpointChecks({ expectedRelease, includeReadiness });
  console.log(JSON.stringify({
    status: result.status,
    reportOnly,
    includeReadiness: result.includeReadiness,
    results: result.results,
  }, null, 2));

  if (!reportOnly && result.status !== "PASS") {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.name : "unknown_error" }));
    process.exitCode = 1;
  });
}

module.exports = { contractFailureReason, contractStatus, runProductionEndpointChecks };
