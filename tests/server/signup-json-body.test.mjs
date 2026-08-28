import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ATOMIC_SIGNUP_JSON_BYTES,
  parseBoundedAtomicSignupJson,
  SignupJsonBodyError,
} from "../../src/server/signup-json-body.ts";

const encoder = new TextEncoder();

function requestFromChunks(chunks, headers = {}) {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1;
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    request: { headers: new Headers({ "content-type": "application/json", ...headers }), body: stream },
    stats: () => ({ pulls, cancelled }),
  };
}

function requestWithObservedBody(headers = {}) {
  let bodyAccesses = 0;
  const request = {
    headers: new Headers({ "content-type": "application/json", ...headers }),
    get body() {
      bodyAccesses += 1;
      return new ReadableStream({ start(controller) { controller.close(); } });
    },
  };
  return { request, bodyAccesses: () => bodyAccesses };
}

test("valid JSON is decoded inside the 64KiB boundary", async () => {
  const source = encoder.encode(JSON.stringify({ signupRequestId: "fixture" }));
  const { request } = requestFromChunks([source], { "content-length": String(source.byteLength) });
  assert.deepEqual(await parseBoundedAtomicSignupJson(request), { signupRequestId: "fixture" });
});

test("exactly 64KiB JSON and a valid multi-chunk request are accepted", async () => {
  const overhead = encoder.encode(JSON.stringify({ payload: "" })).byteLength;
  const exact = encoder.encode(JSON.stringify({ payload: "a".repeat(MAX_ATOMIC_SIGNUP_JSON_BYTES - overhead) }));
  assert.equal(exact.byteLength, MAX_ATOMIC_SIGNUP_JSON_BYTES);
  const exactFixture = requestFromChunks([exact], { "content-length": String(exact.byteLength) });
  const exactResult = await parseBoundedAtomicSignupJson(exactFixture.request);
  assert.equal(exactResult.payload.length, MAX_ATOMIC_SIGNUP_JSON_BYTES - overhead);

  const source = encoder.encode(JSON.stringify({ signupRequestId: "multi-chunk" }));
  const split = Math.floor(source.byteLength / 2);
  const multi = requestFromChunks([source.slice(0, split), source.slice(split)]);
  assert.deepEqual(await parseBoundedAtomicSignupJson(multi.request), { signupRequestId: "multi-chunk" });
});

test("oversized Content-Length is rejected before the body stream is pulled", async () => {
  const fixture = requestWithObservedBody({
    "content-length": String(MAX_ATOMIC_SIGNUP_JSON_BYTES + 1),
  });
  await assert.rejects(
    parseBoundedAtomicSignupJson(fixture.request),
    (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_BODY_TOO_LARGE" && error.status === 413,
  );
  assert.equal(fixture.bodyAccesses(), 0);
});

for (const mode of ["missing", "false", "chunked"]) {
  test(`${mode} length cannot bypass the bounded stream`, async () => {
    const headers = mode === "false"
      ? { "content-length": "2" }
      : mode === "chunked"
        ? { "transfer-encoding": "chunked" }
        : {};
    const fixture = requestFromChunks([
      new Uint8Array(MAX_ATOMIC_SIGNUP_JSON_BYTES),
      new Uint8Array([1]),
    ], headers);
    await assert.rejects(
      parseBoundedAtomicSignupJson(fixture.request),
      (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_BODY_TOO_LARGE",
    );
    assert.equal(fixture.stats().cancelled, true);
  });
}

test("malformed JSON and non-JSON content type fail closed", async () => {
  const malformed = requestFromChunks([encoder.encode("{")]);
  await assert.rejects(
    parseBoundedAtomicSignupJson(malformed.request),
    (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_BODY_INVALID",
  );
  const wrongType = requestFromChunks([encoder.encode("{}")], { "content-type": "text/plain" });
  await assert.rejects(
    parseBoundedAtomicSignupJson(wrongType.request),
    (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_CONTENT_TYPE_INVALID" && error.status === 415,
  );
});

test("early disconnect and compressed bodies fail closed without parsing", async () => {
  const disconnected = {
    headers: new Headers({ "content-type": "application/json" }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"email":"'));
        controller.error(new Error("client disconnected"));
      },
    }),
  };
  await assert.rejects(
    parseBoundedAtomicSignupJson(disconnected),
    (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_BODY_INVALID",
  );

  const compressed = requestWithObservedBody({ "content-encoding": "gzip" });
  await assert.rejects(
    parseBoundedAtomicSignupJson(compressed.request),
    (error) => error instanceof SignupJsonBodyError && error.code === "SIGNUP_CONTENT_ENCODING_UNSUPPORTED",
  );
  assert.equal(compressed.bodyAccesses(), 0);
});
