import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const { toOwnerSupportPublicRequest } = await import("../../src/server/owner-support-owner-payload.ts");

function supportRequest(overrides = {}) {
  return {
    id: "request-1",
    shopId: "shop-a",
    shopName: "매장 A",
    ownerUserId: "owner-a",
    requestType: "bug",
    category: "bug",
    status: "answered",
    priority: "normal",
    title: "문의 제목",
    contact: "internal-contact",
    ownerName: "owner-name",
    ownerPhone: "internal-phone",
    ownerEmail: "internal-email",
    message: "오너 문의",
    context: { internal: "context" },
    adminNote: "관리자만 보는 메모",
    source: "owner_web",
    answeredAt: "2026-09-02T00:00:00.000Z",
    closedAt: null,
    ownerLastReadAt: null,
    adminLastReadAt: "2026-09-02T00:00:00.000Z",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    messages: [
      { id: "owner-message", senderType: "owner", senderName: "오너", message: "오너 문의", isAnswer: false, createdAt: "2026-09-02T00:00:00.000Z" },
      { id: "internal-admin", senderType: "admin", senderName: "관리자", message: "내부 처리 메모", isAnswer: false, createdAt: "2026-09-02T00:00:01.000Z" },
      { id: "answer-admin", senderType: "admin", senderName: "운영팀", message: "공개 답변", isAnswer: true, createdAt: "2026-09-02T00:00:02.000Z" },
    ],
    attachments: [{
      id: "attachment-1",
      requestId: "request-1",
      messageId: "owner-message",
      mediaAssetId: "media-internal-id",
      fileUrl: "https://safe.example.test/support/attachment-1",
      signedUrl: "https://safe.example.test/download/attachment-1",
      fileName: "문의-사진.png",
      fileType: "image/png",
      fileSize: 1234,
      uploadedByType: "owner",
      uploadedById: "owner-internal-id",
      createdAt: "2026-09-02T00:00:00.000Z",
    }],
    ...overrides,
  };
}

test("owner support payload allowlists public fields and never falls back to an admin note", () => {
  const ownerPayload = toOwnerSupportPublicRequest(supportRequest());

  assert.equal(ownerPayload.answer, "공개 답변");
  assert.equal(ownerPayload.reply, "공개 답변");
  assert.equal(ownerPayload.admin_reply, "공개 답변");
  assert.deepEqual(ownerPayload.messages.map((message) => message.id), ["owner-message", "answer-admin"]);
  for (const internalKey of ["adminNote", "shopId", "ownerUserId", "contact", "ownerPhone", "ownerEmail", "context", "adminLastReadAt"]) {
    assert.equal(Object.hasOwn(ownerPayload, internalKey), false, `${internalKey} must not reach an owner`);
  }
  assert.deepEqual(ownerPayload.attachments, [{
    id: "attachment-1",
    fileUrl: "https://safe.example.test/support/attachment-1",
    signedUrl: "https://safe.example.test/download/attachment-1",
    fileName: "문의-사진.png",
    fileType: "image/png",
    fileSize: 1234,
    createdAt: "2026-09-02T00:00:00.000Z",
  }]);
  assert.equal(/uploadedById|uploadedByType|mediaAssetId|messageId|requestId/.test(JSON.stringify(ownerPayload.attachments)), false);

  const noPublicAnswer = toOwnerSupportPublicRequest(supportRequest({
    messages: [],
    adminNote: "관리자 메모는 답변이 아닙니다.",
  }));
  assert.equal(noPublicAnswer.answer, "");
  assert.equal(noPublicAnswer.reply, "");
});

test("admin support route retains its authorized internal-note serializer and owner route keeps shop/role guards", async () => {
  const [adminRoute, ownerRoute, server] = await Promise.all([
    import("node:fs/promises").then(({ readFile }) => readFile(new URL("../../src/app/api/admin/support-requests/route.ts", import.meta.url), "utf8")),
    import("node:fs/promises").then(({ readFile }) => readFile(new URL("../../src/app/api/owner/support-requests/route.ts", import.meta.url), "utf8")),
    import("node:fs/promises").then(({ readFile }) => readFile(new URL("../../src/server/owner-support-requests.ts", import.meta.url), "utf8")),
  ]);

  assert.match(adminRoute, /return NextResponse\.json\(\{ requests \}\)/);
  assert.match(server, /adminNote: row\.admin_note \?\? ""/);
  assert.match(ownerRoute, /requireOwnerShop\(request, shopId\)/);
  assert.match(ownerRoute, /assertOwnerOrManager\(owner\)/);
  assert.match(ownerRoute, /shopId: owner\.shopId,[\s\S]*ownerUserId: owner\.userId/);
  assert.match(ownerRoute, /const owner = await requireOwnerShop\(request, body\.shopId\);[\s\S]*assertOwnerOrManager\(owner\)/);
  assert.match(ownerRoute, /toOwnerSupportPublicRequest/);
  assert.doesNotMatch(ownerRoute, /\.\.\.request/);
  assert.doesNotMatch(ownerRoute, /request\.adminNote/);
});

test("owner attachment serializer is an explicit public allowlist while the admin serializer stays raw", async () => {
  const [ownerPayloadSource, server] = await Promise.all([
    import("node:fs/promises").then(({ readFile }) => readFile(new URL("../../src/server/owner-support-owner-payload.ts", import.meta.url), "utf8")),
    import("node:fs/promises").then(({ readFile }) => readFile(new URL("../../src/server/owner-support-requests.ts", import.meta.url), "utf8")),
  ]);

  assert.match(ownerPayloadSource, /function toOwnerSupportPublicAttachment\(attachment: OwnerSupportAttachmentItem\)/);
  assert.match(ownerPayloadSource, /attachments: request\.attachments\.map\(toOwnerSupportPublicAttachment\)/);
  assert.doesNotMatch(ownerPayloadSource, /uploadedById: attachment\.uploadedById/);
  assert.doesNotMatch(ownerPayloadSource, /uploadedByType: attachment\.uploadedByType/);
  assert.match(server, /uploadedById: row\.uploaded_by_id/);
});
