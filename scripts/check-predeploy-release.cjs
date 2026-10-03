const { execFileSync } = require("node:child_process");

const npmCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const checks = [
  "check:saas-readiness",
  "check:release-tracked-files",
  "check:migration-order",
  "check:vercel-project:manifest",
  "test:deployment-routing",
  "test:flows",
  "check:supabase-env",
  "check:alimtalk-env:vercel",
  "check:payment-env:vercel",
  "check:media-provider:vercel",
  "check:data-safety",
  "check:owner-auth-guards",
  "check:owner-tenant-guards",
  "check:tenant-isolation",
  "check:media-architecture",
  "check:media-recovery",
  "check:privacy-operations",
  "check:backup-recovery",
  "check:backup-recovery:preflight",
  "check:backup-recovery:local",
  "check:environment-inventory",
  "check:readback-evidence",
  "test:workspace",
  "typecheck:alimtalk-relay",
  "test:alimtalk-relay",
  "test:saas-readiness",
  "test:mobile",
  "typecheck",
  "lint",
  "lint:mobile",
  "build",
];

for (const script of checks) {
  console.log(`\n=== predeploy:release / ${script} ===`);
  try {
    const args = process.platform === "win32" ? ["/d", "/s", "/c", `npm run ${script}`] : ["run", script];
    execFileSync(npmCommand, args, { stdio: "inherit", windowsHide: true });
  } catch (error) {
    console.error(`predeploy:release: BLOCKED at ${script}`);
    process.exit(1);
  }
}

console.log("predeploy:release: PASS (web, mobile, shared checks, and builds)");
