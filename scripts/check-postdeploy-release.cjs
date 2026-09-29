const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const expectedReleaseIndex = process.argv.indexOf("--expected-release");
const expectedRelease = expectedReleaseIndex >= 0 ? process.argv[expectedReleaseIndex + 1] : "";

if (!/^[0-9a-f]{40}$/i.test(expectedRelease ?? "")) {
  console.error("postdeploy:release: BLOCKED - pass --expected-release <Git SHA>");
  process.exit(1);
}

const launch = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-production-launch-readiness.cjs"), "--expected-release", expectedRelease],
  { cwd: root, stdio: "inherit", windowsHide: true },
);

if (launch.status !== 0) {
  console.error("postdeploy:release: BLOCKED at production launch gate");
  process.exit(launch.status || 1);
}

const evidence = spawnSync(process.execPath, [path.join(root, "scripts/check-readback-evidence.cjs")], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});

if (evidence.status !== 0) {
  console.error("postdeploy:release: BLOCKED at readback evidence verification");
  process.exit(evidence.status || 1);
}

console.log(`postdeploy:release: PASS (${expectedRelease})`);
