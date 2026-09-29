const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ownerApiRoot = path.join(root, "apps", "web", "src", "app", "api", "owner");
const errors = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.isFile() && entry.name === "route.ts") files.push(fullPath);
  }
  return files;
}

for (const filePath of walk(ownerApiRoot)) {
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  const source = fs.readFileSync(filePath, "utf8");

  if (relativePath === "apps/web/src/app/api/owner/account-deletion/route.ts") {
    if (!source.includes("claim_owner_account_deletion_v1") || !source.includes("getSupabaseAuthClient")) {
      errors.push(`${relativePath}: account deletion must keep token reauthentication and the guarded deletion claim`);
    }
    continue;
  }

  if (!source.includes("requireOwnerShop") && !source.includes("assertOwnerOrManager")) {
    errors.push(`${relativePath}: missing requireOwnerShop/assertOwnerOrManager guard`);
  }
}

if (errors.length > 0) {
  console.error("Owner tenant route guard check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Owner tenant route guard check passed (${walk(ownerApiRoot).length} routes).`);
