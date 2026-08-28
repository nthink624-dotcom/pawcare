import assert from "node:assert/strict";
import test from "node:test";

import {
  orchestrateDevelopmentSignup,
  SignupFlowError,
} from "../../src/server/signup-development-orchestration.ts";

function dependencies(overrides = {}) {
  return {
    claimRequest: async ({ requestId, payloadHash }) => ({
      action: "claimed",
      record: {
        requestId, payloadHash, status: "claimed", authUserId: null, shopId: null,
        trialEligible: null, trialDays: null, billingRequired: null,
      },
    }),
    createAuthUser: async () => ({ userId: "user-1" }),
    markAuthCreated: async () => {},
    writeAtomicSignup: async () => ({
      shopId: "shop-1", reused: false, trialEligible: true, trialDays: 14, billingRequired: false,
    }),
    deleteAuthUser: async () => true,
    markCompensationPending: async () => {},
    markFailureCompensated: async () => {},
    ...overrides,
  };
}

test("같은 요청과 같은 payload는 완료 결과를 재사용한다", async () => {
  let authCreates = 0;
  const result = await orchestrateDevelopmentSignup({
    requestId: "req-1",
    payloadHash: "hash-a",
    dependencies: dependencies({
      claimRequest: async () => ({ action: "completed", record: {
        requestId: "req-1", payloadHash: "hash-a", status: "completed", authUserId: "user-1", shopId: "shop-1",
        trialEligible: true, trialDays: 14, billingRequired: false,
      } }),
      createAuthUser: async () => {
        authCreates += 1;
        return { userId: "unexpected" };
      },
    }),
  });
  assert.equal(result.reused, true);
  assert.equal(result.shopId, "shop-1");
  assert.equal(authCreates, 0);
});

test("같은 요청 ID의 다른 payload는 409로 차단한다", async () => {
  await assert.rejects(
    orchestrateDevelopmentSignup({
      requestId: "req-1",
      payloadHash: "hash-b",
      dependencies: dependencies({
        claimRequest: async () => ({ action: "payload_mismatch", record: {
          requestId: "req-1", payloadHash: "hash-a", status: "completed", authUserId: "user-1", shopId: "shop-1",
          trialEligible: true, trialDays: 14, billingRequired: false,
        } }),
      }),
    }),
    (error) => error instanceof SignupFlowError && error.code === "PAYLOAD_MISMATCH" && error.status === 409,
  );
});

test("DB 원자 저장 실패 시 Auth 사용자를 보상 삭제한다", async () => {
  const deleted = [];
  const compensated = [];
  await assert.rejects(
    orchestrateDevelopmentSignup({
      requestId: "req-2",
      payloadHash: "hash-a",
      dependencies: dependencies({
        writeAtomicSignup: async () => {
          throw new Error("injected rpc failure");
        },
        deleteAuthUser: async (userId) => {
          deleted.push(userId);
          return true;
        },
        markFailureCompensated: async (record) => compensated.push(record),
      }),
    }),
    (error) => error instanceof SignupFlowError && error.code === "ATOMIC_WRITE_FAILED",
  );
  assert.deepEqual(deleted, ["user-1"]);
  assert.equal(compensated.length, 1);
});

test("보상 삭제도 실패하면 compensation_pending을 기록한다", async () => {
  const pending = [];
  await assert.rejects(
    orchestrateDevelopmentSignup({
      requestId: "req-3",
      payloadHash: "hash-a",
      dependencies: dependencies({
        writeAtomicSignup: async () => {
          throw new Error("injected rpc failure");
        },
        deleteAuthUser: async () => false,
        markCompensationPending: async (record) => pending.push(record),
      }),
    }),
    (error) => error instanceof SignupFlowError && error.code === "COMPENSATION_PENDING" && error.status === 503,
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].authUserId, "user-1");
});

