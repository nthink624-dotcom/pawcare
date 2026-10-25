const CANONICAL_OWNER_API_ORIGIN = "https://www.petmanager.co.kr";
const CANONICAL_OWNER_API_TIMEOUT_MS = 20_000;

type CanonicalOwnerApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function copyRequestHeaders(request: Request) {
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "accept", "x-idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function proxyCanonicalOwnerApi(
  request: Request,
  pathname: `/api/owner/${string}`,
  fetchImpl: CanonicalOwnerApiFetch = fetch,
) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(pathname, CANONICAL_OWNER_API_ORIGIN);
  targetUrl.search = incomingUrl.search;

  const controller = new AbortController();
  const abortFromRequest = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  else request.signal.addEventListener("abort", abortFromRequest, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), CANONICAL_OWNER_API_TIMEOUT_MS);

  try {
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
    const upstream = await fetchImpl(targetUrl, {
      method: request.method,
      headers: copyRequestHeaders(request),
      body,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const responseBody = await upstream.arrayBuffer();
    const headers = new Headers({ "Cache-Control": "no-store, max-age=0" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    return new Response(responseBody, { status: upstream.status, headers });
  } catch (error) {
    if (controller.signal.aborted) {
      return jsonError("요청 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.", 504);
    }
    return jsonError("케어리포트 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  } finally {
    clearTimeout(timeoutId);
    request.signal.removeEventListener("abort", abortFromRequest);
  }
}
