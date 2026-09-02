const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

const baseUrl = (process.env.OWNER_LOGIN_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

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

  if (Object.hasOwn(devOwnerResult, "email") || Object.hasOwn(devOwnerResult, "password")) {
    throw new Error("검수용 테스트 오너 응답에 계정 정보가 노출되었습니다.");
  }

  if (!devOwnerResult.ready || !devOwnerResult.session?.accessToken || !devOwnerResult.session?.refreshToken) {
    throw new Error("검수용 테스트 오너 준비는 성공했지만 로그인 세션이 없습니다.");
  }

  const statusResponse = await fetch(`${baseUrl}/api/dev/create-owner`, { method: "GET" });
  const statusResult = await readJson(statusResponse);
  if (!statusResponse.ok || !statusResult.ready || statusResult.missing?.length) {
    throw new Error(statusResult.message || `검수용 테스트 오너 상태 확인 실패 (${statusResponse.status})`);
  }

  console.log(`OK development test owner session smoke passed at ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
