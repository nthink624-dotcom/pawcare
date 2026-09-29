const TARGETS = [
  { name: "web", baseUrl: "https://www.petmanager.co.kr" },
  { name: "mobile", baseUrl: "https://app.petmanager.co.kr" },
];

const reportOnly = process.argv.includes("--report-only");
const expectedReleaseIndex = process.argv.indexOf("--expected-release");
const expectedRelease = expectedReleaseIndex >= 0 ? process.argv[expectedReleaseIndex + 1] : "";

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
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

function contractStatus(result, expectedStatus) {
  if (result.status !== expectedStatus) return "FAIL";
  if (!result.json || typeof result.json !== "object") return "FAIL";
  if (result.json.requestId !== result.requestId || !result.requestId) return "FAIL";
  if (typeof result.json.release !== "string" || result.json.release.length === 0 || result.json.release === "unknown" || result.json.release === "local") return "FAIL";
  if (expectedRelease && result.json.release !== expectedRelease) return "FAIL";
  return "PASS";
}

async function main() {
  const results = [];
  for (const target of TARGETS) {
    const health = await fetchJson(`${target.baseUrl}/api/healthz`);
    const readiness = await fetchJson(`${target.baseUrl}/api/readyz`);
    const healthStatus = contractStatus(health, 200);
    const readinessStatus = contractStatus(readiness, 200);
    results.push({
      target: target.name,
      health: { status: health.status, contract: healthStatus },
      readiness: { status: readiness.status, contract: readinessStatus },
    });
  }

  console.log(JSON.stringify({
    status: results.every((result) => result.health.contract === "PASS" && result.readiness.contract === "PASS") ? "PASS" : "FAIL",
    reportOnly,
    results,
  }, null, 2));

  if (!reportOnly && results.some((result) => result.health.contract !== "PASS" || result.readiness.contract !== "PASS")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.name : "unknown_error" }));
  process.exitCode = 1;
});
