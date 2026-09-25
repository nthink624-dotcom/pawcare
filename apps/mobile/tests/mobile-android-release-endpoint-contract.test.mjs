import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkerPath = path.join(projectRoot, "scripts", "assert-android-release-endpoints.ps1");
const productionServerOrigin = "https://app.petmanager.co.kr";
const productionApiOrigin = "https://www.petmanager.co.kr";
const productionServerUrl = `${productionServerOrigin}/login`;
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";

const source = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

function runChecker(nativeRootPath, nativeConfigPath) {
  return spawnSync(
    powershell,
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      checkerPath,
      "-ExpectedServerUrl",
      productionServerUrl,
      "-ExpectedApiBaseUrl",
      productionApiOrigin,
      "-NativeRootPath",
      nativeRootPath,
      "-NativeConfigPath",
      nativeConfigPath,
      "-SkipLiveCheck",
    ],
    { encoding: "utf8" },
  );
}

test("Android release keeps the mobile shell on app origin and uses the canonical www API while local development keeps 3100", async () => {
  const [capacitorConfig, releaseScript, previewScript, localScript, checkerScript] = await Promise.all([
    source("capacitor.config.ts"),
    source("scripts/build-android-release.ps1"),
    source("scripts/run-android-production-preview.ps1"),
    source("scripts/run-android-local.ps1"),
    source("scripts/assert-android-release-endpoints.ps1"),
  ]);

  assert.match(capacitorConfig, /CAPACITOR_BUILD_MODE/);
  assert.match(capacitorConfig, /capacitorBuildMode === "release"/);
  assert.match(releaseScript, /https:\/\/app\.petmanager\.co\.kr/);
  assert.match(releaseScript, /https:\/\/www\.petmanager\.co\.kr/);
  assert.match(previewScript, /https:\/\/app\.petmanager\.co\.kr/);
  assert.match(previewScript, /https:\/\/www\.petmanager\.co\.kr/);
  assert.doesNotMatch(releaseScript, /petmanager-app\.vercel\.app/);
  assert.doesNotMatch(previewScript, /petmanager-app\.vercel\.app/);
  assert.match(localScript, /http:\/\/127\.0\.0\.1:3100\/login/);
  assert.match(localScript, /CAPACITOR_BUILD_MODE = "development"/);
  assert.match(checkerScript, /base\/assets\/capacitor\.config\.json/);
  assert.match(checkerScript, /localhost\|127\\\.0\\\.0\\\.1/);

  const buildIndex = releaseScript.indexOf("npm.cmd run build");
  const syncIndex = releaseScript.indexOf("npx.cmd cap sync android");
  const bundleIndex = releaseScript.indexOf("bundleRelease");
  const artifactCheckIndex = releaseScript.lastIndexOf("assert-android-release-endpoints.ps1");
  assert.ok(buildIndex >= 0 && syncIndex > buildIndex && bundleIndex > syncIndex && artifactCheckIndex >= 0);
});

test("release endpoint checker accepts canonical config and rejects local release references", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "petmanager-release-endpoint-"));
  const assetsRoot = path.join(fixtureRoot, "assets");
  const configPath = path.join(assetsRoot, "capacitor.config.json");

  try {
    await mkdir(assetsRoot, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({ server: { url: productionServerUrl, cleartext: false } }),
      "utf8",
    );
    await writeFile(path.join(assetsRoot, "index.html"), "<main>production</main>", "utf8");

    const valid = runChecker(fixtureRoot, configPath);
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);

    await writeFile(path.join(assetsRoot, "runtime.js"), 'const api = "http://127.0.0.1:3000";', "utf8");
    const localApi = runChecker(fixtureRoot, configPath);
    assert.notEqual(localApi.status, 0);

    await rm(path.join(assetsRoot, "runtime.js"), { force: true });
    await writeFile(
      configPath,
      JSON.stringify({ server: { url: "http://127.0.0.1:3100/login", cleartext: true } }),
      "utf8",
    );
    const localServer = runChecker(fixtureRoot, configPath);
    assert.notEqual(localServer.status, 0);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
