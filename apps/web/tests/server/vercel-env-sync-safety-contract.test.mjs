import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workspace = process.cwd();
const script = path.join(workspace, "scripts", "sync-vercel-alimtalk-env.cjs");

function runSync(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      PETMANAGER_VERCEL_ENV_CONFIRMATION: "",
      PETMANAGER_VERCEL_ENV_CHANGE_REASON: "",
    },
  });
}

test("Vercel Alimtalk sync requires approval and supports a no-write dry run", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "petmanager-vercel-env-sync-"));
  const envFile = path.join(temp, "env.local");
  writeFileSync(envFile, "ALIMTALK_SENDER_KEY=dummy-sender\n", "utf8");

  try {
    const dryRun = runSync([`--local=${envFile}`, "--environment=production", "--dry-run"]);
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.match(dryRun.stdout, /DRY_RUN/);
    assert.doesNotMatch(`${dryRun.stdout}\n${dryRun.stderr}`, /vercel env (add|rm)/i);

    const writeWithoutApproval = runSync([`--local=${envFile}`, "--environment=production"]);
    assert.notEqual(writeWithoutApproval.status, 0);
    assert.match(`${writeWithoutApproval.stdout}\n${writeWithoutApproval.stderr}`, /Refusing Vercel production env write/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
