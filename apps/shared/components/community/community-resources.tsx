"use client";
import { useEffect, useId, useState } from "react";
import {
  IconArrowUpRight as ArrowUpRight,
  IconCalendarWeek as CalendarDays,
  IconSpeakerphone as Megaphone,
  IconPlus as Plus,
} from "@tabler/icons-react";
import type { CommunityApi, CommunityResource, CommunityResourcesResponse } from "../../contracts/community";
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

export function CommunityResources({ shopId, api, showHeading = true }: { shopId: string; api: CommunityApi; showHeading?: boolean }) {
  const [data, setData] = useState<CommunityResourcesResponse | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    {error && <div className={styles.resourceError}><p role="alert">{error}</p><button type="button" className={communityButton} onClick={() => { setLoading(!data); setRevision((value) => value + 1); }}>다시 시도</button></div>}
    {loading ? <p className={styles.resourceEmpty} role="status">소식을 불러오고 있습니다.</p> : data?.resources.length ? <div className={styles.resourceList}>{data.resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
      : !error && <CommunityStatus kind="resources" title="아직 올라온 소식이 없어요" />}
    {data && (data.page > 0 || data.hasMore) && <nav className={styles.resourcePagination} aria-label="소식 페이지"><button type="button" className={communityButton} disabled={loading || data.page === 0} onClick={() => changePage(data.page - 1)}>이전</button><span>{data.page + 1}</span><button type="button" className={communityButton} disabled={loading || !data.hasMore} onClick={() => changePage(data.page + 1)}>다음</button></nav>}
  </>;
}
