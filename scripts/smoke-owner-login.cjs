const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_LOGIN_ID = "devowner";
const DEFAULT_PASSWORD = "test1234";

const baseUrl = (process.env.OWNER_LOGIN_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const loginId = process.env.OWNER_LOGIN_SMOKE_ID || DEFAULT_LOGIN_ID;
const password = process.env.OWNER_LOGIN_SMOKE_PASSWORD || DEFAULT_PASSWORD;

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function main() {
  const devOwnerResponse = await fetch(`${baseUrl}/api/dev/create-owner`, { method: "POST" });
  const devOwnerResult = await readJson(devOwnerResponse);
  if (!devOwnerResponse.ok) {
    throw new Error(devOwnerResult.message || `개발 오너 준비 실패 (${devOwnerResponse.status})`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  });
  const loginResult = await readJson(loginResponse);

  if (!loginResponse.ok || !loginResult.success) {
    throw new Error(loginResult.message || `로그인 실패 (${loginResponse.status})`);
  }

  if (!loginResult.session?.accessToken || !loginResult.session?.refreshToken) {
    throw new Error("로그인은 성공했지만 세션 토큰이 응답에 없습니다.");
  }

  console.log(`OK owner login smoke passed for ${loginId} at ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
