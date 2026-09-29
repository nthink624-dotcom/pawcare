const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const inventoryPath = path.join(root, "docs/operations/environment-inventory.md");
const vercelManifestPath = path.join(root, "docs/operations/vercel-project-targets.json");
const failures = [];

if (!fs.existsSync(inventoryPath)) {
  console.error("Environment inventory check: BLOCKED");
  console.error("- missing: docs/operations/environment-inventory.md");
  process.exit(1);
}

if (!fs.existsSync(vercelManifestPath)) {
  failures.push("missing: docs/operations/vercel-project-targets.json");
} else {
  try {
    const manifest = JSON.parse(fs.readFileSync(vercelManifestPath, "utf8"));
    const expected = {
      web: { projectId: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO", projectName: "petmanager", rootDirectory: "apps/web" },
      mobile: { projectId: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4", projectName: "petmanager-app", rootDirectory: "apps/mobile" },
    };
    for (const target of Object.keys(expected)) {
      for (const key of Object.keys(expected[target])) {
        if (manifest?.[target]?.[key] !== expected[target][key]) {
          failures.push(`Vercel ${target} manifest ${key} mismatch`);
        }
      }
    }
  } catch {
    failures.push("invalid: docs/operations/vercel-project-targets.json");
  }
}

const source = fs.readFileSync(inventoryPath, "utf8");
for (const [text, label] of [
  ["프로젝트 `petmanager`", "web Vercel project mapping"],
  ["프로젝트 `petmanager-app`", "mobile Vercel project mapping"],
  ["https://www.petmanager.co.kr", "web production domain"],
  ["https://app.petmanager.co.kr/owner/mobile", "mobile production domain"],
  ["qefxdtmdtvnzgupmjlom", "development Supabase ref"],
  ["ysxykikqnneuhypybjry", "production Supabase ref"],
  ["대표 승인", "explicit approval boundary"],
  ["readback", "external account readback boundary"],
  ["service role key", "secret exclusion rule"],
]) {
  if (!source.includes(text)) failures.push(label);
}

for (const pattern of [
  /SUPABASE_SERVICE_ROLE_KEY\s*=/i,
  /ALIMTALK_(?:API_KEY|SENDER_KEY|RELAY_SECRET)\s*=/i,
  /(?:sk_live|sk_test|AKIA)[A-Za-z0-9_-]{8,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./,
]) {
  if (pattern.test(source)) failures.push(`possible secret in environment inventory (${pattern})`);
}

if (failures.length > 0) {
  console.error("Environment inventory check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Environment inventory check: PASS (targets mapped without secrets)");
