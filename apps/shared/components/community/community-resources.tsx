"use client";
import { useEffect, useId, useMemo, useState } from "react";
import {
  IconArrowUpRight as ArrowUpRight,
  IconCalendarWeek as CalendarDays,
  IconSpeakerphone as Megaphone,
  IconPlus as Plus,
  IconSearch as Search,
} from "@tabler/icons-react";
import type { CommunityApi, CommunityResource, CommunityResourcesResponse } from "../../contracts/community";
import type { SupportProgram } from "../../contracts/support-programs";
import { useSupportPrograms } from "../../lib/use-support-programs";
import { SupportProgramList } from "../support-program-list";
import { communityButton } from "./community-form";
import { CommunityStatus } from "./community-presentation";
import styles from "./community.module.css";

function ResourceCard({ resource }: { resource: CommunityResource }) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  return <article className={styles.resourceCard} data-community-resource={resource.id}>
    <div className={styles.resourceMeta}><span>펫매니저 소식</span><time dateTime={resource.createdAt}>{new Date(resource.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })}</time></div>
    <h3>{resource.title}</h3>
    {resource.closesOn && <p className={styles.resourceDeadline} data-closed={resource.closed}><CalendarDays size={15} aria-hidden />{resource.closed ? "접수 마감" : "접수 마감일"} · {resource.closesOn.replaceAll("-", ".")}</p>}
    <p id={bodyId} className={styles.resourceBody} data-expanded={expanded}>{resource.body}</p>
    <div className={styles.resourceActions}>
      <button type="button" className={communityButton} aria-controls={bodyId} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "접기" : "자세히 보기"}</button>
      {resource.sourceUrl && <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer">공고 원문<ArrowUpRight size={16} aria-hidden /><span className="sr-only"> · 새 창</span></a>}
    </div>
  </article>;
}

const supportPageSize = 6;

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").trim();
}

function SupportProgramSearch({ programs, loading, error }: { programs: SupportProgram[]; loading: boolean; error: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const results = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const matches = terms.length ? programs.filter(program => {
      const searchable = normalizeSearch([program.title, program.agency, ...(program.tags ?? [])].join(" "));
      return terms.every(term => searchable.includes(term));
    }) : programs;
    if (sort !== "deadline") return matches;
    return [...matches].sort((first, second) => (first.closesOn ?? "9999").localeCompare(second.closesOn ?? "9999"));
  }, [programs, query, sort]);
  const pages = Math.ceil(results.length / supportPageSize);
  const activePage = Math.max(0, Math.min(page, pages - 1));
  const start = activePage * supportPageSize;

  return <SupportProgramList
    title="소상공인 지원사업"
    programs={results.slice(start, start + supportPageSize)}
    showPublishedDate
    controls={<>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="relative min-w-0">
          <Search size={17} stroke={1.7} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#526175]" />
          <input type="search" aria-label="지원사업 검색" placeholder="지원사업 검색" value={query} maxLength={120}
            onChange={event => { setQuery(event.target.value); setPage(0); }}
            className="min-h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white pr-2 pl-9 text-[14px] text-[#25324a] placeholder:text-[#526175] focus-visible:outline-2 focus-visible:outline-blue-600" />
        </label>
        <select aria-label="지원사업 정렬" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}
          className="min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[14px] text-[#25324a] focus-visible:outline-2 focus-visible:outline-blue-600">
          <option value="recent">최근 등록순</option>
          <option value="deadline">마감 임박순</option>
        </select>
      </div>
      {!loading && (!error || programs.length > 0) && <p role="status" className="px-1 text-[13px] leading-5 text-[#526175]">
        {results.length ? `${query.trim() ? "검색 결과" : "전체"} ${results.length.toLocaleString("ko-KR")}건` : query.trim() ? "검색 조건에 맞는 지원사업이 없어요." : "표시할 지원사업이 없어요."}
      </p>}
    </>}
    footer={pages > 1 ? <nav className={styles.resourcePagination} aria-label="지원사업 페이지">
      <button type="button" className={communityButton} data-owner-control-size="content" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>이전</button>
      <span className="tabular-nums">{activePage + 1} / {pages}</span>
      <button type="button" className={communityButton} data-owner-control-size="content" disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>다음</button>
    </nav> : null}
  />;
}

export function CommunityResources({ shopId, api, showHeading = true, showSupportPrograms = false }: { shopId: string; api: CommunityApi; showHeading?: boolean; showSupportPrograms?: boolean }) {
  const [data, setData] = useState<CommunityResourcesResponse | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const publicPrograms = useSupportPrograms(showSupportPrograms, api);
  useEffect(() => {
    const abort = new AbortController();
    void api<CommunityResourcesResponse>(`/api/owner/community/resources?shopId=${encodeURIComponent(shopId)}&page=${page}`, { cache: "no-store", signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) { setData(result); setError(""); setLoading(false); } })
      .catch((cause) => { if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "소식을 불러오지 못했습니다."); setLoading(false); } });
    return () => abort.abort();
  }, [api, shopId, page, revision]);
  useEffect(() => { const refresh = () => setRevision((value) => value + 1); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, []);
  function changePage(next: number) { setLoading(true); setPage(next); }
  return <>
    {(showHeading || data?.canPublish) && <header className={showHeading ? styles.resourcesHeading : styles.resourcesToolbar}>{showHeading && <div><Megaphone size={19} aria-hidden /><h2>지원금·운영 소식</h2></div>}{data?.canPublish && <a className={styles.resourceManage} href="/admin/community"><Plus size={16} aria-hidden />정보 올리기</a>}</header>}
    {showSupportPrograms && <>
      <SupportProgramSearch programs={publicPrograms.programs} loading={publicPrograms.loading} error={publicPrograms.error} />
      {publicPrograms.loading && <p className={styles.resourceEmpty} role="status">지원사업 공고를 불러오고 있어요.</p>}
      {publicPrograms.error && <div className={styles.resourceError}><p role="status">지원사업 공고를 불러오지 못했어요.</p><button type="button" className={communityButton} onClick={publicPrograms.retry}>지원사업 다시 조회</button></div>}
    </>}
    {error && <div className={styles.resourceError}><p role="alert">{error}</p><button type="button" className={communityButton} onClick={() => { setLoading(!data); setRevision((value) => value + 1); }}>다시 시도</button></div>}
    {loading ? <p className={styles.resourceEmpty} role="status">소식을 불러오고 있습니다.</p> : data?.resources.length ? <div className={styles.resourceList}>{data.resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
      : !error && <CommunityStatus kind="resources" title="아직 올라온 운영 소식이 없어요" />}
    {data && (data.page > 0 || data.hasMore) && <nav className={styles.resourcePagination} aria-label="소식 페이지"><button type="button" className={communityButton} disabled={loading || data.page === 0} onClick={() => changePage(data.page - 1)}>이전</button><span>{data.page + 1}</span><button type="button" className={communityButton} disabled={loading || !data.hasMore} onClick={() => changePage(data.page + 1)}>다음</button></nav>}
  </>;
}
