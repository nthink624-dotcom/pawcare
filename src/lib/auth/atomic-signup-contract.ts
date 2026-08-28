export const ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION = "SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1" as const;
export const ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER = "x-petmanager-signup-contract-version" as const;
export const ATOMIC_OWNER_SIGNUP_SUPPORTED_VERSIONS = [ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION] as const;

export function acceptsAtomicOwnerSignupContract(headers: Pick<Headers, "get">) {
  const value = headers.get(ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER);
  if (!value || value.length > 128 || value.includes(",")) return false;
  return value === ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION;
}
