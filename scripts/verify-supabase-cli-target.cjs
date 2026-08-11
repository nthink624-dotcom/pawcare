const fs = require("fs");
const path = require("path");

const PROJECTS = {
  dev: { ref: "qefxdtmdtvnzgupmjlom", label: "petmanager-dev" },
  prod: { ref: "ysxykikqnneuhypybjry", label: "petmanager" },
};

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim().replace(/^['"]|['"]$/g, "")]),
  );
}

function getLinkedProjectRef() {
  const projectRefPath = path.join(process.cwd(), "supabase", ".temp", "project-ref");
  const linkedProjectPath = path.join(process.cwd(), "supabase", ".temp", "linked-project.json");
  const refs = [];

  if (fs.existsSync(projectRefPath)) refs.push(fs.readFileSync(projectRefPath, "utf8").trim());
  if (fs.existsSync(linkedProjectPath)) refs.push(JSON.parse(fs.readFileSync(linkedProjectPath, "utf8")).ref);

  if (refs.length === 0) throw new Error("Supabase CLI 프로젝트가 연결되어 있지 않습니다. 안전 래퍼로 먼저 연결해 주세요.");
  if (new Set(refs).size !== 1) throw new Error("Supabase CLI 연결 파일의 프로젝트 ref가 서로 다릅니다. 수동 DB 명령을 중단하세요.");

  return refs[0];
}

function getSupabaseRef(url) {
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? "";
}

function main() {
  const target = readArgument("--target");
  const intentOnly = process.argv.includes("--intent-only");
  const requireProductionIntent = process.argv.includes("--require-production-intent");
  if (!(target in PROJECTS)) {
    throw new Error("사용법: node scripts/verify-supabase-cli-target.cjs --target dev|prod");
  }

  const expected = PROJECTS[target];
  if (target === "prod" && (intentOnly || requireProductionIntent)) {
    const confirmation = process.env.PETMANAGER_SUPABASE_PRODUCTION_CONFIRMATION;
    const reason = process.env.PETMANAGER_SUPABASE_CHANGE_REASON?.trim();
    if (confirmation !== expected.ref || !reason || reason.length < 10) {
      throw new Error(
        "운영 Supabase 작업은 PETMANAGER_SUPABASE_PRODUCTION_CONFIRMATION=운영ref 및 10자 이상의 PETMANAGER_SUPABASE_CHANGE_REASON이 필요합니다.",
      );
    }
  }

  if (intentOnly) {
    console.log(`OK Supabase production intent: ${expected.label} (${expected.ref})`);
    return;
  }

  const linkedRef = getLinkedProjectRef();
  if (linkedRef !== expected.ref) {
    throw new Error(
      `Supabase CLI가 ${linkedRef}에 연결되어 있습니다. ${expected.label}(${expected.ref}) 대상으로 실행할 수 없습니다.`,
    );
  }

  if (target === "dev") {
    const env = parseEnvFile(path.join(process.cwd(), ".env.local"));
    const envRef = getSupabaseRef(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (envRef !== expected.ref) {
      throw new Error(`.env.local의 Supabase ref(${envRef || "없음"})가 개발 프로젝트와 다릅니다.`);
    }
  }

  console.log(`OK Supabase target: ${expected.label} (${expected.ref})`);
}

try {
  main();
} catch (error) {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
