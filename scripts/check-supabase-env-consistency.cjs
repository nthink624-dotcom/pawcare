const fs = require("fs");
const path = require("path");

const DEFAULT_ENV_FILES = [".env.local", "backend/.env"];
const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_ENV_FILES;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    values[key] = {
      value,
      line: index + 1,
    };
  });

  return values;
}

function readValue(values, key) {
  return values[key]?.value || "";
}

function refFromSupabaseUrl(value) {
  const match = value.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (match) return match[1];

  if (value.startsWith("http://127.0.0.1") || value.startsWith("http://localhost")) {
    return "local";
  }

  return "";
}

function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function refFromSupabaseJwt(value) {
  const payload = decodeJwtPayload(value);
  if (!payload) return "";

  if (typeof payload.ref === "string" && payload.ref) {
    return payload.ref;
  }

  if (typeof payload.iss === "string") {
    return refFromSupabaseUrl(payload.iss);
  }

  return "";
}

function maskRef(ref) {
  if (!ref) return "(unknown)";
  if (ref === "local") return "local";
  return `${ref.slice(0, 6)}...${ref.slice(-4)}`;
}

function parseAllowedRefs(value) {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function checkFile(filePath) {
  const values = parseEnvFile(filePath);
  if (!values) {
    return {
      filePath,
      missing: true,
      issues: [],
      summary: [],
    };
  }

  const issues = [];
  const summary = [];
  const siteUrl = readValue(values, "NEXT_PUBLIC_SITE_URL");
  const publicStage = readValue(values, "NEXT_PUBLIC_SUPABASE_ENV_NAME");
  const serverStage = readValue(values, "SUPABASE_ENV_NAME");
  const apiBaseUrl = readValue(values, "NEXT_PUBLIC_API_BASE_URL");
  const allowProdSupabaseInDev =
    readValue(values, "NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV") === "true" ||
    readValue(values, "ALLOW_PROD_SUPABASE_IN_DEV") === "true";
  const allowedDevSupabaseRefs = parseAllowedRefs(
    [
      readValue(values, "NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS"),
      readValue(values, "ALLOWED_DEV_SUPABASE_REFS"),
    ]
      .filter(Boolean)
      .join(","),
  );
  const supabaseUrl = readValue(values, "NEXT_PUBLIC_SUPABASE_URL") || readValue(values, "SUPABASE_URL");
  const anonKey = readValue(values, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readValue(values, "SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = readValue(values, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readValue(values, "SUPABASE_PUBLISHABLE_KEY");

  const refs = [
    ["supabase url", refFromSupabaseUrl(supabaseUrl)],
    ["anon key", refFromSupabaseJwt(anonKey)],
    ["service role key", refFromSupabaseJwt(serviceRoleKey)],
  ].filter(([, ref]) => Boolean(ref));

  summary.push(`site=${siteUrl || "(empty)"}`);
  summary.push(`api=${apiBaseUrl || "(empty)"}`);
  summary.push(`publicStage=${publicStage || "(empty)"}`);
  summary.push(`serverStage=${serverStage || "(empty)"}`);
  summary.push(`urlRef=${maskRef(refFromSupabaseUrl(supabaseUrl))}`);
  summary.push(`anonRef=${maskRef(refFromSupabaseJwt(anonKey))}`);
  summary.push(`serviceRef=${maskRef(refFromSupabaseJwt(serviceRoleKey))}`);
  summary.push(`publishableKey=${publishableKey ? "present" : "missing"}`);
  summary.push(
    `allowedDevRefs=${
      allowedDevSupabaseRefs.size > 0 ? [...allowedDevSupabaseRefs].map(maskRef).join(",") : "(empty)"
    }`,
  );

  const uniqueRemoteRefs = [...new Set(refs.map(([, ref]) => ref).filter((ref) => ref !== "local"))];
  if (uniqueRemoteRefs.length > 1) {
    issues.push(`Supabase project refs are mixed: ${refs.map(([name, ref]) => `${name}=${maskRef(ref)}`).join(", ")}`);
  }

  if (filePath.endsWith(".env.local")) {
    if (siteUrl && !siteUrl.includes("127.0.0.1") && !siteUrl.includes("localhost")) {
      issues.push("Local env should use a local site URL such as http://127.0.0.1:3000.");
    }

    if (publicStage && publicStage !== "development") {
      issues.push("NEXT_PUBLIC_SUPABASE_ENV_NAME in .env.local should be development.");
    }

    if (serverStage && serverStage !== "development") {
      issues.push("SUPABASE_ENV_NAME in .env.local should be development.");
    }

    const supabaseRef = refFromSupabaseUrl(supabaseUrl);
    if (
      supabaseRef &&
      supabaseRef !== "local" &&
      !allowedDevSupabaseRefs.has(supabaseRef) &&
      !allowProdSupabaseInDev
    ) {
      issues.push(
        `Local env remote Supabase ref ${maskRef(supabaseRef)} is not in ALLOWED_DEV_SUPABASE_REFS. Add only development Supabase refs to the allowlist, or use http://127.0.0.1:54321.`,
      );
    }
  }

  return {
    filePath,
    missing: false,
    issues,
    summary,
  };
}

let hasIssues = false;

for (const file of files) {
  const filePath = path.normalize(file);
  const result = checkFile(filePath);

  console.log(`\n[${filePath}]`);
  if (result.missing) {
    console.log("missing");
    continue;
  }

  result.summary.forEach((line) => console.log(`- ${line}`));

  if (result.issues.length === 0) {
    console.log("OK");
    continue;
  }

  hasIssues = true;
  result.issues.forEach((issue) => console.error(`ERROR: ${issue}`));
}

if (hasIssues) {
  process.exit(1);
}
