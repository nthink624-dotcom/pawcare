const { createHmac, randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function currentVersions() {
  const source = readFileSync(join(__dirname, "../src/lib/auth/owner-signup-terms.ts"), "utf8");
  const read = name => source.match(new RegExp(`export const ${name} = "([^"]+)"`))?.[1];
  return { terms: read("OWNER_SIGNUP_TERMS_VERSION"), marketing: read("OWNER_MARKETING_CONSENT_DOCUMENT_VERSION") };
}

async function checkSignupTransport({ env = process.env, fetchImpl = fetch, createId = randomUUID, versions = currentVersions, now = Date.now } = {}) {
  if (env.VERCEL_ENV !== "production") return { skipped: true };
  let origin;
  try {
    const u = new URL(env.PETMANAGER_MAIN_APP_ORIGIN);
    if (u.protocol !== "https:" || !["www.petmanager.co.kr", "petmanager.co.kr"].includes(u.hostname) || u.port || u.pathname !== "/" || u.search || u.hash || u.username || u.password) throw Error();
    origin = u.origin;
  } catch { throw Error("MOBILE_SIGNUP_PREFLIGHT_ORIGIN_INVALID"); }
  const secret = env.AUTH_FLOW_SECRET?.trim();
  if (!secret) throw Error("MOBILE_SIGNUP_PREFLIGHT_SIGNATURE_CONFIG_MISSING");
  const documentVersions = versions();
  if (!documentVersions.terms || !documentVersions.marketing) throw Error("MOBILE_SIGNUP_PREFLIGHT_VERSION_MISSING");
  // A fresh random, nonexistent verification row guarantees rejection before
  // any Auth user, signup-operation claim, shop, or profile can be written.
  const probeId = createId();
  const encoded = Buffer.from(JSON.stringify({ verificationId: probeId, tokenId: createId(), purpose: "signup", source: "portone", expiresAt: now() + 60_000 })).toString("base64url");
  const proof = `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
  const body = {
    signupRequestId: createId(), email: "signup-preflight@example.invalid",
    password: "Preflight-Only-624!", passwordConfirm: "Preflight-Only-624!",
    name: "Preflight", birthDate: "19900101", phoneNumber: "01000000000",
    identityVerificationToken: proof, shopName: "Preflight", shopPhone: "01000000000", shopAddress: "Preflight",
    agreements: { service: true, privacy: true, location: false, marketing: false },
    termsVersion: documentVersions.terms, marketingConsentVersion: documentVersions.marketing,
    servicePrices: [],
  };
  let response, data;
  try {
    response = await fetchImpl(`${origin}/api/auth/signup`, {
      method: "POST", headers: { "content-type": "application/json", "x-petmanager-signup-contract-version": "SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1" },
      body: JSON.stringify(body), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(6_000),
    });
    data = await response.json();
  } catch { throw Error("MOBILE_SIGNUP_PREFLIGHT_UPSTREAM_UNAVAILABLE"); }
  if (response.status !== 400 || data?.message !== "본인인증이 완료되지 않았습니다.") throw Error("MOBILE_SIGNUP_PREFLIGHT_CONTRACT_REJECTED");
  return { skipped: false, probeId, enabled: env.ATOMIC_OWNER_SIGNUP_ENABLED === "true" };
}

module.exports = { checkSignupTransport };
if (require.main === module) {
  checkSignupTransport().then(result => {
    if (result.skipped) { console.log("mobile_signup_transport_preflight: skipped (non-production)"); return; }
    // This random probe ID is not a real identity or a credential. A matching
    // database read proves signature interoperability; no token is logged.
    console.log(`mobile_signup_transport_preflight: reachable probe=${result.probeId}`);
    if (!result.enabled) throw Error("MOBILE_ATOMIC_SIGNUP_DISABLED");
    console.log("mobile_signup_transport_preflight: ready");
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
