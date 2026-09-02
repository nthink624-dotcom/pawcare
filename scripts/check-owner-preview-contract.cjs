const fs = require("fs");
const path = require("path");

const CONTRACT = Object.freeze({
  projectRoot: "D:\\petmanager",
  origin: "http://127.0.0.1:3000",
  ownerPath: "/owner",
  adminPath: "/admin",
  validationRef: "qefxdtmdtvnzgupmjlom",
  stage: "development",
});
const CANDIDATE_ENV_FILE = ".env.release-gate.local";

function normalizeWindowsPath(value) {
  return path.resolve(value).replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase();
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvText(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    values[match[1]] = stripQuotes(match[2]);
  }
  return values;
}

function refFromSupabaseUrl(value) {
  return value.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1] ?? "";
}

function decodeJwtRef(value) {
  const parts = value.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (typeof decoded.ref === "string") return decoded.ref;
    if (typeof decoded.iss === "string") return refFromSupabaseUrl(decoded.iss.replace(/\/auth\/v1\/?$/, ""));
  } catch {
    return "";
  }
  return "";
}

function parseRefSet(...values) {
  return new Set(
    values
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function validateContract({ cwd, projectRoot, env, routeExists, mode = "canonical", candidateRoot = "" }) {
  const issues = [];
  const expectedRoot = normalizeWindowsPath(CONTRACT.projectRoot);
  const actualProjectRoot = normalizeWindowsPath(projectRoot);
  const actualCwd = normalizeWindowsPath(cwd);

  if (mode === "candidate") {
    const expectedCandidateRoot = normalizeWindowsPath(candidateRoot);
    if (!candidateRoot || expectedCandidateRoot === expectedRoot) {
      issues.push("출시 후보 검증에는 정본과 다른 후보 root를 명시해야 합니다.");
    }
    if (actualProjectRoot !== expectedCandidateRoot || actualCwd !== expectedCandidateRoot) {
      issues.push("출시 후보 root와 현재 실행 위치가 일치하지 않습니다.");
    }
  } else {
    if (actualProjectRoot !== expectedRoot) {
      issues.push("PC 구현 저장소가 D:\\petmanager가 아닙니다.");
    }
    if (actualCwd !== expectedRoot) {
      issues.push("반드시 D:\\petmanager에서 실행해야 합니다.");
    }
  }
  if (env.NEXT_PUBLIC_SITE_URL !== CONTRACT.origin) {
    issues.push("PC 로컬 주소가 http://127.0.0.1:3000으로 고정되지 않았습니다.");
  }
  if (env.NEXT_PUBLIC_API_BASE_URL && env.NEXT_PUBLIC_API_BASE_URL !== CONTRACT.origin) {
    issues.push("PC 로컬 API 기본 주소가 127.0.0.1:3000과 다릅니다.");
  }
  if (env.NEXT_PUBLIC_SUPABASE_ENV_NAME !== CONTRACT.stage || env.SUPABASE_ENV_NAME !== CONTRACT.stage) {
    issues.push("PC 로컬의 데이터 환경 표시가 검수용 연습 단계가 아닙니다.");
  }
  if (
    env.NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV === "true" ||
    env.ALLOW_PROD_SUPABASE_IN_DEV === "true"
  ) {
    issues.push("PC 로컬에서 고객용 운영 DB 허용 설정을 사용할 수 없습니다.");
  }

  const urlRef = refFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "");
  if (urlRef !== CONTRACT.validationRef) {
    issues.push("검수용 연습 DB 프로젝트가 고정 기준과 다릅니다.");
  }

  const allowedRefs = parseRefSet(
    env.NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS,
    env.ALLOWED_DEV_SUPABASE_REFS,
  );
  if (allowedRefs.size !== 1 || !allowedRefs.has(CONTRACT.validationRef)) {
    issues.push("검수용 연습 DB 허용 목록은 고정 프로젝트 하나만 포함해야 합니다.");
  }

  for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const ref = decodeJwtRef(env[key] || "");
    if (ref && ref !== CONTRACT.validationRef) {
      issues.push(`${key}의 프로젝트가 검수용 연습 DB 기준과 다릅니다.`);
    }
  }

  if (!routeExists(CONTRACT.ownerPath)) {
    issues.push("현재 소스에 /owner route가 없습니다.");
  }
  if (!routeExists(CONTRACT.adminPath)) {
    issues.push("현재 소스에 /admin route가 없습니다.");
  }

  return issues;
}

