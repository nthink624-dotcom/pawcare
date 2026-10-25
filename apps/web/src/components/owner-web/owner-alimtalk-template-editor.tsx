"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";
import { DEPOSIT_ALIMTALK_REVIEW_CONTRACTS } from "@petmanager/shared/contracts/deposit-alimtalk-review";

import { AlertSettingsSwitch } from "@/components/owner-web/settings-alert-switch";
import { AlimtalkKakaoChatPreview } from "@/components/owner-web/alimtalk-kakao-chat-preview";
import { getAlimtalkPreviewAppointmentTime } from "@/lib/alimtalk-preview-sample";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { subscribeBookingPolicyChange } from "@/lib/booking-policy-events";
import { fillNotificationTemplate, getNotificationDraftBodyByAlias, type AlimtalkTemplateAlias } from "@/lib/notification-registry";
import type { NotificationType } from "@/types/domain";

type ShopTemplate = {
  id: string;
  template_alias: AlimtalkTemplateAlias;
  notification_type: NotificationType;
  template_code: string;
  template_name: string;
  template_content: string;
  category_code: string;
  template_buttons: Array<{ buttonName: string; linkMobile: string }>;
  inspection_status: string;
  service_status: string;
  submitted_at: string | null;
};

type ApprovedTemplate = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  buttons: Array<{ buttonName: string; linkMobile: string }>;
  inspectionStatus: string | null;
  serviceStatus: string | null;
};

type TemplateCategory = { code: string; name: string };
type TemplateOption = { alias: AlimtalkTemplateAlias; type: NotificationType; title: string; group: string };
type TemplateButton = { buttonName: string; linkMobile: string };
type ButtonDefaults = Partial<Record<AlimtalkTemplateAlias, TemplateButton[]>>;
const requiredButtonAliases: AlimtalkTemplateAlias[] = [
  "booking_confirmed",
  "appointment_reminder_10m",
  "visit_schedule_notice",
  "visit_reminder_notice",
  "grooming_completed",
  "revisit_notice",
  "booking_consent_request",
  "booking_deposit_request",
];

const notificationHelp: Partial<Record<NotificationType, string>> = {
  booking_deposit_request: "예약금 설정의 은행·계좌번호·예금주와 해당 요청의 금액·기한을 자동 입력합니다. 안내된 기한 안에 입금 신고하면 예약을 유지하고 매장 확인을 기다립니다.",
  booking_consent_request: "예약별 동의서 작성 요청을 보낼 때 사용합니다. 카카오 심사 규칙에 맞춰 본문과 버튼이 고정되어 있습니다.",
  booking_confirmed: "예약이 확정되었음을 알리고, 방문 일시와 예약 서비스를 안내하는 알림입니다.",
  booking_cancelled: "매장에서 예약을 취소했음을 보호자에게 안내하는 알림입니다. 고객이 직접 취소한 경우에는 보내지 않습니다.",
  appointment_reminder_10m: "방문 시간이 가까워졌을 때 예약 일정을 다시 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  visit_reminder_notice: "예약 당일 방문까지 시간이 남아 있을 때 오늘 일정을 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  visit_schedule_notice: "예약일 하루 전에 내일 방문할 일정을 미리 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  grooming_started: "반려동물의 미용을 시작했음을 보호자에게 알려주는 알림입니다.",
  grooming_almost_done: "미용이 곧 끝날 예정임을 알리고, 보호자가 데리러 올 준비를 할 수 있도록 안내하는 알림입니다.",
  grooming_completed: "미용이 끝났음을 알려주는 알림입니다. 케어리포트를 작성한 경우에는 리포트 확인도 안내합니다.",
  revisit_notice: "설정한 시점에 보호자에게 다음 미용과 예약을 안내하는 알림입니다.",
};

const statusNames: Record<string, string> = {
 draft: "작성 중", submitting: "검수 요청 중", requested: "검수 요청 완료", reviewing: "심사 중",
 approved: "승인 완료 · 아직 적용 안 함", rejected: "반려 · 수정 필요", unknown: "검수 상태 확인 필요",
};

