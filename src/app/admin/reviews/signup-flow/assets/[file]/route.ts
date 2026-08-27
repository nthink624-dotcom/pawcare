import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { requireAdminSession } from "@/server/admin-api-auth";
import { signupFlowCaptureDirectory } from "@/server/signup-flow-review";

const allowed = /^(?:terms|account|shop|validation-error|duplicate-email|reused-identity)\.png$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  try {
    await requireAdminSession(request);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { file } = await params;
  if (!allowed.test(file)) return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(path.join(signupFlowCaptureDirectory, file)), {
      headers: { "Cache-Control": "no-store", "Content-Type": "image/png" },
    });
  } catch {
    return new Response("미캡처", { status: 404 });
  }
}