function parseRunArguments(argv, projectRoot) {
  if (argv.length === 0) return { mode: "canonical", envPath: path.join(projectRoot, ".env.local") };
  if (argv.length !== 4 || argv[0] !== "--candidate-root" || argv[2] !== "--candidate-env-file") {
    return { error: "출시 후보 검증은 --candidate-root <root> --candidate-env-file .env.release-gate.local 형식으로만 실행할 수 있습니다." };
  }

  const candidateRoot = path.resolve(argv[1]);
  const expectedEnvPath = path.join(candidateRoot, CANDIDATE_ENV_FILE);
  const suppliedEnvPath = path.resolve(candidateRoot, argv[3]);
  if (normalizeWindowsPath(candidateRoot) === normalizeWindowsPath(CONTRACT.projectRoot)) {
    return { error: "정본은 출시 후보 모드로 검증할 수 없습니다." };
  }
  if (normalizeWindowsPath(candidateRoot) !== normalizeWindowsPath(projectRoot)) {
    return { error: "명시한 출시 후보 root가 현재 스크립트가 있는 후보와 다릅니다." };
  }
  if (normalizeWindowsPath(suppliedEnvPath) !== normalizeWindowsPath(expectedEnvPath)) {
    return { error: `출시 후보 환경 파일은 ${CANDIDATE_ENV_FILE} 하나만 사용할 수 있습니다.` };
  }

  return { mode: "candidate", candidateRoot, envPath: expectedEnvPath };
}

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const runArgs = parseRunArguments(process.argv.slice(2), projectRoot);
  if (runArgs.error) {
    console.error(`[PC 로컬] BLOCKED: ${runArgs.error}`);
    process.exitCode = 1;
    return;
  }

  const envPath = runArgs.envPath;
  if (!fs.existsSync(envPath)) {
    const envLabel = runArgs.mode === "candidate" ? CANDIDATE_ENV_FILE : "D:\\petmanager\\.env.local";
    console.error(`[PC 로컬] BLOCKED: ${envLabel}이 없습니다.`);
    process.exitCode = 1;
    return;
  }

  const env = parseEnvText(fs.readFileSync(envPath, "utf8"));
  const issues = validateContract({
    cwd: process.cwd(),
    projectRoot,
    env,
    mode: runArgs.mode,
    candidateRoot: runArgs.candidateRoot,
    routeExists(routePath) {
      return fs.existsSync(path.join(projectRoot, "src", "app", routePath.slice(1), "page.tsx"));
    },
  });

  if (issues.length > 0) {
    for (const issue of issues) console.error(`[PC 로컬] BLOCKED: ${issue}`);
    console.error("[PC 로컬] 서버를 시작하거나 다른 링크로 대체하지 않습니다.");
    process.exitCode = 1;
    return;
  }

  if (runArgs.mode === "candidate") {
    console.log(`[출시 후보] OK 저장소=${projectRoot}`);
    console.log("[출시 후보] OK 정본 서버 시작·대체 링크 사용 없음");
    console.log("[출시 후보] OK /owner 및 /admin route 존재");
    console.log(`[출시 후보 + 검수용 연습 DB] OK project_ref=${CONTRACT.validationRef}`);
  } else {
    console.log("[PC 로컬] OK 저장소=D:\\petmanager");
    console.log(`[PC 로컬] OK 오너=${CONTRACT.origin}${CONTRACT.ownerPath}`);
    console.log(`[PC 로컬] OK 관리자=${CONTRACT.origin}${CONTRACT.adminPath}`);
    console.log(`[PC 로컬 + 검수용 연습 DB] OK project_ref=${CONTRACT.validationRef}`);
  }
  console.log("[운영 서버 + 고객용 운영 DB] 변경 없음");
}

module.exports = {
  CONTRACT,
  CANDIDATE_ENV_FILE,
  decodeJwtRef,
  normalizeWindowsPath,
  parseEnvText,
  parseRunArguments,
  refFromSupabaseUrl,
  validateContract,
};

if (require.main === module) run();
