const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, execSync } = require("node:child_process");
const { createTemporaryEnvFile, removeTemporaryEnvFile } = require("./lib/temporary-env-file.cjs");
const { classifyPriceGuideAi } = require("./lib/price-guide-ai-env.cjs");
const pull = process.argv.includes("--pull-vercel-production");
const explicit = process.argv.find((arg) => arg.startsWith("--production="))?.slice(13);
if ((!pull && !explicit) || (pull && explicit)) {
  console.error("Usage: --pull-vercel-production OR --production=<env-file>");
  process.exitCode = 1;
} else { (async () => {
  const temporary = pull ? createTemporaryEnvFile("petmanager-price-guide-ai") : null;
  const file = temporary?.file || path.resolve(explicit);
  try {
    if (pull) {
      const project = process.env.PETMANAGER_VERCEL_PROJECT_ID || "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO";
      const scope = process.env.PETMANAGER_VERCEL_SCOPE_ID || "team_049eK6zsAwMJwZnQjREjDc6X";
      if (!/^prj_[\w]+$/.test(project) || !/^team_[\w]+$/.test(scope)) throw new Error("Invalid project/team ID");
      const args = ["vercel", "env", "pull", file, "--environment=production", "--yes", "--scope", scope, "--project", project];
      const options = { cwd: path.resolve(__dirname, ".."), stdio: "ignore", windowsHide: true };
      if (process.platform === "win32") execSync(`npx.cmd ${args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ")}`, options);
      else execFileSync("npx", args, options);
    }
    const values = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
      if (match) {
        const raw = match[2].trim();
        let value = raw.replace(/^(['"])(.*)\1$/, "$2");
        if (raw.startsWith('"')) value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
        values[match[1]] = value;
      }
    }
    let result = classifyPriceGuideAi(values);
    if (pull && result.status === "REDACTED_VALUE" && process.env.PETMANAGER_VERCEL_PROJECT_ID && process.env.PETMANAGER_VERCEL_PROJECT_ID !== "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO") {
      result = { status: "RUNTIME_TARGET_MISMATCH", secretsRedacted: true };
    } else if (pull && result.status === "REDACTED_VALUE") {
      const response = await fetch("https://www.petmanager.co.kr/api/readyz", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      const runtime = body.configuration?.priceGuideAi;
      if (!response.ok || !runtime || ["enabled", "settingValid", "apiKeyPresent", "modelSupported"].some((key) => typeof runtime[key] !== "boolean")) {
        result = { status: "RUNTIME_READBACK_UNAVAILABLE", secretsRedacted: true };
      } else {
        result = { ...runtime, release: body.release, source: "production-runtime", status: !runtime.settingValid ? "INVALID_FEATURE_FLAG" : !runtime.enabled ? "DISABLED" : !runtime.apiKeyPresent ? "API_KEY_MISSING" : !runtime.modelSupported ? "UNSUPPORTED_MODEL" : "PASS" };
      }
    }
    console.log(JSON.stringify({ check: "production-price-guide-ai", ...result }));
    if (result.status !== "PASS") process.exitCode = 1;
  } catch {
    console.error("Production price-guide AI environment could not be verified. Secret values were not logged.");
    process.exitCode = 1;
  } finally { removeTemporaryEnvFile(temporary); }
})().catch(() => { console.error("AI configuration readback failed; no secret values logged."); process.exitCode = 1; }); }
