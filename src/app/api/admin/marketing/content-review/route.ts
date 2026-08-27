import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

const manifestPath = "C:\\Users\\happy\\.codex\\worktrees\\aca4\\petmanager\\artifacts\\truth-corrected-owner-content-pack-v0.2\\manifest.json";

type Manifest = { before_after: Array<{ topic: string; before: string; after: string; facts: string[] }>; contents: Array<{ id: string; channel: string; title: string; status: string; truth_status: string; customer_copy: string; facts: string[]; slides: Array<{ file: string; title: string; lead: string }>; forbidden_scan: { status: string } }> };

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "개발 전용" }, { status: 404 });
  try { await requireAdminSession(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "권한 없음" }, { status: error instanceof AdminApiError ? error.status : 500 }); }
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
    const contents = manifest.contents.map((content) => ({
      id: content.id, channel: content.channel, title: content.title, status: content.status,
      truthStatus: content.truth_status, customerCopy: content.customer_copy,
      factStatus: content.forbidden_scan.status, facts: content.facts,
      changeReasons: manifest.before_after.filter((item) => item.facts.some((fact) => content.facts.includes(fact))).map((item) => `${item.topic}: ${item.before} → ${item.after}`),
      context: { exposure: content.channel.includes("Instagram") ? "모바일 피드용 콘텐츠" : "고객 노출 콘텐츠", format: "4:5 세로 이미지", size: "1080×1350", count: content.slides.length, review: "이미지 문구·순서·전체 문구·제품 사실" },
      slides: content.slides.map((slide) => ({ title: slide.title, lead: slide.lead, url: `/api/admin/marketing/content-review/assets/${encodeURIComponent(slide.file)}` })),
    }));
    return NextResponse.json({ contents, externalExecution: false }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "검수 자산을 불러올 수 없습니다." }, { status: 503 }); }
}
