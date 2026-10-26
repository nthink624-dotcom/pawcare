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
const CREATE_TEMPLATE_MENU_VALUE = "__owner_create_alimtalk_template__";
const DRAFT_TEMPLATE_MENU_VALUE = "__owner_alimtalk_draft_in_progress__";
const OWNER_TEMPLATE_MENU_PREFIX = "__owner_alimtalk_template__:";

type TemplateSource = "owner" | "petmanager";
type SelectedTemplate = { code: string; name: string; content: string; buttons: string[]; source?: TemplateSource };
type SelectionItem = { alias: AlimtalkTemplateAlias; title: string; version: number; current: SelectedTemplate | null; currentSource: TemplateSource | null; blocked: boolean; options: SelectedTemplate[] };
type DeliveryState = { enabled: boolean; disabled: boolean };

export function OwnerAlimtalkTemplateEditor({ shopId, shopName, senderName = PETMANAGER_SERVICE_NAME, selectedAlias, options, onSelectAlias, globalAlimtalkEnabled, onGlobalAlimtalkEnabledChange, deliveryState, onToggleDelivery, deliverySettings, demoMode = false }: {
 shopId: string; shopName: string; senderName?: string; selectedAlias: AlimtalkTemplateAlias; options: TemplateOption[]; onSelectAlias: (alias: AlimtalkTemplateAlias) => void;
 globalAlimtalkEnabled: boolean; onGlobalAlimtalkEnabledChange: (enabled: boolean) => void | Promise<void>;
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
  const [templateId, setTemplateId] = useState(""), [templateName, setTemplateName] = useState(""), [templateContent, setTemplateContent] = useState("");
 const [categoryCode, setCategoryCode] = useState(""), [buttonName, setButtonName] = useState(""), [buttonUrl, setButtonUrl] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [loadWarning, setLoadWarning] = useState(""), [templateNameError, setTemplateNameError] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
 const [helpType, setHelpType] = useState<AlimtalkTemplateAlias | null>(null);
  const editedContentKey = useRef(""), editedTemplateNameKey = useRef(""), templateContentRef = useRef<HTMLTextAreaElement>(null), templateNameRef = useRef<HTMLInputElement>(null), loadSequence = useRef(0);
 const target = useRef<{ alias: string; code: string } | null>(null), editorRef = useRef<HTMLElement>(null);
 const helpOpen = helpType === selectedAlias;
 useEffect(() => { const p = new URLSearchParams(window.location.search); target.current = (!p.get("shopId") || p.get("shopId") === shopId) && p.get("templateAlias") && p.get("templateCode") ? { alias:p.get("templateAlias")!,code:p.get("templateCode")! } : null; }, [shopId]);
 const loadTemplates = useCallback(async () => {
   const sequence = ++loadSequence.current; setLoading(true); setLoadWarning("");
    if(demoMode){
      setTemplates([]);setSelectionItems([]);setCategories([]);setButtonDefaults({});setPreviewValues({});setLoading(false);
      return true;
    }
   try {
     const [templatesResult, selectionsResult] = await Promise.allSettled([
       fetchApiJsonWithAuth<{ templates: ShopTemplate[]; categories: TemplateCategory[]; buttonDefaults: ButtonDefaults; approvedTemplates?: Partial<Record<AlimtalkTemplateAlias, ApprovedTemplate>>; previewValues?: Record<string,string> }>(`/api/owner/alimtalk-templates?shopId=${encodeURIComponent(shopId)}`, { cache:"no-store" }),
       fetchApiJsonWithAuth<{ items: SelectionItem[] }>(`/api/owner/alimtalk-template-selection?shopId=${encodeURIComponent(shopId)}`, { cache:"no-store" }),
     ]);
     if(sequence!==loadSequence.current)return false;
     if(templatesResult.status==="fulfilled"){
       const response=templatesResult.value;
       setTemplates(response.templates);setCategories(response.categories);setButtonDefaults(response.buttonDefaults??{});setPreviewValues(response.previewValues??{});
     }
     if(selectionsResult.status==="fulfilled")setSelectionItems(selectionsResult.value.items);
     const templateError=templatesResult.status==="rejected"?templatesResult.reason instanceof Error?templatesResult.reason.message:"매장 문안 목록을 불러오지 못했습니다.":"";
     const selectionError=selectionsResult.status==="rejected"?selectionsResult.reason instanceof Error?selectionsResult.reason.message:"승인 문안 목록을 불러오지 못했습니다.":"";
     const warnings:string[]=[];
     const accessError=[templateError,selectionError].find(message=>message==="소유한 매장이 없습니다."||message==="다른 매장 데이터에는 접근할 수 없습니다.");
     if(accessError)warnings.push("현재 로그인한 계정에서 이 매장에 접근할 수 없습니다. 로그인 계정과 매장 연결을 확인해 주세요.");
     else if(templateError&&selectionError)warnings.push("저장된 문안과 승인 상태를 불러오지 못했습니다. 기본 문안을 표시합니다.");
     else if(templateError)warnings.push("매장에 저장한 문안 목록을 불러오지 못했습니다. 기본 문안과 승인 문안은 표시됩니다.");
     else if(selectionError)warnings.push("승인 문안 상태를 불러오지 못했습니다. 기본 문안을 표시합니다.");
     if(templatesResult.status==="fulfilled"&&!templatesResult.value.categories.length)warnings.push("알림 분류를 불러오지 못해 새 문안 등록은 잠시 사용할 수 없습니다.");
     setLoadWarning(warnings.join(" "));
     return selectionsResult.status==="fulfilled";
   } finally { if(sequence===loadSequence.current)setLoading(false); }
  },[demoMode,shopId]);
 useEffect(()=>{void loadTemplates();return()=>{loadSequence.current++;};},[loadTemplates]);
 useEffect(()=>subscribeBookingPolicyChange(shopId,()=>{void loadTemplates();}),[shopId,loadTemplates]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")void loadTemplates();};window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};},[loadTemplates]);
 useEffect(()=>{setView("current");setStoredId("");setNewVersion(false);setNotice("");setError("");editedContentKey.current="";},[selectedAlias]);
 const relatedTemplates = templates.filter(t=>t.template_alias===selectedAlias);
 const currentTemplate = relatedTemplates.find(t=>t.id===storedId)??relatedTemplates[0];
 const selection = selectionItems.find(item=>item.alias===selectedAlias);
 const activeTemplate = selection?.current??null;
 const defaultTemplate = useMemo<SelectedTemplate | null>(() => {
   const content = getNotificationDraftBodyByAlias(selectedAlias);
   if (!content) return null;
   const contract = DEPOSIT_ALIMTALK_REVIEW_CONTRACTS[selectedAlias as keyof typeof DEPOSIT_ALIMTALK_REVIEW_CONTRACTS]
     ?? APPROVED_ALIMTALK_CONTRACTS[selectedAlias as keyof typeof APPROVED_ALIMTALK_CONTRACTS];
   return { code: "", name: "기본 문안", content, buttons: contract?.button ? [contract.button] : [], source: "petmanager" };
 }, [selectedAlias, notificationTitle]);
 const candidate = selection?.options.find(option=>option.code===choice)??null;
 const displayedCurrent = activeTemplate ?? defaultTemplate;
  const displayedCurrentTitle = displayedCurrent?.source === "petmanager" ? "기본 문안" : displayedCurrent?.name ?? "";
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
   else setError("해당 문안은 현재 사용할 수 없습니다. 기존 발송 문안은 유지됩니다.");
 },[selection,selectedAlias]);
 useEffect(()=>{
   const defaultButton=selectedButtonDefaults[0];
   if(view==="draft"){
      if(editedTemplateNameKey.current!==draftKey){if(!newVersion)setTemplateName(currentTemplate?.template_name??"");editedTemplateNameKey.current=draftKey;setTemplateNameError("");}
     if(editedContentKey.current!==draftKey){
       setTemplateContent(newVersion?cloneContent:currentTemplate?.template_content??activeTemplate?.content??"");
     }
     setTemplateId(!newVersion&&currentTemplate?.inspection_status==="draft"?currentTemplate.id:"");
     setButtonName(defaultButton?.buttonName??currentTemplate?.template_buttons[0]?.buttonName??"");
     setButtonUrl(defaultButton?.linkMobile??currentTemplate?.template_buttons[0]?.linkMobile??"");
     setCategoryCode(currentTemplate?.category_code||categories[0]?.code||"");
   }else{
     setTemplateContent(displayTemplate?.content??"");
     setButtonName(displayTemplate?.buttons[0]??defaultButton?.buttonName??"");setButtonUrl(defaultButton?.linkMobile??"");
   }
  },[view,draftKey,newVersion,cloneContent,currentTemplate,activeTemplate,displayTemplate,selectedAlias,selectedButtonDefaults,categories,notificationTitle]);
  function beginDraft(content: string, initialTitle=""){editedContentKey.current="";editedTemplateNameKey.current="";setCloneContent(content);setTemplateName(initialTitle);setTemplateNameError("");setNewVersion(true);setTemplateId("");setStoredId("");setView("draft");setNotice("");setError("");}
  function openStoredDraft(row: ShopTemplate){editedContentKey.current="";editedTemplateNameKey.current="";setTemplateName(row.template_name);setTemplateNameError("");setStoredId(row.id);setTemplateId(row.inspection_status==="draft"?row.id:"");setNewVersion(false);setView("draft");setNotice("");setError("");}
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
   if(action==="submit"&&!templateId){setError("먼저 ‘내 문안 등록하기’를 눌러 문안을 등록해 주세요.");return;}
   if(!templateName.trim()){setError("");setTemplateNameError("내 문안 제목을 입력해 주세요.");templateNameRef.current?.focus();return;}
   if(!templateContent.trim()||!categoryCode){setError("문안 내용과 알림 분류를 확인해 주세요.");return;}
   const isRegistration=action==="save"&&!templateId;
   setSaving(true);setTemplateNameError("");setError("");setNotice("");
   try{
      const response=await fetchApiJsonWithAuth<{template:ShopTemplate}>("/api/owner/alimtalk-templates",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({shopId,templateAlias:selectedAlias,templateName:templateName.trim(),templateContent,categoryCode,action,...(templateId&&!newVersion?{id:templateId}:{})})});
     setTemplates(rows=>[response.template,...rows.filter(row=>row.id!==response.template.id)]);setTemplateId(response.template.id);setStoredId(response.template.id);setNewVersion(false);editedContentKey.current="";
     if(action==="submit")await loadTemplates();
     setNotice(action==="submit"?"검수 요청을 보냈습니다. 기존 발송 문안은 유지됩니다.":isRegistration?"내 문안을 등록했습니다. 이어서 검수 요청을 해 주세요.":"초안을 저장했습니다. 기존 발송 문안은 유지됩니다.");
    }catch(cause){const message=cause instanceof Error?cause.message:"초안을 저장하지 못했습니다.";if(message==="이미 등록된 문안 제목입니다. 다른 제목을 입력해 주세요."){setTemplateNameError(message);requestAnimationFrame(()=>templateNameRef.current?.focus());}else setError(message);}finally{setSaving(false);}
 }
 const canApply=Boolean(candidate&&selection&&(!activeTemplate||selection.blocked||candidate.code!==activeTemplate.code||candidate.content!==activeTemplate.content||JSON.stringify(candidate.buttons)!==JSON.stringify(activeTemplate.buttons)));
 async function apply(){
   if(!selection||!candidate||saving||!canApply)return;setSaving(true);setError("");setNotice("");
   try{
     const saved=await fetchApiJsonWithAuth<{saved:boolean;version:number}>("/api/owner/alimtalk-template-selection",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({shopId,templateAlias:selectedAlias,templateCode:candidate.code,expectedVersion:selection.version})});
     setSelectionItems(items=>items.map(item=>item.alias===selectedAlias?{...item,version:saved.version,current:candidate,currentSource:candidate.source??"petmanager",blocked:false}:item));
     setChoice(candidate.code);setView("current");
     const refreshed=await loadTemplates();
     setNotice(refreshed?"이 매장에서 사용할 문안을 적용했습니다.":"문안을 적용했습니다. 최신 승인 상태를 불러오지 못해 저장한 문안을 표시하고 있습니다.");
   }
   catch(cause){setError(cause instanceof Error?cause.message:"기존 문안을 유지합니다. 다시 확인해 주세요.");}finally{setSaving(false);}
 }
 const preview=templateContent.trim()?sampleMessage:"작성할 문안이 여기에 표시됩니다.";
 const previewButtons=view==="draft"?(buttonName&&buttonUrl?[buttonName]:[]):displayTemplate?.buttons??[];
 const groupedOptions=options.reduce<Record<string,TemplateOption[]>>((groups,option)=>{(groups[option.group]??=[]).push(option);return groups;},{});

 const selectedDelivery=deliveryState(selectedAlias);
 function sameSnapshot(a: SelectedTemplate | null, b: SelectedTemplate | null) {
   return Boolean(a&&b&&a.code===b.code&&a.content===b.content&&JSON.stringify(a.buttons)===JSON.stringify(b.buttons));
 }
 function isAppliedRow(row: ShopTemplate) {return Boolean(activeTemplate&&!selection?.blocked&&row.template_code===activeTemplate.code&&row.template_content===activeTemplate.content&&JSON.stringify(row.template_buttons.map(button=>button.buttonName))===JSON.stringify(activeTemplate.buttons));}
 function storedStatus(row: ShopTemplate) {return row.inspection_status==="approved"&&isAppliedRow(row)?"현재 사용 중":statusNames[row.inspection_status]??"상태 확인 필요";}
  const ownedTemplates=relatedTemplates;
   const draftWorkspace=view==="draft"?<div data-template-authoring className="space-y-3">
     <section data-draft-workspace className="space-y-3">
       {editable?<div className="space-y-3">
         <div>
           <label htmlFor="owner-alimtalk-template-title" className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">내 문안 제목</label>
           <input ref={templateNameRef} id="owner-alimtalk-template-title" type="text" value={templateName} maxLength={100} aria-invalid={Boolean(templateNameError)} aria-describedby={templateNameError?"owner-alimtalk-template-title-error":undefined} onChange={event=>{editedTemplateNameKey.current=draftKey;setTemplateName(event.target.value);setTemplateNameError("");}} className={inputClass} placeholder="제목 입력" />
           {templateNameError?<p id="owner-alimtalk-template-title-error" role="alert" className="mt-1 text-[14px] text-[#9a5e4e]">{templateNameError}</p>:null}
         </div>
         <div>
           <label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">보호자에게 보낼 내용</span><textarea ref={templateContentRef} value={templateContent} readOnly={!editable||fixedContract} onChange={event=>{editedContentKey.current=draftKey;setTemplateContent(event.target.value);}} maxLength={1000} rows={10} className="min-h-[220px] w-full resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15 read-only:bg-white" placeholder="원하는 문안을 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." /></label>
           <div data-template-content-meta className="mt-1 flex items-start justify-between gap-3 text-[#64748b]">
             <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] leading-5">
               <span className="basis-full">필요한 정보를 누르면 문안에 추가되고, 발송할 때 실제 값으로 바뀝니다.</span>
               {templateVariables.map(({label,token})=><button data-owner-control-size="content" key={token} type="button" disabled={!editable||fixedContract} onClick={()=>insertTemplateVariable(token)} aria-label={`${label} 자동 입력 정보 넣기`} className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[#d9e3ef] bg-white px-3 text-[#36516f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-default">{label}</button>)}
             </div>
             <span className="shrink-0 whitespace-nowrap text-[12px] leading-5">{templateContent.length} / 1,000</span>
           </div>
         </div>
         <details><summary className="flex min-h-[44px] cursor-pointer items-center text-[16px] font-medium leading-6 text-[#475569]">버튼 설정{needsButton?" · 필수":" · 선택"}</summary>
           <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 이름{needsButton?" · 필수":" · 선택"}</span><input value={buttonName} readOnly maxLength={14} className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading?"승인된 버튼을 불러오는 중":needsButton?"승인된 버튼 확인 필요":"버튼 없음"} /></label><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 링크 · 고정</span><input type="url" value={buttonUrl} readOnly className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading?"승인된 링크를 불러오는 중":needsButton?"승인된 링크 확인 필요":"버튼 없음"} /></label></div>
           <p className="text-[13px] leading-5 text-[#64748b]">승인된 공통 템플릿의 버튼을 그대로 사용합니다.</p>
           {needsButton&&!loading&&(!buttonName||!buttonUrl)?<p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">승인된 공통 버튼을 불러오지 못해 저장할 수 없습니다.</p>:null}
           {unsupportedButtonCount?<p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">공통 템플릿에 버튼이 여러 개 있어 요청할 수 없습니다. 관리자에게 확인해 주세요.</p>:null}
         </details>
         <p className="text-[14px] leading-5 text-[#64748b]">내 문안을 등록한 뒤 검수 요청을 해 주세요. 승인되면 현재 사용 문안에서 선택할 수 있습니다.</p>
       </div>:<div data-review-message className="whitespace-pre-wrap break-words text-[16px] leading-6 text-[#15213b]">{templateContent}</div>}
       {!editable&&currentTemplate?.inspection_status==="rejected"?<button data-owner-control-size="content" type="button" onClick={()=>beginDraft(templateContent)} className="min-h-[44px] rounded-[8px] border border-[#dbe2ea] px-3 text-[14px]">수정해 새 초안 만들기</button>:null}
     </section>
   </div>:null;
 return <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white" data-owner-template-editor>
   <div className="no-scrollbar mx-3 my-3 grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto sm:mx-5 xl:auto-rows-auto xl:grid-cols-[minmax(0,1fr)_295px] xl:overflow-hidden">
      <div data-settings-body-container className="grid min-h-max min-w-0 overflow-hidden rounded-[14px] border border-[#e1e4ea] bg-white lg:grid-cols-[260px_minmax(0,1fr)] xl:min-h-0">
       <nav aria-label="알림 종류" className="no-scrollbar flex min-w-0 flex-col border-b border-[#e8edf3] bg-white p-3 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-0">
        <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 flex min-h-[68px] shrink-0 items-center justify-between gap-3 border-b border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 shadow-sm lg:mx-0 lg:mt-0 lg:mb-0">
          <span className="min-w-0 text-[18px] font-semibold leading-[26px] text-[#15213b]">알림톡 전체 사용</span>
           <AlertSettingsSwitch checked={globalAlimtalkEnabled} aria-label="알림톡 전체 사용" onCheckedChange={enabled => onGlobalAlimtalkEnabledChange(enabled)} />
         </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:p-3">
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
         <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#e8edf3] bg-[#f8fafc] px-4 py-3 sm:px-5">
           <div className="flex min-w-0 items-center gap-1"><h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">{notificationTitle}</h3><button data-owner-control-size="content" type="button" aria-label={notificationTitle+" 역할 도움말"} aria-expanded={helpOpen} onClick={()=>setHelpType(helpOpen?null:selectedAlias)} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc]"><CircleHelp className="h-4 w-4" aria-hidden="true" /></button></div>
            <div className="flex shrink-0 items-center gap-2 text-[13px] text-[#64748b]"><span>사용</span><AlertSettingsSwitch data-template-delivery-toggle checked={selectedDelivery?.enabled??false} disabled={!selectedDelivery||selectedDelivery.disabled||saving||loading||((!activeTemplate||selection?.blocked)&&!selectedDelivery.enabled)} aria-label={notificationTitle+" 사용"} onCheckedChange={()=>onToggleDelivery(selectedAlias)} /></div>
         </header>
         {helpOpen&&<p className="mb-3 text-[14px] leading-5 text-[#64748b]">{notificationHelp[notificationType]}</p>}
         {loading&&<p role="status" className="mb-3 text-[14px] text-[#64748b]">문안을 불러오는 중입니다.</p>}
          <section data-current-template className="space-y-3 rounded-[12px] border border-[#e8edf3] bg-[#f8fafc] p-4">
             <div className="flex flex-wrap items-center gap-3">
               <h4 className="text-[16px] font-medium text-[#15213b]">현재 사용 문안</h4>
                <div data-approved-template-choice className="w-full min-w-0 sm:w-[290px]"><select aria-label="현재 사용 문안 선택" value={view==="draft"?DRAFT_TEMPLATE_MENU_VALUE:view==="approved"&&choice?choice:activeTemplate?.code??""} disabled={loading||saving} onChange={event=>{const nextChoice=event.target.value;if(nextChoice===DRAFT_TEMPLATE_MENU_VALUE)return;if(nextChoice===CREATE_TEMPLATE_MENU_VALUE){const draftSource=view==="approved"&&candidate?candidate:displayedCurrent;beginDraft(draftSource?.content??"",draftSource?.source==="petmanager"?"기본 문안":"");return;}if(nextChoice.startsWith(OWNER_TEMPLATE_MENU_PREFIX)){const row=ownedTemplates.find(template=>template.id===nextChoice.slice(OWNER_TEMPLATE_MENU_PREFIX.length));if(row)openStoredDraft(row);return;}setChoice(nextChoice);setView(!nextChoice||sameSnapshot(selection?.options.find(option=>option.code===nextChoice)??null,activeTemplate)?"current":"approved");setNotice("");setError("");}} className={`${inputClass} !h-[44px] !min-h-[44px]`}>
                {view==="draft"?<option value={DRAFT_TEMPLATE_MENU_VALUE}>{templateName||"기본 문안"}</option>:null}
                <optgroup label="승인된 문안">
                  {!activeTemplate&&defaultTemplate&&!selection?.options.some(option=>option.source==="petmanager")?<option value="">기본 문안</option>:null}
                  {activeTemplate&&!selection?.options.some(option=>option.code===activeTemplate.code)?<option value={activeTemplate.code} disabled>{activeTemplate.source==="petmanager"?"기본 문안":activeTemplate.name} · 현재 사용 중</option>:null}
                  {!activeTemplate&&!defaultTemplate&&!selection?.options.length?<option value="" disabled>{loading?"문안을 불러오는 중입니다.":"선택할 승인 문안이 없습니다."}</option>:null}
                  {selection?.options.map(option=><option key={option.code} value={option.code}>{option.source==="owner"?"내 문안 · "+option.name:"기본 문안"}{sameSnapshot(option,activeTemplate)?" · 현재 사용 중":""}</option>)}
                </optgroup>
                <optgroup label="내 문안">
                  {ownedTemplates.filter(row=>row.inspection_status!=="approved"||!selection?.options.some(option=>option.source==="owner"&&option.code===row.template_code)).map(row=><option key={row.id} value={`${OWNER_TEMPLATE_MENU_PREFIX}${row.id}`}>{row.template_name} · {storedStatus(row)}</option>)}
                  <option value={CREATE_TEMPLATE_MENU_VALUE}>새 문안 작성</option>
                </optgroup>
              </select></div>
            </div>
            {view==="draft"?draftWorkspace:<>
              {displayedCurrent?<div data-current-template-title className="space-y-1.5"><span className="block text-[16px] font-medium leading-6 text-[#475569]">문안 제목</span><div className="rounded-[8px] bg-white px-3 py-2"><p className="text-[16px] font-medium leading-6 text-[#15213b]">{displayedCurrentTitle}</p></div></div>:null}
              {displayedCurrent?<><div data-current-message-label className="text-[16px] font-medium leading-6 text-[#475569]">고객에게 보낼 문안</div><div data-current-message="" className="whitespace-pre-wrap break-words rounded-[8px] bg-white px-3 py-3 text-[16px] leading-6 text-[#15213b]">{displayedCurrent.content}</div></>:<p data-no-current-template className="rounded-[8px] bg-white px-3 py-3 text-[14px] leading-5 text-[#64748b]">{loading?"문안을 불러오는 중입니다.":selection?.blocked?"현재 사용 문안을 확인할 수 없습니다.":"현재 적용된 문안이 없습니다."}</p>}
              {view==="approved"&&candidate?<div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8edf3] pt-3"><div className="flex min-w-0 flex-wrap items-center gap-2"><span data-candidate-source className="rounded-full bg-white px-2.5 py-1 text-[12px] text-[#36516f]">{candidate.source==="owner"?"내 문안":"기본 문안"}</span>{candidate.source==="owner"?<span className="min-w-0 break-words text-[14px] text-[#15213b]">{candidate.name}</span>:null}</div>{canApply?<button data-owner-control-size="content" type="button" disabled={saving||loading} onClick={()=>void apply()} className="min-h-[44px] rounded-[9px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50">{saving?"적용 중…":"이 문안 사용하기"}</button>:<span className="text-[13px] text-[#64748b]">현재 사용 중</span>}</div>:null}
              {view==="approved"&&candidate?<p className="text-[13px] leading-5 text-[#64748b]">오른쪽 미리보기를 확인한 뒤 적용하세요. 문안을 고르는 것만으로는 바뀌지 않습니다.</p>:null}
            </>}
          </section>
         {deliverySettings&&<div className="mt-4 border-t border-[#e8edf3] pt-3">{deliverySettings}</div>}
         {loadWarning&&<p role="status" className="mt-3 text-[14px] text-[#8c6e53]">{loadWarning}</p>}{error&&<p role="alert" className="mt-3 text-[14px] text-[#9a5e4e]">{error}</p>}{notice&&<p role="status" className="mt-3 text-[14px] !text-[#1f6b5b]">{notice}</p>}
       </main>
     </div>
     <aside aria-label="카카오톡 알림톡 수신 화면" className="no-scrollbar min-w-0 rounded-[14px] border border-[#e1e4ea] bg-white p-4 sm:p-5 xl:overflow-y-auto"><p className="mb-3 text-[18px] font-medium leading-[26px] text-[#15213b]">카카오톡 수신 화면</p>{view!=="current"&&<p className="mb-2 text-[12px] text-[#64748b]">{view==="approved"?"선택한 문안 미리보기":editable?"작성 중인 문안":"내 문안"}</p>}<div className="-mx-[5px] [&>div]:max-w-[370px]"><AlimtalkKakaoChatPreview message={preview} buttons={previewButtons} senderName={senderName} /></div></aside>
   </div>
   {editable&&<footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-2.5 sm:px-6"><button data-owner-control-size="content" type="button" disabled={saving||loading||!categories.length||unsupportedButtonCount||(needsButton&&(!buttonName||!buttonUrl))} onClick={()=>void save("save")} className="min-h-[44px] rounded-[9px] border border-[#dbe2ea] px-4 text-[16px]">{templateId?"초안 저장":"내 문안 등록하기"}</button><button data-owner-control-size="content" type="button" disabled={saving||loading||!templateId||!categories.length||unsupportedButtonCount||(needsButton&&(!buttonName||!buttonUrl))} onClick={()=>void save("submit")} className="min-h-[44px] rounded-[9px] bg-[#111a30] px-5 text-[16px] font-medium text-white disabled:opacity-50">{saving?"요청 중…":"검수 요청"}</button></footer>}
 </section>;
}
