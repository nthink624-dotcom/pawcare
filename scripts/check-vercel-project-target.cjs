const fs = require("node:fs");
const path = require("node:path");

const PROJECTS = Object.freeze({
  web: Object.freeze({
    id: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO",
    name: "petmanager",
    root: "apps/web",
  }),
  mobile: Object.freeze({
    id: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4",
    name: "petmanager-app",
    root: "apps/mobile",
  }),
});

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const target = argument("--target");
const project = PROJECTS[target];
if (!project) {
  console.error("Usage: node scripts/check-vercel-project-target.cjs --target web|mobile [--project-file <path>] [--manifest <path>]");
  process.exit(1);
}

const projectFile = argument("--project-file");
const manifestFile = argument("--manifest") || "docs/operations/vercel-project-targets.json";

function readJson(relativePath, label) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Vercel project target check: BLOCKED - missing ${label}: ${relativePath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    console.error(`Vercel project target check: BLOCKED - invalid JSON: ${relativePath}`);
    process.exit(1);
  }
}

const manifest = readJson(manifestFile, "project manifest");
const manifestTarget = manifest[target];
if (!manifestTarget || typeof manifestTarget !== "object") {
  console.error(`Vercel project target check: BLOCKED - missing target in manifest: ${target}`);
  process.exit(1);
}

const metadata = projectFile
  ? readJson(projectFile, "project link")
  : manifestTarget;

const failures = [];
for (const [actual, expected, label] of [
  [manifestTarget.projectId, project.id, "manifest projectId"],
  [manifestTarget.projectName, project.name, "manifest projectName"],
  [manifestTarget.rootDirectory, project.root, "manifest rootDirectory"],
  [metadata.projectId, project.id, "projectId"],
  [metadata.projectName, project.name, "projectName"],
]) {
  if (actual !== expected) failures.push(`${label}=${actual ?? "missing"} (expected ${expected})`);
}

if (failures.length > 0) {
  console.error(`Vercel project target check: BLOCKED (${target})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Vercel project target check: PASS (${target} -> ${project.name}, root ${project.root})`);
