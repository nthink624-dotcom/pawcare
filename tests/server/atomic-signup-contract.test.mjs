import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptsAtomicOwnerSignupContract,
  ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER,
  ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
} from "../../src/lib/auth/atomic-signup-contract.ts";

function headers(value) {
  const result = new Headers();
  if (value !== undefined) result.set(ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER, value);
  return result;
}

test("exact signup contract version only", () => {
  assert.equal(acceptsAtomicOwnerSignupContract(headers(ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION)), true);
  assert.equal(acceptsAtomicOwnerSignupContract(headers()), false);
  assert.equal(acceptsAtomicOwnerSignupContract(headers("SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.2")), false);
  assert.equal(acceptsAtomicOwnerSignupContract(headers("shared_atomic_owner_signup_contract_v0.1")), false);
  assert.equal(acceptsAtomicOwnerSignupContract(headers("x".repeat(129))), false);
});

test("duplicate or comma-joined contract headers fail closed", () => {
  const duplicate = headers(ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION);
  duplicate.append(ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER, ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION);
  assert.equal(acceptsAtomicOwnerSignupContract(duplicate), false);
});
