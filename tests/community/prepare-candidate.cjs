const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),candidate=path.join(root,'.codex-work/service-chip-release-20261108/source');
if(process.argv.includes('--recover')){
 const owned=['apps/mobile/src/components/owner/owner-app.tsx','apps/web/src/components/owner-web/owner-feedback-adapter.ts','apps/web/src/components/owner-web/owner-web-app-shell.tsx','apps/web/src/components/owner-web/owner-web-data.ts','apps/web/src/components/owner-web/owner-web-preview.tsx'];
 const changed=execFileSync('git',['diff','--name-only'],{cwd:candidate,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 if(changed.some(file=>!owned.includes(file)))throw Error('Unexpected candidate edits; recovery stopped.');
 for(const file of changed){const backup=path.join(root,'.codex-work/community-20261109/candidate-preparation-backup',file);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(path.join(candidate,file),backup);const baseline=execFileSync('git',['show','HEAD:'+file],{cwd:candidate});fs.writeFileSync(path.join(candidate,file),baseline);}
}
const status=execFileSync('git',['status','--porcelain'],{cwd:candidate,encoding:'utf8'}).trim();
if(status&&!process.argv.includes('--recover'))throw Error('Candidate is not clean; preserve and review before preparing again.');
const files=[
 'apps/shared/contracts/community.ts','apps/shared/lib/community-images.ts',
 ...['community-board','community-form','community-detail'].map(n=>'apps/shared/components/community/'+n+'.tsx'),
 ...['schema','service'].map(n=>'apps/web/src/server/community/'+n+'.ts'),
 'apps/web/src/app/api/owner/community/route.ts','apps/web/src/app/api/admin/community/route.ts','apps/web/src/app/admin/community/page.tsx','apps/web/src/components/admin/admin-community-screen.tsx',
 'supabase/migrations/20261109111431_member_community.sql','docs/shared/community-contract.md',
 ...fs.readdirSync(path.join(root,'tests/community')).filter(n=>n!=='prepare-candidate.cjs').map(n=>'tests/community/'+n),
];
function edit(file,pairs){let text=fs.readFileSync(path.join(candidate,file),'utf8').replaceAll('\r\n','\n');for(const [from,to,count=1]of pairs){const found=text.split(from).length-1;if(found!==count)throw Error(file+': expected '+count+' matches, got '+found+' for '+from.slice(0,60));text=text.split(from).join(to);}fs.writeFileSync(path.join(candidate,file),text);files.push(file);}
edit('apps/web/src/components/owner-web/owner-web-data.ts',[
 ['  | "profitability"','  | "profitability"\n  | "community"'],['  { key: "profitability", label: "매출 분석" },','  { key: "profitability", label: "매출 분석" },\n  { key: "community", label: "커뮤니티" },']]);
edit('apps/web/src/components/owner-web/owner-web-app-shell.tsx',[
 ['  MessageSquareWarning,','  MessageSquareWarning,\n  MessagesSquare,'],['  profitability: ChartNoAxesCombined,','  profitability: ChartNoAxesCombined,\n  community: MessagesSquare,'],
 ['      { key: "profitability", label: "매출 분석" },','      { key: "profitability", label: "매출 분석" },\n      { key: "community", label: "커뮤니티" },',2]]);
edit('apps/web/src/components/owner-web/owner-web-preview.tsx',[
 ['const CalendarManagementScreen = dynamic(','const CommunityBoard = dynamic(() => import("@petmanager/shared/components/community/community-board"), { loading: OwnerScreenLoading });\n\nconst CalendarManagementScreen = dynamic('],
 ['"profitability", "services"','"profitability", "community", "services"'],
 ['  switch (screen) {','  switch (screen) {\n    case "community":\n      return <CommunityBoard key={initialData.shop.id} shopId={initialData.shop.id} api={fetchApiJsonWithAuth} />;']]);
edit('apps/web/src/components/owner-web/owner-feedback-adapter.ts', [['  profitability: "other",','  profitability: "other",\n  community: "other",']]);
edit('apps/mobile/src/components/owner/owner-app.tsx',[
 ['"use client";','"use client";\nimport { MessagesSquare } from "lucide-react";\nimport CommunityBoard from "@petmanager/shared/components/community/community-board";'],
 ['type TabKey = "home" | "book" | "customers" | "settings";','type TabKey = "home" | "book" | "customers" | "community" | "settings";'],
 ['  { key: "customers", label: "고객 관리", icon: PawPrint },','  { key: "customers", label: "고객 관리", icon: PawPrint },\n  { key: "community", label: "커뮤니티", icon: MessagesSquare },'],
 ['  const [activeTab, setActiveTab] = useState<TabKey>("home");','  const [activeTab, setActiveTab] = useState<TabKey>("home");\n  const communityBackRef = useRef<(() => boolean) | null>(null);'],
 ['    if (activeTab !== "home") {','    if (activeTab === "community" && communityBackRef.current?.()) return;\n    if (activeTab !== "home") {'],
 ['        {activeTab === "customers" && !selectedGuardian && (','        {activeTab === "community" && <CommunityBoard key={data.shop.id} shopId={data.shop.id} api={fetchApiJsonWithAuth} showTitle={false} backActionRef={communityBackRef} />}\n        {activeTab === "customers" && !selectedGuardian && ('],
 ['<div className="grid grid-cols-4 gap-1">','<div className="grid grid-cols-5 gap-1">']]);
edit('apps/mobile/src/lib/api.ts',[
 ['  const headers = new Headers(init?.headers);\n  if (!headers.has("Content-Type")) {','  const headers = new Headers(init?.headers);\n  const hasFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;\n  if (!headers.has("Content-Type") && !hasFormDataBody) {']]);
edit('apps/web/src/components/admin/admin-section-nav.tsx',[
 [' | "operationalErrors";',' | "operationalErrors" | "community";'],['  { id: "support", href: "/admin/support", label: "고객 문의", icon: MessageCircle },','  { id: "support", href: "/admin/support", label: "고객 문의", icon: MessageCircle },\n  { id: "community", href: "/admin/community", label: "커뮤니티 신고", icon: MessageSquareText },']]);
for(const file of files.filter(file=>!['owner-web-data.ts','owner-web-app-shell.tsx','owner-web-preview.tsx','owner-feedback-adapter.ts','owner-app.tsx','api.ts','admin-section-nav.tsx'].includes(path.basename(file)))){const dest=path.join(candidate,file);if(fs.existsSync(dest))throw Error('Unexpected existing new file '+file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.appendFileSync(path.join(candidate,'docs/shared/data-contracts.md'),'\n\n### Member community (2026-11-09)\n\nSee [community-contract.md](community-contract.md) for the canonical shared PC/mobile community contract.\n');files.push('docs/shared/data-contracts.md');
const base=execFileSync('git',['rev-parse','HEAD'],{cwd:candidate,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(root,'.codex-work/community-20261109/candidate.json'),JSON.stringify({root:candidate,base,files},null,2));console.log(JSON.stringify({candidate,base,files:files.length}));
