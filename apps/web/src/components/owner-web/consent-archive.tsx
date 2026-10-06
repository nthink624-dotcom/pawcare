"use client";
import { useEffect, useState } from "react";
import type { ConsentRecord } from "@petmanager/shared/contracts/booking-preparation";
import { SignaturePreview } from "@petmanager/shared/components/booking-signature-pad";
import { fetchApiJsonWithAuth } from "@/lib/api";
type Archive = { documents: Array<{ appointmentId: string; guardianId: string; petId: string; guardianName?: string; petName?: string; document: ConsentRecord }>; nextCursor: string | null };
export default function ConsentArchive({ shopId }: { shopId: string }) {
  const [result, setResult] = useState<Archive>({ documents: [], nextCursor: null }), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [search, setSearch] = useState("");
  useEffect(() => { let active = true; setBusy(true);
    fetchApiJsonWithAuth<Archive>(`/api/owner/booking-preparation?shopId=${encodeURIComponent(shopId)}&archive=1`).then(r => { if (active) setResult(r); }).catch(e => { if (active) setMessage(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [shopId]);
  const unique = result.documents.filter((r, i, all) => all.findIndex(x => x.document.id === r.document.id && x.petId === r.petId && x.document.signedAt === r.document.signedAt) === i);
  return <section className="space-y-3 border-t pt-4 text-[16px]">
    <h3 className="text-[20px] font-semibold">보관된 동의서</h3>
    <input className="h-10 w-full rounded-[8px] border px-3 text-[16px]" aria-label="서명자 또는 동의서 제목 검색" placeholder="서명자·동의서 제목 검색" value={search} onChange={e => setSearch(e.target.value)} />
    {unique.filter(r => `${r.document.title} ${r.document.signerName} ${r.petName ?? ""}`.includes(search)).map(r => <details key={`${r.appointmentId}-${r.document.id}`} className="border-b pb-3"><summary className="cursor-pointer break-words">{r.document.signerName} · {r.petName} · {r.document.title} · 버전 {r.document.version}</summary><div className="mt-3 space-y-2"><p className="whitespace-pre-wrap break-words">{r.document.body}</p><p>{r.document.signedAt && new Date(r.document.signedAt).toLocaleString("ko-KR")}</p>{r.document.signature && <SignaturePreview value={r.document.signature} />}</div></details>)}
    {!busy && unique.length === 0 && !message && <p className="text-slate-600">아직 작성 완료된 동의서가 없습니다.</p>}
    {message && <p role="status" className="text-slate-600">{message}</p>}
    {result.nextCursor && <button type="button" disabled={busy} className="h-10 rounded-[8px] border px-4" onClick={async () => { setBusy(true); try { const r = await fetchApiJsonWithAuth<Archive>(`/api/owner/booking-preparation?shopId=${encodeURIComponent(shopId)}&archive=1&cursor=${result.nextCursor}`); setResult(old => ({ documents: [...old.documents, ...r.documents], nextCursor: r.nextCursor })); } catch (e) { setMessage(e instanceof Error ? e.message : "불러오지 못했습니다."); } finally { setBusy(false); } }}>더 불러오기</button>}
  </section>;
}
