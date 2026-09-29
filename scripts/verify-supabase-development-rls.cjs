const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const supabaseCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args) {
  if (process.platform === "win32") {
    const quote = (value) => {
      const normalized = String(value);
      return /[^A-Za-z0-9_./\\:=+-]/.test(normalized)
        ? `"${normalized.replaceAll('"', '""')}"`
        : normalized;
    };
    const commandLine = [command, ...args].map(quote).join(" ");
    execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: root,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

try {
  run(process.execPath, [path.join("scripts", "verify-supabase-cli-target.cjs"), "--target", "dev"]);
  run(supabaseCommand, [
    "supabase",
    "--workdir",
    root,
    "db",
    "query",
    "--linked",
    "--file",
    "supabase/verification/verify_public_table_rls.sql",
  ]);
  console.log("OK development Supabase public-table RLS verification completed.");
} catch (error) {
  const exitCode = typeof error?.status === "number" ? error.status : 1;
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`BLOCKED development Supabase RLS verification (exit ${exitCode}): ${detail}`);
  process.exit(exitCode || 1);
}
