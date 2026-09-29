const fs = require("fs");
const path = require("path");

const migrationDir = path.join(process.cwd(), "supabase", "migrations");
const files = fs.readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const entries = files.map((file) => {
  const match = file.match(/^(\d{12,14})_([^/]+)\.sql$/);
  if (!match) throw new Error(`Invalid migration filename: ${file}`);
  return { file, version: match[1] };
});

const duplicateVersions = entries
  .map((entry) => entry.version)
  .filter((version, index, versions) => versions.indexOf(version) !== index);
if (duplicateVersions.length > 0) {
  throw new Error(`Duplicate migration versions: ${[...new Set(duplicateVersions)].join(", ")}`);
}

const versions = entries.map((entry) => entry.version);
const sortedVersions = [...versions].sort();
if (versions.some((version, index) => version !== sortedVersions[index])) {
  throw new Error("Migration filenames are not in lexical timestamp order.");
}

console.log(`Migration order check: PASS (${entries.length} uniquely versioned files)`);
