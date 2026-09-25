import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "../../src/app/api/auth/signup/route.ts";
import {
  ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER,
  ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
} from "../../src/lib/auth/atomic-signup-contract.ts";
import { MAX_ATOMIC_SIGNUP_JSON_BYTES } from "../../src/server/signup-json-body.ts";

test("direct main oversized signup returns 413 before its body or any signup dependency is used", async () => {
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array([123, 125]));
      controller.close();
    },
  });
  const request = new NextRequest("http://127.0.0.1/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(MAX_ATOMIC_SIGNUP_JSON_BYTES + 1),
      [ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
    },
    body,
    duplex: "half",
  });
  const response = await POST(request);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    code: "SIGNUP_BODY_TOO_LARGE",
    message: "회원가입 요청 크기를 줄인 뒤 다시 시도해 주세요.",
  });
});
