const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function validateProductionBuildSource({
  vercel,
  vercelEnv,
  vercelGitCommitSha,
  repositoryRoot,
  gitHead,
  gitStatus,
}) {
  if (vercel !== "1" || vercelEnv !== "production") return [];

  const failures = [];
  if (!/^[0-9a-f]{40}$/i.test(vercelGitCommitSha ?? "")) {
    failures.push("Vercel production build has no valid VERCEL_GIT_COMMIT_SHA; use a Git-backed release.");
  }
  if (!repositoryRoot || path.resolve(repositoryRoot) !== root) {
    failures.push("Vercel production build source has no verifiable PetManager Git checkout.");
  }
  if (!/^[0-9a-f]{40}$/i.test(gitHead ?? "") || gitHead !== vercelGitCommitSha) {
    failures.push("Vercel production build source does not match its declared Git commit.");
  }
  if (gitStatus !== "") {
    failures.push("Vercel production build source has uncommitted or untracked files.");
  }
  return failures;
}

function runGit(args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
}

if (require.main === module) {
  const vercel = process.env.VERCEL;
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercel !== "1" || vercelEnv !== "production") {
    console.log("Production build source check: SKIP (not a Vercel production build)");
  } else {
    const topLevel = runGit(["rev-parse", "--show-toplevel"]);
    const head = runGit(["rev-parse", "HEAD"]);
    const status = runGit(["status", "--porcelain", "--untracked-files=all"]);
    const failures = validateProductionBuildSource({
      vercel,
      vercelEnv,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
      repositoryRoot: topLevel.status === 0 ? topLevel.stdout.trim() : "",
      gitHead: head.status === 0 ? head.stdout.trim() : "",
      gitStatus: status.status === 0 ? status.stdout : null,
    });

    if (failures.length > 0) {
      console.error("Production build source check: BLOCKED");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    }
    console.log("Production build source check: PASS (clean Git-backed release)");
  }
}

module.exports = { validateProductionBuildSource };
