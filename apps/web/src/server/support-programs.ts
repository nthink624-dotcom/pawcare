import { unstable_cache } from "next/cache.js";
import type { SupportProgram } from "@petmanager/shared/contracts/support-programs";
import { isCalendarDate, seoulCalendarDate } from "@petmanager/shared/lib/owner-calendar";
import { getSupportProgramCoverage } from "@petmanager/shared/lib/support-program-coverage";

const endpoint = "https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService";
const pageSize = 100;
const maxPages = 5;
const officialHosts = new Set(["www.bizinfo.go.kr", "bizinfo.go.kr"]);

function textField(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function readApplicationDates(period: string | null) {
  const date = String.raw`(\d{4})[-./]?(\d{2})[-./]?(\d{2})`;
  const match = period?.match(new RegExp(`^${date}\\s*[~～–]\\s*${date}$`));
  if (match) {
    const opensOn = match.slice(1, 4).join("-");
    const closesOn = match.slice(4, 7).join("-");
    if (isCalendarDate(opensOn) && isCalendarDate(closesOn) && opensOn <= closesOn) return { opensOn, closesOn };
  }
  return { opensOn: null, closesOn: null };
}

function readPublishedAt(value: unknown) {
  const field = textField(value, 30);
  const match = field?.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/);
  if (!match || !isCalendarDate(match[1])) return null;
  const time = match[2] ?? "00:00:00";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) return null;
  return new Date(`${match[1]}T${time}+09:00`).toISOString();
}

function officialNoticeUrl(value: unknown) {
  const path = textField(value, 1000);
  if (!path) return null;
  try {
    const url = new URL(path, "https://www.bizinfo.go.kr");
    const noticePath = url.pathname === "/sii/siia/selectSIIA200Detail.do" || /^\/web\/lay1\/bbs\/[^/]+\/AS\/\d+\/view\.do$/.test(url.pathname);
    if (url.protocol === "https:" && officialHosts.has(url.hostname) && !url.port && !url.username && !url.password && noticePath) {
      return url.href;
    }
  } catch { return null; }
  return null;
}

export function readSupportProgramPage(input: unknown) {
  const result = input as { response?: { header?: { resultCode?: unknown }; body?: { totalCount?: unknown; items?: unknown } } } | null;
  const body = result?.response?.body;
  const rawTotal = body?.totalCount;
  const total = typeof rawTotal === "number" || (typeof rawTotal === "string" && /^\d+$/.test(rawTotal)) ? Number(rawTotal) : NaN;
  if (result?.response?.header?.resultCode !== "00" || !Number.isSafeInteger(total) || total < 0 || !body) {
    throw new Error("Support provider returned an invalid response");
  }
  const entries = Array.isArray(body.items) ? body.items : (body.items as { item?: unknown } | null)?.item;
  if (!Array.isArray(entries)) {
    if (total === 0) return { total, programs: [] as SupportProgram[] };
    throw new Error("Support provider returned an invalid page");
  }

  const programs: SupportProgram[] = [];
  for (const entry of entries) {
    const row = entry as Record<string, unknown> | null;
    if (!row) continue;
    const id = textField(row.pblancId, 40);
    const title = textField(row.pblancNm, 500);
    const sourceUrl = officialNoticeUrl(row.pblancUrl);
    if (!id || !/^PBLN_\d+$/.test(id) || !title || !sourceUrl) continue;
    const applicationPeriod = textField(row.reqstBeginEndDe, 120);
    const tags = [...new Set((textField(row.hashtags ?? row.hashTags, 1000) ?? "").split(",").map(tag => tag.trim()).filter(Boolean))];
    const summary = textField(row.bsnsSumryCn, 20_000) ?? "";
    const target = textField(row.trgetNm, 1000);
    const eligibility = target ? `지원대상: ${target}\n${summary}` : summary;
    programs.push({
      id, title, sourceUrl, applicationPeriod, ...readApplicationDates(applicationPeriod),
      agency: textField(row.jrsdInsttNm, 150) ?? textField(row.excInsttNm, 150) ?? "",
      publishedAt: readPublishedAt(row.creatPnttm),
      tags, calendarCoverage: getSupportProgramCoverage({ title, tags }, eligibility),
    });
  }
  if (entries.length && !programs.length) throw new Error("Support provider response contained no usable notices");
  return { total, programs };
}

async function fetchPage(key: string, page: number) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    serviceKey: key, dataType: "json", pageNo: String(page), numOfRows: String(pageSize), hashtags: "소상공인",
  }).toString();
  const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Support provider request failed");
  const raw = await response.text();
  if (raw.length > 4_000_000) throw new Error("Support provider response was too large");
  return readSupportProgramPage(JSON.parse(raw) as unknown);
}

/** The Bizinfo feed uses the same decoded data.go.kr account key as the holiday API unless a separate key is set. */
export function supportProgramServiceKey(env: Record<string, string | undefined> = process.env) {
  return env.DATA_GO_KR_SUPPORT_SERVICE_KEY?.trim() || env.DATA_GO_KR_SERVICE_KEY?.trim() || null;
}

const readSupportPrograms = unstable_cache(async () => {
  const key = supportProgramServiceKey();
  if (!key) throw new Error("Support program service key is missing");
  const first = await fetchPage(key, 1);
  const count = Math.min(maxPages, Math.ceil(first.total / pageSize));
  const remaining = await Promise.all(Array.from({ length: Math.max(0, count - 1) }, (_, index) => fetchPage(key, index + 2)));
  const programs = new Map<string, SupportProgram>();
  for (const page of [first, ...remaining]) {
    for (const program of page.programs) if (!programs.has(program.id)) programs.set(program.id, program);
  }
  return [...programs.values()].sort((first, second) =>
    (second.publishedAt ?? "").localeCompare(first.publishedAt ?? "") || second.id.localeCompare(first.id));
}, ["korean-small-business-support-calendar-regions-v1"], { revalidate: 3600 });

export async function listOpenSupportPrograms() {
  const today = seoulCalendarDate(new Date().toISOString());
  const programs = await readSupportPrograms();
  return programs.filter(program => !program.closesOn || program.closesOn >= today);
}