const inputClass = "min-h-[44px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15";

const EMPTY_BUTTONS: TemplateButton[] = [];

type TemplateSource = "owner" | "petmanager";
type SelectedTemplate = { code: string; name: string; content: string; buttons: string[]; source?: TemplateSource };
type SelectionItem = { alias: AlimtalkTemplateAlias; title: string; version: number; current: SelectedTemplate | null; currentSource: TemplateSource | null; blocked: boolean; options: SelectedTemplate[] };
type DeliveryState = { enabled: boolean; disabled: boolean };

export function OwnerAlimtalkTemplateEditor({ shopId, shopName, senderName = PETMANAGER_SERVICE_NAME, selectedAlias, options, onSelectAlias, deliveryState, onToggleDelivery, deliverySettings, demoMode = false }: {
 shopId: string; shopName: string; senderName?: string; selectedAlias: AlimtalkTemplateAlias; options: TemplateOption[]; onSelectAlias: (alias: AlimtalkTemplateAlias) => void;
 deliveryState: (alias: AlimtalkTemplateAlias) => DeliveryState | undefined; onToggleDelivery: (alias: AlimtalkTemplateAlias) => void; deliverySettings?: ReactNode;
 demoMode?: boolean;
}) {
 const selectedOption = options.find(option => option.alias === selectedAlias) ?? options[0];
 const notificationType = selectedOption.type, notificationTitle = selectedOption.title;
 const [storedId, setStoredId] = useState("");
 const [templates, setTemplates] = useState<ShopTemplate[]>([]);
 const [selectionItems, setSelectionItems] = useState<SelectionItem[]>([]);
 const [categories, setCategories] = useState<TemplateCategory[]>([]), [buttonDefaults, setButtonDefaults] = useState<ButtonDefaults>({});
 const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
 const [view, setView] = useState<"current" | "approved" | "draft">("current"), [choice, setChoice] = useState("");
 const [newVersion, setNewVersion] = useState(false), [cloneContent, setCloneContent] = useState("");
 const [templateId, setTemplateId] = useState(""), [templateContent, setTemplateContent] = useState("");
 const [categoryCode, setCategoryCode] = useState(""), [buttonName, setButtonName] = useState(""), [buttonUrl, setButtonUrl] = useState("");
 const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
 const [helpType, setHelpType] = useState<AlimtalkTemplateAlias | null>(null);
 const editedContentKey = useRef(""), templateContentRef = useRef<HTMLTextAreaElement>(null), loadSequence = useRef(0);
 const target = useRef<{ alias: string; code: string } | null>(null), editorRef = useRef<HTMLElement>(null);
 const helpOpen = helpType === selectedAlias;
 useEffect(() => { const p = new URLSearchParams(window.location.search); target.current = (!p.get("shopId") || p.get("shopId") === shopId) && p.get("templateAlias") && p.get("templateCode") ? { alias:p.get("templateAlias")!,code:p.get("templateCode")! } : null; }, [shopId]);
 const loadTemplates = useCallback(async () => {
   const sequence = ++loadSequence.current; setLoading(true); setError("");
    if(demoMode){
      setTemplates([]);setSelectionItems([]);setCategories([]);setButtonDefaults({});setPreviewValues({});setLoading(false);
      return true;
    }
   try {
     const [response, selections] = await Promise.all([
       fetchApiJsonWithAuth<{ templates: ShopTemplate[]; categories: TemplateCategory[]; buttonDefaults: ButtonDefaults; approvedTemplates?: Partial<Record<AlimtalkTemplateAlias, ApprovedTemplate>>; previewValues?: Record<string,string> }>(`/api/owner/alimtalk-templates?shopId=${encodeURIComponent(shopId)}`, { cache:"no-store" }),
       fetchApiJsonWithAuth<{ items: SelectionItem[] }>(`/api/owner/alimtalk-template-selection?shopId=${encodeURIComponent(shopId)}`, { cache:"no-store" }),
     ]);
     if(sequence!==loadSequence.current)return false;
     setTemplates(response.templates); setSelectionItems(selections.items);
     setCategories(response.categories); setButtonDefaults(response.buttonDefaults??{}); setPreviewValues(response.previewValues??{});
     return true;
    } catch(cause) {
      if(sequence===loadSequence.current) {
        const message=cause instanceof Error?cause.message:"문구를 불러오지 못했습니다.";
        setError(message==="소유한 매장이 없습니다."||message==="다른 매장 데이터에는 접근할 수 없습니다."
          ?"현재 로그인한 계정에서 이 매장에 접근할 수 없습니다. 로그인 계정과 매장 연결을 확인해 주세요."
          :message);
      }
      return false;
    }
   finally { if(sequence===loadSequence.current)setLoading(false); }
  },[demoMode,shopId]);
 useEffect(()=>{void loadTemplates();return()=>{loadSequence.current++;};},[loadTemplates]);
 useEffect(()=>subscribeBookingPolicyChange(shopId,()=>{void loadTemplates();}),[shopId,loadTemplates]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")void loadTemplates();};window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};},[loadTemplates]);
 useEffect(()=>{setView("current");setStoredId("");setNewVersion(false);setNotice("");setError("");editedContentKey.current="";},[selectedAlias]);
 const relatedTemplates = templates.filter(t=>t.template_alias===selectedAlias);
 const currentTemplate = relatedTemplates.find(t=>t.id===storedId)??relatedTemplates[0];
 const selection = selectionItems.find(item=>item.alias===selectedAlias);
 const activeTemplate = selection?.current??null;
  const activeOwnerTemplate = selection?.currentSource === "owner"
    ? relatedTemplates.find(row=>row.template_code===activeTemplate?.code)
    : undefined;
 const candidate = selection?.options.find(option=>option.code===choice)??null;
 const defaultTemplate = useMemo<SelectedTemplate | null>(() => {
   const content = getNotificationDraftBodyByAlias(selectedAlias);
   if (!content) return null;
   const contract = DEPOSIT_ALIMTALK_REVIEW_CONTRACTS[selectedAlias as keyof typeof DEPOSIT_ALIMTALK_REVIEW_CONTRACTS]
     ?? APPROVED_ALIMTALK_CONTRACTS[selectedAlias as keyof typeof APPROVED_ALIMTALK_CONTRACTS];
   return { code: "", name: notificationTitle + " 기본 문구", content, buttons: contract?.button ? [contract.button] : [] };
 }, [selectedAlias, notificationTitle]);
 const displayedCurrent = activeTemplate ?? defaultTemplate;
 const displayTemplate = view==="approved"?candidate:displayedCurrent;
 const selectedButtonDefaults=buttonDefaults[selectedAlias]??EMPTY_BUTTONS;
 const fixedContract=selectedAlias==="booking_consent_request"||selectedAlias==="booking_deposit_request";
 const editable=view==="draft"&&(newVersion||!currentTemplate||currentTemplate.inspection_status==="draft");
 const needsButton=requiredButtonAliases.includes(selectedAlias)||selectedButtonDefaults.length>0;
 const unsupportedButtonCount=selectedButtonDefaults.length>1;
 const draftKey=`${shopId}:${selectedAlias}:${newVersion}:${storedId}`;
 useEffect(()=>{
   const requested=target.current;if(!selection||requested?.alias!==selectedAlias)return;
   target.current=null;
   if(selection.options.some(t=>t.code===requested.code)){setChoice(requested.code);setView("approved");requestAnimationFrame(()=>editorRef.current?.scrollIntoView({block:"start"}));}
   else setError("해당 문구는 현재 사용할 수 없습니다. 기존 발송 문구는 유지됩니다.");
 },[selection,selectedAlias]);
 useEffect(()=>{
   const defaultButton=selectedButtonDefaults[0];
   if(view==="draft"){
     if(editedContentKey.current!==draftKey){
       setTemplateContent(newVersion?cloneContent:currentTemplate?.template_content??activeTemplate?.content??getNotificationDraftBodyByAlias(selectedAlias)??"");
     }
     setTemplateId(!newVersion&&currentTemplate?.inspection_status==="draft"?currentTemplate.id:"");
     setButtonName(defaultButton?.buttonName??currentTemplate?.template_buttons[0]?.buttonName??"");
     setButtonUrl(defaultButton?.linkMobile??currentTemplate?.template_buttons[0]?.linkMobile??"");
     setCategoryCode(currentTemplate?.category_code||categories[0]?.code||"");
   }else{
     setTemplateContent(displayTemplate?.content??"");
     setButtonName(displayTemplate?.buttons[0]??defaultButton?.buttonName??"");setButtonUrl(defaultButton?.linkMobile??"");
   }
 },[view,draftKey,newVersion,cloneContent,currentTemplate,activeTemplate,displayTemplate,selectedAlias,selectedButtonDefaults,categories]);
 function beginDraft(content: string){editedContentKey.current="";setCloneContent(content);setNewVersion(true);setView("draft");setNotice("");setError("");}
 function openStoredDraft(row: ShopTemplate){editedContentKey.current="";setStoredId(row.id);setNewVersion(false);setView("draft");setNotice("");setError("");}
 const contentVariables=Array.from(new Set(Array.from(templateContent.matchAll(/#\{([^}]+)\}/g),match=>match[1])));
 const automaticVariables=selectedAlias==="booking_deposit_request"?DEPOSIT_ALIMTALK_REVIEW_CONTRACTS.booking_deposit_request.variables.filter(variable=>variable!=="예약관리토큰"):Array.from(new Set(["매장명","반려동물명","보호자명","예약일시","서비스명",...contentVariables]));
 const sampleMessage=fillNotificationTemplate(templateContent,{...Object.fromEntries(contentVariables.map(variable=>[variable,`[${variable} 예시]`])),매장명:shopName,반려동물명:"반려동물 (예시)",보호자명:"보호자 (예시)",예약일시:getAlimtalkPreviewAppointmentTime(),서비스명:"예약 서비스 (예시)",...previewValues});
 const templateVariables=automaticVariables.map(label=>({label,token:`#{${label}}`}));
  function insertTemplateVariable(token: string) {
    const textarea = templateContentRef.current;
    if (!textarea || fixedContract || !editable) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent = `${templateContent.slice(0, start)}${token}${templateContent.slice(end)}`;
    if (nextContent.length > 1000) return;

    editedContentKey.current = draftKey;
    setTemplateContent(nextContent);
    requestAnimationFrame(() => {
      const editor = templateContentRef.current;
      if (!editor) return;
      const nextCaret = start + token.length;
      editor.focus();
      editor.setSelectionRange(nextCaret, nextCaret);
    });
  }


 async function save(action:"save"|"submit"){
   if(!editable||saving)return;
   if(!templateContent.trim()||!categoryCode){setError("문구 내용과 알림 분류를 확인해 주세요.");return;}
   setSaving(true);setError("");setNotice("");
   try{
     const response=await fetchApiJsonWithAuth<{template:ShopTemplate}>("/api/owner/alimtalk-templates",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({shopId,templateAlias:selectedAlias,templateName:notificationTitle,templateContent,categoryCode,action,...(templateId&&!newVersion?{id:templateId}:{})})});
     setTemplates(rows=>[response.template,...rows.filter(row=>row.id!==response.template.id)]);setTemplateId(response.template.id);setStoredId(response.template.id);setNewVersion(false);editedContentKey.current="";
     if(action==="submit")await loadTemplates();
     setNotice(action==="submit"?"검수 요청을 보냈습니다. 기존 발송 문구는 유지됩니다.":"초안을 저장했습니다. 기존 발송 문구는 유지됩니다.");
   }catch(cause){setError(cause instanceof Error?cause.message:"초안을 저장하지 못했습니다.");}finally{setSaving(false);}
 }
 const canApply=Boolean(candidate&&selection&&(!activeTemplate||selection.blocked||candidate.code!==activeTemplate.code||candidate.content!==activeTemplate.content||JSON.stringify(candidate.buttons)!==JSON.stringify(activeTemplate.buttons)));
 async function apply(){
   if(!selection||!candidate||saving||!canApply)return;setSaving(true);setError("");setNotice("");
   try{await fetchApiJsonWithAuth("/api/owner/alimtalk-template-selection",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({shopId,templateAlias:selectedAlias,templateCode:candidate.code,expectedVersion:selection.version})});if(await loadTemplates()){setView("current");setNotice("이 매장에서 사용할 문구를 적용했습니다.");}}
   catch(cause){setError(cause instanceof Error?cause.message:"기존 문구를 유지합니다. 다시 확인해 주세요.");}finally{setSaving(false);}
 }
 const preview=templateContent.trim()?sampleMessage:"작성할 문구가 여기에 표시됩니다.";
 const previewButtons=view==="draft"?(buttonName&&buttonUrl?[buttonName]:[]):displayTemplate?.buttons??[];
 const groupedOptions=options.reduce<Record<string,TemplateOption[]>>((groups,option)=>{(groups[option.group]??=[]).push(option);return groups;},{});

 const selectedDelivery=deliveryState(selectedAlias);
 function sameSnapshot(a: SelectedTemplate | null, b: SelectedTemplate | null) {
   return Boolean(a&&b&&a.code===b.code&&a.content===b.content&&JSON.stringify(a.buttons)===JSON.stringify(b.buttons));
 }
 function isAppliedRow(row: ShopTemplate) {return Boolean(activeTemplate&&!selection?.blocked&&row.template_code===activeTemplate.code&&row.template_content===activeTemplate.content&&JSON.stringify(row.template_buttons.map(button=>button.buttonName))===JSON.stringify(activeTemplate.buttons));}
 function storedStatus(row: ShopTemplate) {return row.inspection_status==="approved"&&isAppliedRow(row)?"현재 사용 중":statusNames[row.inspection_status]??"상태 확인 필요";}
  const ownedTemplates=relatedTemplates;
 return <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white" data-owner-template-editor>
   <div className="no-scrollbar mx-3 my-3 grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto sm:mx-5 xl:auto-rows-auto xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden">
      <div data-settings-body-container className="grid min-h-max min-w-0 overflow-hidden rounded-[14px] border border-[#e1e4ea] bg-white lg:grid-cols-[280px_minmax(0,1fr)] xl:min-h-0">
       <nav aria-label="알림 종류" className="no-scrollbar min-w-0 border-b border-[#e8edf3] bg-white p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
         <div className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
           {Object.entries(groupedOptions).map(([group,groupOptions])=><section key={group} className="min-w-[296px] lg:min-w-0">
             <h3 className="mb-1.5 px-1 text-[18px] font-medium leading-[26px] text-[#15213b]">{group}</h3>
             <div className="flex gap-1.5 lg:flex-col">{groupOptions.map(option=>{
               const state=deliveryState(option.alias);
               const inUse=Boolean(state?.enabled), selected=option.alias===selectedAlias;
               return <button key={option.alias} data-owner-control-size="content" type="button" data-template-alias={option.alias} aria-current={selected?"page":undefined} disabled={saving} onClick={()=>{setHelpType(null);onSelectAlias(option.alias);}} className={`flex min-h-[44px] min-w-[296px] shrink-0 items-center justify-between gap-3 rounded-[9px] border px-3 py-2 text-left text-[16px] leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] lg:min-w-0 lg:w-full ${selected?"border-[#94a9c0] bg-[#eef4fa] text-[#15213b]":"border-[#e8edf3] bg-white text-[#334155] hover:bg-[#f8fafc]"}`}>
                  <span className="min-w-0 break-keep">{option.title}</span><span data-delivery-status className={`shrink-0 whitespace-nowrap rounded-full px-2 text-[12px] leading-5 ${inUse?"bg-[#edf7f1] !text-[#1f6b5b]":"bg-[#f1f3f5] text-[#64748b]"}`}>{inUse?"사용":"미사용"}</span>
               </button>;
             })}</div>
           </section>)}
         </div>
       </nav>
       <main ref={editorRef} data-alimtalk-workspace className="no-scrollbar min-w-0 bg-white p-4 sm:p-5 lg:overflow-y-auto">
          <header className="-mx-4 -mt-4 mb-5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 sm:-mx-5 sm:-mt-5 sm:px-5 sm:py-4">
           <div className="flex min-w-0 items-center gap-1"><h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">{notificationTitle}</h3><button data-owner-control-size="content" type="button" aria-label={notificationTitle+" 역할 도움말"} aria-expanded={helpOpen} onClick={()=>setHelpType(helpOpen?null:selectedAlias)} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc]"><CircleHelp className="h-4 w-4" aria-hidden="true" /></button></div>
            <div className="flex shrink-0 items-center gap-2 text-[13px] text-[#64748b]"><span>사용</span><AlertSettingsSwitch data-template-delivery-toggle checked={selectedDelivery?.enabled??false} disabled={!selectedDelivery||selectedDelivery.disabled||saving||loading||((!activeTemplate||selection?.blocked)&&!selectedDelivery.enabled)} aria-label={notificationTitle+" 사용"} onCheckedChange={()=>onToggleDelivery(selectedAlias)} /></div>
         </header>
         {helpOpen&&<p className="mb-3 text-[14px] leading-5 text-[#64748b]">{notificationHelp[notificationType]}</p>}
         {loading&&<p role="status" className="mb-3 text-[14px] text-[#64748b]">문구를 불러오는 중입니다.</p>}
          <section data-current-template className="space-y-3 border-b border-[#e8edf3] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[16px] font-medium text-[#15213b]">현재 사용 문구</h4>
              <div className="flex flex-wrap items-center gap-1.5">
                <span data-current-template-source className="rounded-full bg-[#eef4fa] px-2.5 py-1 text-[12px] text-[#36516f]">{activeTemplate ? selection?.currentSource === "owner" ? "내 문구" : selection?.currentSource === "petmanager" ? "펫매니저 기본" : "출처 확인 필요" : "예시 문구"}</span>
                {activeTemplate&&<span className={`rounded-full px-2.5 py-1 text-[12px] ${selection?.blocked?"bg-[#fff5e9] text-[#8c6e53]":"bg-[#edf7f1] text-[#1f6b5b]"}`}>{selection?.blocked?"확인 필요":"적용됨"}</span>}
              </div>
            </div>
            {displayedCurrent?<>
              {activeTemplate&&<p data-current-template-name className="break-words text-[16px] font-medium text-[#15213b]">{activeOwnerTemplate?.template_name??displayedCurrent.name}</p>}
             <div data-current-message={activeTemplate?"":undefined} data-default-message={!activeTemplate?"":undefined} className="whitespace-pre-wrap break-words text-[16px] leading-6 text-[#15213b]">{displayedCurrent.content}</div>
            </>:null}
           <div className="flex flex-wrap gap-2">
              {view==="current"?<>
                <button data-owner-control-size="content" type="button" disabled={loading||saving} onClick={()=>beginDraft(displayedCurrent?.content??"")} className="min-h-[44px] rounded-[8px] border border-[#dbe2ea] px-3 text-[14px]">내 문구 작성</button>
                <button data-owner-control-size="content" type="button" disabled={loading||saving} onClick={()=>{setChoice(activeTemplate?.code??selection?.options[0]?.code??"");setView("approved");setNotice("");}} className="min-h-[44px] rounded-[8px] border border-[#dbe2ea] px-3 text-[14px]">승인 문구 선택</button>
              </>:<button data-owner-control-size="content" type="button" disabled={saving} onClick={()=>setView("current")} className="min-h-[44px] rounded-[8px] px-3 text-[14px] text-[#64748b]">현재 사용 문구</button>}
           </div>
         </section>
          {ownedTemplates.length>0&&<section data-template-work-list className="space-y-2 border-b border-[#e8edf3] py-4"><h4 className="text-[14px] font-medium text-[#475569]">내 문구</h4>{ownedTemplates.map(row=><button key={row.id} data-owned-template-id={row.id} data-owner-control-size="content" type="button" disabled={saving} onClick={()=>openStoredDraft(row)} className={`flex min-h-[44px] w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[8px] px-2 py-2 text-left ${view==="draft"&&currentTemplate?.id===row.id&&!newVersion?"bg-[#f1f5f9]":"hover:bg-[#f8fafc]"}`}><span className="min-w-0 break-words text-[14px] text-[#15213b]">{row.template_name}</span><span className={`text-[12px] ${row.inspection_status==="approved"?"!text-[#1f6b5b]":"text-[#64748b]"}`}>{storedStatus(row)}</span></button>)}</section>}
          {view==="approved"&&<section data-approved-template-choice className="space-y-3 border-t border-[#e8edf3] pt-4"><h4 className="text-[16px] font-medium text-[#15213b]">승인 문구 선택</h4><label className="grid gap-2 text-[14px]"><span>사용할 문구</span><select aria-label="사용할 문구" value={choice} disabled={saving} onChange={e=>setChoice(e.target.value)} className={`${inputClass} !h-[44px] !min-h-[44px]`}><option value="">문구 선택</option>{selection?.options.map(option=><option key={option.code} value={option.code}>{option.source==="owner"?"내 문구":"펫매니저 기본"} · {option.name}{sameSnapshot(option,activeTemplate)?" · 현재 적용":""}</option>)}</select></label>{!selection?.options.length&&<p className="text-[14px] text-[#64748b]">선택할 승인 문구가 없습니다.</p>}{candidate&&<><div className="flex flex-wrap items-center gap-2"><span data-candidate-source className="rounded-full bg-[#eef4fa] px-2.5 py-1 text-[12px] text-[#36516f]">{candidate.source==="owner"?"내 문구":"펫매니저 기본"}</span><span className="text-[14px] font-medium text-[#15213b]">{candidate.name}</span></div><div data-candidate-message className="whitespace-pre-wrap break-words text-[16px] leading-6 text-[#15213b]">{candidate.content}</div></>}<button data-owner-control-size="content" type="button" disabled={!canApply||saving||loading} onClick={()=>void apply()} className="min-h-[44px] rounded-[9px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50">{candidate&&sameSnapshot(candidate,activeTemplate)?"현재 사용 중":saving?"적용 중…":"이 문구 사용하기"}</button></section>}
         {view==="draft"&&<section data-draft-workspace className="space-y-3 pt-4">
           <div><p data-template-view-status className="text-[14px] font-medium text-[#15213b]">{editable?"초안 작성 중":currentTemplate?storedStatus(currentTemplate):"상태 확인 필요"}</p><p data-working-template-name className="mt-1 break-words text-[14px] text-[#64748b]">{newVersion?notificationTitle+" 새 초안":currentTemplate?.template_name}</p></div>
           {editable?         <div className="space-y-3">
                  <div>
                    <label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">보호자에게 보낼 내용</span><textarea ref={templateContentRef} value={templateContent} readOnly={!editable || fixedContract} onChange={(event) => { editedContentKey.current = draftKey; setTemplateContent(event.target.value); }} maxLength={1000} rows={10} className="min-h-[220px] w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15 read-only:bg-[#f8fafc]" placeholder="원하는 문구를 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." /></label>
                    {view === "draft" && <div data-template-content-meta className="mt-1 flex items-start justify-between gap-3 text-[#64748b]">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] leading-5">
                        <span>자동 입력 값</span>
                        {templateVariables.map(({ label, token }) => (
                          <button data-owner-control-size="content" key={token} type="button" disabled={!editable || fixedContract} onClick={() => insertTemplateVariable(token)} aria-label={`${label} 변수 삽입`} title={token} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#d9e3ef] bg-[#f5f8fc] px-2.5 text-[#36516f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-default">
                            {label}<span aria-hidden="true">#</span>
                          </button>
                        ))}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[12px] leading-5">{templateContent.length} / 1,000</span>
                    </div>}
                  </div>
                  {view === "draft" && <details><summary className="flex min-h-[44px] cursor-pointer items-center text-[16px] font-medium leading-6 text-[#475569]">버튼 설정{needsButton ? " · 필수" : " · 선택"}</summary>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 이름{needsButton ? " · 필수" : " · 선택"}</span><input value={buttonName} readOnly maxLength={14} className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading ? "승인된 버튼을 불러오는 중" : needsButton ? "승인된 버튼 확인 필요" : "버튼 없음"} /></label><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 링크 · 고정</span><input type="url" value={buttonUrl} readOnly className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading ? "승인된 링크를 불러오는 중" : needsButton ? "승인된 링크 확인 필요" : "버튼 없음"} /></label></div>
                  <p className="text-[13px] leading-5 text-[#64748b]">승인된 공통 템플릿의 버튼을 그대로 사용합니다.</p>
                  {needsButton && !loading && (!buttonName || !buttonUrl) ? <p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">승인된 공통 버튼을 불러오지 못해 저장할 수 없습니다.</p> : null}
                  {unsupportedButtonCount ? <p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">공통 템플릿에 버튼이 여러 개 있어 요청할 수 없습니다. 관리자에게 확인해 주세요.</p> : null}
                  </details>}
                  {view === "draft" && <p className="text-[14px] leading-5 text-[#64748b]">승인 후 ‘이 문구 사용하기’를 눌러야 적용됩니다.</p>}

         </div>
:<div data-review-message className="whitespace-pre-wrap break-words text-[16px] leading-6 text-[#15213b]">{templateContent}</div>}
           {!editable&&currentTemplate?.inspection_status==="rejected"&&<button data-owner-control-size="content" type="button" onClick={()=>beginDraft(templateContent)} className="min-h-[44px] rounded-[8px] border border-[#dbe2ea] px-3 text-[14px]">수정해 새 초안 만들기</button>}
           {!editable&&currentTemplate?.inspection_status==="approved"&&selection?.options.some(option=>option.code===currentTemplate.template_code)&&!isAppliedRow(currentTemplate)&&<button data-owner-control-size="content" type="button" onClick={()=>{setChoice(currentTemplate.template_code);setView("approved");}} className="min-h-[44px] rounded-[8px] border border-[#dbe2ea] px-3 text-[14px]">승인 문구 확인하기</button>}
         </section>}
         {deliverySettings&&<div className="mt-4 border-t border-[#e8edf3] pt-3">{deliverySettings}</div>}
         {error&&<p role="alert" className="mt-3 text-[14px] text-[#9a5e4e]">{error}</p>}{notice&&<p role="status" className="mt-3 text-[14px] !text-[#1f6b5b]">{notice}</p>}
       </main>
     </div>
     <aside aria-label="카카오톡 알림톡 수신 화면" className="no-scrollbar min-w-0 rounded-[14px] border border-[#e1e4ea] bg-white p-4 sm:p-5 xl:overflow-y-auto"><p className="mb-3 text-[18px] font-medium leading-[26px] text-[#15213b]">카카오톡 수신 화면</p>{view!=="current"&&<p className="mb-2 text-[12px] text-[#64748b]">{view==="approved"?"선택한 문구 미리보기":editable?"작성 중인 문구":"내 문구"}</p>}<AlimtalkKakaoChatPreview message={preview} buttons={previewButtons} senderName={senderName} /></aside>
   </div>
   {editable&&<footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-2.5 sm:px-6"><button data-owner-control-size="content" type="button" disabled={saving||loading||!categories.length||unsupportedButtonCount||(needsButton&&(!buttonName||!buttonUrl))} onClick={()=>void save("save")} className="min-h-[44px] rounded-[9px] border border-[#dbe2ea] px-4 text-[16px]">임시 저장</button><button data-owner-control-size="content" type="button" disabled={saving||loading||!categories.length||unsupportedButtonCount||(needsButton&&(!buttonName||!buttonUrl))} onClick={()=>void save("submit")} className="min-h-[44px] rounded-[9px] bg-[#111a30] px-5 text-[16px] font-medium text-white disabled:opacity-50">{saving?"요청 중…":"검수 요청"}</button></footer>}
 </section>;
}
