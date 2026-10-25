import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { requireAdminSession } from "@/server/admin-api-auth";

const assetsDirectory = "C:\\Users\\happy\\.codex\\worktrees\\aca4\\petmanager\\artifacts\\truth-corrected-owner-content-pack-v0.2\\assets";
const allowed = /^d[1-7]-(?:\d{2}|unverified)\.png$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  try { await requireAdminSession(request); } catch { return new Response("Unauthorized", { status: 401 }); }
  const { file } = await params;
  if (!allowed.test(file)) return new Response("Not found", { status: 404 });
  try { return new Response(await readFile(path.join(assetsDirectory, file)), { headers: { "Cache-Control": "no-store", "Content-Type": "image/png" } }); }
  catch { return new Response("검수 이미지 없음", { status: 404 }); }
}
