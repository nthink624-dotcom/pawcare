const { randomUUID } = require("node:crypto");

async function checkIdentityProvider({ env = process.env, fetchImpl = fetch, createId = randomUUID } = {}) {
  if (env.VERCEL_ENV !== "production") return { skipped: true };
  const secret = env.PORTONE_API_SECRET?.trim();
  const storeId = (env.PORTONE_STORE_ID || env.NEXT_PUBLIC_PORTONE_STORE_ID)?.trim();
  if (!secret || !storeId) throw Error("MOBILE_IDENTITY_PREFLIGHT_CONFIG_MISSING");
  // A random nonexistent ID tests read permission without retrieving customer
  // data, creating an identity request, sending an OTP, or changing any state.
  const url = new URL(`/identity-verifications/pm_preflight_${createId()}`, "https://api.portone.io");
  url.searchParams.set("storeId", storeId);
  let response, body;
  try {
    response = await fetchImpl(url, {
      method: "GET", headers: { Authorization: `PortOne ${secret}` },
      cache: "no-store", signal: AbortSignal.timeout(6_000),
    });
    body = await response.json();
  } catch {
    throw Error("MOBILE_IDENTITY_PREFLIGHT_LOOKUP_UNAVAILABLE");
  }
  if (response.status === 401 || response.status === 403) {
    throw Error(`MOBILE_IDENTITY_PREFLIGHT_AUTH_${response.status}`);
  }
  if (response.status !== 404 || body?.type !== "IDENTITY_VERIFICATION_NOT_FOUND") {
    throw Error("MOBILE_IDENTITY_PREFLIGHT_UNEXPECTED_RESPONSE");
  }
  return { skipped: false, httpStatus: 404 };
}

module.exports = { checkIdentityProvider };
if (require.main === module) {
  checkIdentityProvider().then(({ skipped }) => {
    console.log(`mobile_identity_provider_preflight: ${skipped ? "skipped (non-production)" : "ready"}`);
  }).catch((error) => {
    // All thrown messages above are application-owned fixed classifications.
    console.error(error.message);
    process.exitCode = 1;
  });
}
