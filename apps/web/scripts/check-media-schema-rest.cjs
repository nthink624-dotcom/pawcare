const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

const expectedProjectRef = "qefxdtmdtvnzgupmjlom";
const expectedTables = [
  "media_assets",
  "media_variants",
  "notification_media_attachments",
  "media_send_attempts",
  "shop_media_usage_months",
  "shop_media_limits",
];

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

function getSupabaseRef(url) {
  const match = (url || "").match(/^https:\/\/([^.]+)\.supabase\.co\/?$/);
  return match?.[1] ?? null;
}

function maskRef(ref) {
  if (!ref || ref.length < 10) return ref || "(missing)";
  return `${ref.slice(0, 6)}...${ref.slice(-4)}`;
}

async function checkRestTable(baseUrl, serviceRoleKey, table) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (response.ok) return { table, exists: true, status: response.status, message: "OK" };

  let message = "";
  try {
    const body = await response.json();
    message = body.message || body.hint || body.details || "";
  } catch {
    message = await response.text();
  }

  return {
    table,
    exists: false,
    status: response.status,
    message: message.slice(0, 180),
  };
}

async function checkStorageBucket(baseUrl, serviceRoleKey) {
  const response = await fetch(`${baseUrl}/storage/v1/bucket/petmanager-media`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (response.ok) {
    const bucket = await response.json();
    return {
      target: "storage.petmanager-media",
      exists: true,
      status: response.status,
      public: bucket.public ?? null,
      message: "OK",
    };
  }

  let message = "";
  try {
    const body = await response.json();
    message = body.message || body.error || "";
  } catch {
    message = await response.text();
  }

  return {
    target: "storage.petmanager-media",
    exists: false,
    status: response.status,
    public: null,
    message: message.slice(0, 180),
  };
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error(".env.local was not found.");
    process.exit(1);
  }

  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const publicStage = env.NEXT_PUBLIC_SUPABASE_ENV_NAME || "";
  const serverStage = env.SUPABASE_ENV_NAME || "";
  const ref = getSupabaseRef(baseUrl);

  console.log("PetManager media schema REST check");
  console.log("");
  console.log("This command is read-only. It does not apply migrations.");
  console.log(`- stage: ${publicStage}/${serverStage}`);
  console.log(`- Supabase ref: ${maskRef(ref)}`);
  console.log("");

  if (publicStage !== "development" || serverStage !== "development") {
    console.error("Refusing to check because .env.local is not marked as development.");
    process.exit(1);
  }

  if (ref !== expectedProjectRef) {
    console.error(`Refusing to check because target ref is not development (${expectedProjectRef}).`);
    process.exit(1);
  }

  if (!baseUrl || !serviceRoleKey) {
    console.error("Supabase URL or service role key is missing.");
    process.exit(1);
  }

  const tableResults = [];
  for (const table of expectedTables) {
    tableResults.push(await checkRestTable(baseUrl, serviceRoleKey, table));
  }
  const bucketResult = await checkStorageBucket(baseUrl, serviceRoleKey);

  for (const result of tableResults) {
    console.log(`${result.exists ? "OK " : "NO "} public.${result.table} (${result.status}) ${result.message}`);
  }
  console.log(`${bucketResult.exists ? "OK " : "NO "} ${bucketResult.target} (${bucketResult.status}) ${bucketResult.message}`);

  const missing = tableResults.filter((result) => !result.exists).length + (bucketResult.exists ? 0 : 1);
  if (missing) {
    console.log("");
    console.log(`${missing} media schema item(s) are missing in development. Apply development migrations before production.`);
    process.exit(1);
  }

  console.log("");
  console.log("Development media schema appears reachable through REST.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
