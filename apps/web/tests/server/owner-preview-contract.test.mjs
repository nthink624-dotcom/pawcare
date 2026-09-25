import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { CONTRACT, parseEnvText, validateContract } = require("../../scripts/check-owner-preview-contract.cjs");
const packageJson = require("../../package.json");

function validEnv(overrides = {}) {
  return {
    NEXT_PUBLIC_SITE_URL: CONTRACT.origin,
    NEXT_PUBLIC_API_BASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ENV_NAME: CONTRACT.stage,
    SUPABASE_ENV_NAME: CONTRACT.stage,
    NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS: CONTRACT.validationRef,
    ALLOWED_DEV_SUPABASE_REFS: CONTRACT.validationRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${CONTRACT.validationRef}.supabase.co`,
    ...overrides,
  };
}

function validate(env = validEnv(), options = {}) {
  return validateContract({
    cwd: options.cwd ?? CONTRACT.projectRoot,
    projectRoot: options.projectRoot ?? CONTRACT.projectRoot,
    env,
    routeExists: options.routeExists ?? (() => true),
  });
}

test("고정 저장소·주소·검수용 연습 DB 기준은 통과한다", () => {
  assert.deepEqual(validate(), []);
});

test("localhost는 대표 확인 주소로 거부한다", () => {
  assert.match(validate(validEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).join("\n"), /127\.0\.0\.1:3000/);
});

test("다른 저장소에서의 실행을 거부한다", () => {
  assert.match(validate(validEnv(), { cwd: "D:\\copied-petmanager" }).join("\n"), /D:\\petmanager/);
});

test("다른 DB 프로젝트를 거부한다", () => {
  const issues = validate(
    validEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://wrongprojectref.supabase.co",
      NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS: "wrongprojectref",
      ALLOWED_DEV_SUPABASE_REFS: "wrongprojectref",
    }),
  );
  assert.ok(issues.length >= 2);
});

test("고객용 운영 DB 허용 예외를 거부한다", () => {
  assert.match(
    validate(validEnv({ ALLOW_PROD_SUPABASE_IN_DEV: "true" })).join("\n"),
    /고객용 운영 DB/,
  );
});

test("오너와 관리자 route가 모두 있어야 한다", () => {
  const issues = validate(validEnv(), { routeExists: (routePath) => routePath === "/owner" });
  assert.match(issues.join("\n"), /\/admin route/);
});

test("파서는 주석·인용부호를 처리한다", () => {
  assert.deepEqual(parseEnvText("# hidden\nNEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000'\nEMPTY=\n"), {
    NEXT_PUBLIC_SITE_URL: CONTRACT.origin,
    EMPTY: "",
  });
});

test("오류에 비밀 환경값을 포함하지 않는다", () => {
  const sentinel = "DO_NOT_PRINT_THIS_SECRET";
  const issues = validate(validEnv({ SUPABASE_SERVICE_ROLE_KEY: sentinel }));
  assert.equal(issues.join("\n").includes(sentinel), false);
});

test("대표용 3000 서버 시작 명령은 사전검사를 자동 실행한다", () => {
  for (const hook of [
    "predev:local",
    "prestart:local",
    "preserver:up",
    "preserver:up:fresh",
    "preserver:dev",
  ]) {
    assert.equal(packageJson.scripts[hook], "npm run check:owner-preview", `${hook} is not guarded`);
  }
});
