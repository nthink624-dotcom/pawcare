import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("../../scripts/check-payment-env-vercel.cjs", import.meta.url));

async function runWithEnv(contents) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "petmanager-payment-env-"));
  const envPath = path.join(tempDir, "production.env");
  await writeFile(envPath, contents, "utf8");
  try {
    return spawnSync(process.execPath, [scriptPath, `--production=${envPath}`], {
      encoding: "utf8",
      windowsHide: true,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("payment production readback checks presence without printing secret values", async () => {
  const secret = "do-not-print-payment-secret";
  const result = await runWithEnv([
    `PORTONE_API_SECRET=${secret}`,
    "PORTONE_WEBHOOK_SECRET=webhook",
    "BILLING_KEY_ENCRYPTION_SECRET=encryption",
    "NEXT_PUBLIC_PORTONE_STORE_ID=store",
    "NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY=billing-channel",
    "NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY=payment-channel",
  ].join("\n"));

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK PORTONE_API_SECRET: present/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret));
});

test("payment production readback fails when a required group is missing", async () => {
  const result = await runWithEnv("PORTONE_API_SECRET=present\n");

  assert.equal(result.status, 1);
  assert.match(result.stdout, /ERROR PORTONE_WEBHOOK_SECRET: missing/);
  assert.match(result.stderr, /PortOne production environment is incomplete/);
});
