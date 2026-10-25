"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApiJsonWithAuth } from "@/lib/api";

type Template = { code: string; name: string; content: string; buttons: string[] };
type Item = { alias: string; title: string; version: number; current: Template | null; blocked: boolean; options: Template[] };
export default function OwnerAlimtalkTemplateSelection({ shopId, editable }: { shopId: string; editable: boolean }) {
  const [items, setItems] = useState<Item[]>([]), [alias, setAlias] = useState("");
  const [choice, setChoice] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const target = useRef<{ alias: string; code: string } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    target.current = (!params.get("shopId") || params.get("shopId") === shopId) && params.get("templateAlias") && params.get("templateCode")
      ? { alias: params.get("templateAlias")!, code: params.get("templateCode")! } : null;
  }, [shopId]);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = await fetchApiJsonWithAuth<{ items: Item[] }>(`/api/owner/alimtalk-template-selection?shopId=${encodeURIComponent(shopId)}`);
      if (id !== requestId.current) return false;
      setItems(result.items); setAlias(current => target.current && result.items.some(item => item.alias === target.current!.alias) ? target.current.alias : result.items.some(item => item.alias === current) ? current : result.items[0]?.alias || "");
      return true;
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다."); return false; }
    finally { if (id === requestId.current) setLoading(false); }
  }, [shopId]);
  useEffect(() => { setItems([]); setAlias(""); setNotice(""); void load(); return () => { requestId.current++; }; }, [load]);
  const item = items.find(row => row.alias === alias);
  useEffect(() => {
    const requested = target.current;
    if (item && requested?.alias === item.alias) {
      target.current = null;
      if (item.options.some(option => option.code === requested.code)) {
        setChoice(requested.code);
        requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: "start" }));
        return;
      }
      setError("해당 문구는 현재 사용할 수 없습니다. 다른 승인 문구를 선택해 주세요.");
    }
    setChoice(item?.current?.code || "");
  }, [item]);
  const preview = item?.options.find(option => option.code === choice) ?? (item?.current?.code === choice ? item.current : null);
  async function save() {
    if (!item || !preview) return;
    const generation = requestId.current;
    setSaving(true); setError(""); setNotice("");
    try {
      await fetchApiJsonWithAuth("/api/owner/alimtalk-template-selection", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, templateAlias: item.alias, templateCode: choice, expectedVersion: item.version }) });
      if (generation !== requestId.current) return;
      if (await load()) setNotice("이 매장에서 사용할 문구를 저장했습니다.");
    } catch (e) { if (generation === requestId.current) setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  const control = "!min-h-11 !h-11 w-full min-w-0 rounded-[10px] border border-[#e1e4ea] bg-white px-3 !text-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-60";
  return <section ref={sectionRef} data-owner-template-selection className="min-h-0 space-y-4 overflow-y-auto p-1 text-[16px] text-[#15213b] sm:p-3">
    <header className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[20px] font-semibold">사용할 알림톡 문구</h3><button type="button" data-owner-control-size="content" disabled={loading || saving} onClick={() => { setNotice(""); void load(); }} className="min-h-11 rounded-[10px] px-3 text-[14px] text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">목록 새로고침</button></header>
    <p className="text-[14px] text-slate-600">승인된 문구를 선택하면 이 매장의 알림에 적용됩니다.</p>
    {loading ? <p role="status">승인된 문구를 불러오는 중입니다.</p> : item ? <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <label className="grid gap-2"><span>알림 종류</span><select aria-label="알림 종류" className={control} value={alias} disabled={saving} onChange={e => { setAlias(e.target.value); setNotice(""); setError(""); }}>{items.map(row => <option key={row.alias} value={row.alias}>{row.title}</option>)}</select></label>
        <p className="break-words text-[14px] text-slate-600">현재 사용: {item.current?.name || "연결된 문구 없음"}</p>
        {item.blocked && <p className="text-[14px] text-[#9a5e4e]">현재 문구로 발송할 수 없습니다. 사용 가능한 문구를 선택해 주세요.</p>}
        <label className="grid gap-2"><span>사용할 문구</span><select aria-label="사용할 문구" className={control} value={choice} disabled={!editable || saving || !item.options.length} onChange={e => { setChoice(e.target.value); setNotice(""); }}>
          {!item.options.some(option => option.code === choice) && <option value={choice}>{choice ? "현재 문구 · 사용 불가" : "문구를 선택해 주세요"}</option>}
          {item.options.map((option, index) => <option key={option.code} value={option.code}>{option.name}{item.options.filter(other => other.name === option.name).length > 1 ? ` · 문구 ${index + 1}` : ""}</option>)}
        </select></label>
        {!item.options.length && <p className="text-[14px] text-slate-600">이 알림에 사용할 수 있는 승인 문구가 없습니다.</p>}
        <button type="button" data-owner-control-size="content" disabled={!editable || saving || !item.options.some(option => option.code === choice) || (choice === item.current?.code && !item.blocked)} onClick={() => void save()} className="min-h-11 rounded-[10px] bg-[#111a30] px-5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50">{saving ? "저장 중" : "이 문구 사용하기"}</button>
      </div>
      {preview && <div className="min-w-0 space-y-3 rounded-[14px] border border-[#e1e4ea] p-4"><h4 className="font-medium">보낼 내용 미리보기</h4><p className="whitespace-pre-wrap break-words text-[16px] leading-6 [overflow-wrap:anywhere]">{preview.content}</p>{preview.buttons.length > 0 && <p className="break-words border-t border-[#edf0f4] pt-3 text-[14px] text-slate-600">버튼 · {preview.buttons.join(" · ")}</p>}</div>}
    </div> : !error && <p>선택할 알림 종류가 없습니다.</p>}
    {error && <p role="alert" className="text-[14px] text-[#9a5e4e]">{error}</p>}
    {notice && <p role="status" className="text-[14px] text-[#1f6b5b]">{notice}</p>}
  </section>;
}
