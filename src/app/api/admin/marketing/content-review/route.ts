import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

const manifestPath = "C:\\Users\\happy\\.codex\\worktrees\\aca4\\petmanager\\artifacts\\truth-corrected-owner-content-pack-v0.2\\manifest.json";

const instagramIds = new Set(["D2", "D3", "D6", "D7"]);
const ownedWebIds = new Set(["D1", "D5"]);

function reviewContext(id: string) {
  if (instagramIds.has(id)) return {
    purpose: "검증된 제품 사실을 Instagram 고객에게 이해하기 쉽게 전달",
    distribution: "Instagram",
    exposure: "모바일 피드",
    format: "4:5 마케팅 카드",
    deploymentDevice: "모바일 피드용 콘텐츠",
    depictedDevice: "카드 안 제품 화면 예시 · 제품 UI 승인과 별개",
    review: "이미지 문구·순서·전체 문구·제품 사실",
  };
  if (ownedWebIds.has(id)) return {
    purpose: "자사 웹에서 예약 운영 방식을 설명",
    distribution: "자사 웹",
    exposure: "PC·모바일 웹 콘텐츠",
    format: "웹 콘텐츠 이미지",
    deploymentDevice: "PC·모바일 자사 웹",
    depictedDevice: "콘텐츠 안 제품 화면 예시 · 제품 UI 승인과 별개",
    review: "이미지 문구·전체 문구·제품 사실",
  };
  return {
    purpose: "원본 근거 확인 전 보류",
    distribution: "배포 없음",
    exposure: "미검증",
    format: "승인 대상 아님",
    deploymentDevice: "해당 없음",
    depictedDevice: "확인 불가",
    review: "원본·이미지·문구 확보 여부",
  };
}

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
      context: { ...reviewContext(content.id), size: content.id === "D4" ? "미확정" : "1080×1350", count: content.slides.length },
      slides: content.slides.map((slide) => ({ title: slide.title, lead: slide.lead, url: `/api/admin/marketing/content-review/assets/${encodeURIComponent(slide.file)}` })),
    }));
    return NextResponse.json({ contents, externalExecution: false }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "검수 자산을 불러올 수 없습니다." }, { status: 503 }); }
}
