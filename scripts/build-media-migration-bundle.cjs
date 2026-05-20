const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "supabase", "generated");
const developmentOutputPath = path.join(outputDir, "media_development_apply.sql");
const productionOutputPath = path.join(outputDir, "media_production_apply.sql");

const migrations = [
  "supabase/migrations/202605180002_owner_scale_indexes.sql",
  "supabase/migrations/202605180003_media_assets_and_notification_attachments.sql",
  "supabase/migrations/202605180004_media_cost_controls.sql",
  "supabase/migrations/202605180005_shop_media_limits.sql",
];

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing migration: ${relativePath}`);
  }
  return fs.readFileSync(filePath, "utf8").trim();
}

function buildBundle({ title, target, warning }) {
  const now = new Date().toISOString();
  const sections = [
    `-- ${title}`,
    `-- Generated at: ${now}`,
    `-- Target: ${target}`,
    `-- ${warning}`,
    `-- Source migrations:`,
    ...migrations.map((migration) => `-- - ${migration}`),
    ``,
    `begin;`,
    ``,
  ];

  for (const migration of migrations) {
    sections.push(`-- ============================================================`);
    sections.push(`-- ${migration}`);
    sections.push(`-- ============================================================`);
    sections.push(read(migration));
    sections.push(``);
  }

  sections.push(`commit;`);
  sections.push(``);
  sections.push(`-- After this succeeds, run:`);
  sections.push(`-- supabase/verification/media_schema_readiness.sql`);
  sections.push(``);

  return sections.join("\n");
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  developmentOutputPath,
  buildBundle({
    title: "PetManager media development migration bundle",
    target: "development Supabase qefxdtmdtvnzgupmjlom",
    warning: "Do not run on production before development verification passes.",
  }),
  "utf8",
);
fs.writeFileSync(
  productionOutputPath,
  buildBundle({
    title: "PetManager media production migration bundle",
    target: "production Supabase ysxykikqnneuhypybjry",
    warning: "Run only after explicit owner approval and production preflight checks.",
  }),
  "utf8",
);

console.log(`Wrote ${path.relative(root, developmentOutputPath)}`);
console.log(`Wrote ${path.relative(root, productionOutputPath)}`);
console.log("Apply production only after development verification and explicit approval.");