test("동일 key 20개 동시 요청은 Auth 사용자를 한 번만 만든다", async () => {
  let state = null;
  let authCreates = 0;
  const shared = dependencies({
    claimRequest: async ({ requestId, payloadHash }) => {
      if (!state) {
        state = {
          requestId, payloadHash, status: "claimed", authUserId: null, shopId: null,
          trialEligible: null, trialDays: null, billingRequired: null,
        };
        return { action: "claimed", record: state };
      }
      if (state.status === "completed") return { action: "completed", record: state };
      return { action: "in_progress", record: state };
    },
    createAuthUser: async () => {
      authCreates += 1;
      return { userId: "user-only" };
    },
    markAuthCreated: async () => {
      state = { ...state, status: "auth_created", authUserId: "user-only" };
      await new Promise((resolve) => setTimeout(resolve, 5));
    },
    writeAtomicSignup: async () => {
      state = {
        ...state, status: "completed", shopId: "shop-only",
        trialEligible: true, trialDays: 14, billingRequired: false,
      };
      return {
        shopId: "shop-only", reused: false, trialEligible: true, trialDays: 14, billingRequired: false,
      };
    },
  });
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () => orchestrateDevelopmentSignup({
    requestId: "req-concurrent", payloadHash: "hash-a", dependencies: shared,
  })));
  assert.equal(authCreates, 1);
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length >= 1, true);
  assert.equal(state.status, "completed");
});

test("완료 응답 유실 뒤 동일 요청은 저장 결과를 재사용한다", async () => {
  let state = null;
  let authCreates = 0;
  const shared = dependencies({
    claimRequest: async ({ requestId, payloadHash }) => state
      ? { action: "completed", record: state }
      : { action: "claimed", record: {
          requestId, payloadHash, status: "claimed", authUserId: null, shopId: null,
          trialEligible: null, trialDays: null, billingRequired: null,
        } },
    createAuthUser: async () => ({ userId: `user-${++authCreates}` }),
    markAuthCreated: async () => {},
    writeAtomicSignup: async (authUserId) => {
      state = {
        requestId: "req-lost", payloadHash: "hash-a", status: "completed", authUserId, shopId: "shop-1",
        trialEligible: false, trialDays: 0, billingRequired: true,
      };
      return {
        shopId: "shop-1", reused: false, trialEligible: false, trialDays: 0, billingRequired: true,
      };
    },
  });
  await orchestrateDevelopmentSignup({ requestId: "req-lost", payloadHash: "hash-a", dependencies: shared });
  const retried = await orchestrateDevelopmentSignup({ requestId: "req-lost", payloadHash: "hash-a", dependencies: shared });
  assert.equal(retried.reused, true);
  assert.equal(authCreates, 1);
});

test("KCP 소비 또는 subscription 원자 저장 실패는 Auth를 보상 삭제한다", async () => {
  const deleted = [];
  await assert.rejects(
    orchestrateDevelopmentSignup({
      requestId: "req-kcp-credit",
      payloadHash: "hash-a",
      dependencies: dependencies({
        writeAtomicSignup: async () => { throw new Error("PM_SIGNUP_IDENTITY_CONSUME_FAILED"); },
        deleteAuthUser: async (userId) => { deleted.push(userId); return true; },
      }),
    }),
    (error) => error instanceof SignupFlowError && error.code === "ATOMIC_WRITE_FAILED",
  );
  assert.deepEqual(deleted, ["user-1"]);
});

test("DB email uniqueness race is reported as an email error", async () => {
  await assert.rejects(
    orchestrateDevelopmentSignup({
      requestId: "req-email-race",
      payloadHash: "hash-a",
      dependencies: dependencies({
        writeAtomicSignup: async () => { throw new Error("PM_SIGNUP_DUPLICATE_EMAIL"); },
      }),
    }),
    (error) =>
      error instanceof SignupFlowError &&
      error.status === 409 &&
      error.message === "이미 사용 중인 이메일입니다.",
  );
});
