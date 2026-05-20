const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "src/lib/media/media-policy.ts",
  "src/lib/media/client-image-compression.ts",
  "src/server/media-service.ts",
  "src/server/media-variant-service.ts",
  "src/server/media-delivery-service.ts",
  "src/server/media-query-service.ts",
  "src/app/api/owner/media/upload-intents/route.ts",
  "src/app/api/owner/media/complete/route.ts",
  "src/app/api/owner/media/assets/route.ts",
  "src/app/api/owner/media/signed-url/route.ts",
  "src/app/api/owner/media/recent-sent/route.ts",
  "src/app/api/owner/media/usage/route.ts",
  "src/app/api/owner/media/notification-attachments/route.ts",
  "src/app/api/owner/media/notification-delivery-payload/route.ts",
  "src/app/api/owner/media/notification-delivery-results/route.ts",
  "src/app/api/owner/media/variants/upload-intents/route.ts",
  "src/app/api/owner/media/variants/complete/route.ts",
  "src/app/api/owner/media/variants/policy/route.ts",
  "src/app/api/media/cleanup-expired/route.ts",
  "supabase/migrations/202605180003_media_assets_and_notification_attachments.sql",
  "supabase/migrations/202605180004_media_cost_controls.sql",
  "supabase/migrations/202605180005_shop_media_limits.sql",
  "docs/media-architecture.md",
  "docs/media-cost-and-relay-guide.md",
  "docs/media-retention-policy-options.md",
  "docs/media-owner-notice-copy.md",
  "docs/media-production-rollout-checklist.md",
  "docs/media-api-smoke-test.md",
  "docs/media-development-migration-apply-runbook.md",
  "docs/media-development-apply-guide-ko.md",
  "supabase/verification/media_schema_readiness.sql",
  "scripts/print-media-migration-plan.cjs",
  "scripts/build-media-migration-bundle.cjs",
  "scripts/check-media-schema-rest.cjs",
];

const requiredSnippets = [
  {
    file: "supabase/migrations/202605180003_media_assets_and_notification_attachments.sql",
    snippets: [
      "create table if not exists public.media_assets",
      "create table if not exists public.media_variants",
      "create table if not exists public.notification_media_attachments",
      "create table if not exists public.media_send_attempts",
    ],
  },
  {
    file: "supabase/migrations/202605180004_media_cost_controls.sql",
    snippets: [
      "create table if not exists public.shop_media_usage_months",
      "create or replace function public.increment_shop_media_usage",
    ],
  },
  {
    file: "supabase/migrations/202605180005_shop_media_limits.sql",
    snippets: [
      "create table if not exists public.shop_media_limits",
      "enforcement_mode",
    ],
  },
  {
    file: "src/server/alimtalk-provider.ts",
    snippets: [
      "AlimtalkMediaAttachment",
      "mediaAttachments",
    ],
  },
  {
    file: "src/lib/media/media-policy.ts",
    snippets: [
      "PETMANAGER_MEDIA_TARGET_IMAGE_BYTES",
      "PETMANAGER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES",
      "PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES",
      "provider_ready",
    ],
  },
  {
    file: "supabase/verification/media_schema_readiness.sql",
    snippets: [
      "media_assets",
      "media_variants",
      "notification_media_attachments",
      "media_send_attempts",
      "shop_media_usage_months",
      "shop_media_limits",
      "increment_shop_media_usage",
      "petmanager-media",
    ],
  },
  {
    file: "docs/media-development-migration-apply-runbook.md",
    snippets: [
      "qefxdtmdtvnzgupmjlom",
      "ysxykikqnneuhypybjry",
      "npm run media:migration-plan",
      "npm run media:build-migration-bundle",
      "npm run media:schema-rest-check",
      "media_schema_readiness.sql",
    ],
  },
  {
    file: "docs/media-development-apply-guide-ko.md",
    snippets: [
      "qefxdtmdtvnzgupmjlom",
      "ysxykikqnneuhypybjry",
      "supabase/generated/media_development_apply.sql",
      "media_schema_readiness.sql",
      "npm run media:schema-rest-check",
    ],
  },
];

const forbiddenBootstrapSnippets = [
  "media_assets",
  "media_variants",
  "notification_media_attachments",
  "media_send_attempts",
];

const bootstrapFiles = [
  "src/server/bootstrap.ts",
  "src/app/api/bootstrap/route.ts",
];

const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Missing required file: ${file}`);
  }
}

for (const check of requiredSnippets) {
  const filePath = path.join(root, check.file);
  if (!fs.existsSync(filePath)) continue;

  const content = read(check.file);
  for (const snippet of check.snippets) {
    if (!content.includes(snippet)) {
      errors.push(`Missing snippet "${snippet}" in ${check.file}`);
    }
  }
}

for (const file of bootstrapFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;

  const content = read(file);
  for (const snippet of forbiddenBootstrapSnippets) {
    if (content.includes(snippet)) {
      errors.push(`Bootstrap must not load media table "${snippet}" in ${file}`);
    }
  }
}

if (errors.length) {
  console.error("Media architecture check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Media architecture check passed.");
