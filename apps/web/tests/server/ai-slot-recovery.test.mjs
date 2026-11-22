import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { it } from 'node:test';
import { z } from 'zod';
const rules = await import('../../src/lib/booking-slot-recommendations.ts');
const availability = await import('../../src/lib/availability.ts');
const policy = await import('../../src/lib/ai-booking-policy.ts');
const { normalizeReservationPolicySettings } = await import('../../src/lib/reservation-policy-settings.ts');
const { addDate, currentDateInTimeZone, timeFromMinutes } = await import('../../src/lib/utils.ts');
const { validateCustomerBookingDate } = await import('../../src/lib/customer-booking-window.ts');
const { getStaffBookingLoads } = await import('../../src/lib/staff-booking-load.ts');

function moduleWithMocks(file, imports, fetch) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, fetch, AbortController, setTimeout, clearTimeout, URL,
    require(name) { if (!(name in imports)) throw new Error(`Unexpected test dependency ${name}`); return imports[name]; },
  });
  return module.exports;
}
const params = { date: addDate(currentDateInTimeZone(), 10), availableSlots: ['10:00','11:00','12:00','13:00','14:00','15:00'],
  baselineRecommendedSlots: ['14:00'], serviceName: '전체 미용', durationMinutes: 90, staffScoped: true,
  recommendationMode: 'continuity', customInstruction: '', staffLoads: [], eligibleStaffBySlot: [] };
function engine(fetch) {
  return moduleWithMocks('../../src/server/ai-slot-recommendations.ts', {
    '@/lib/booking-slot-recommendations': rules, '@/lib/ai-booking-policy': policy,
    '@/lib/server-env': { serverEnv: { aiSlotRecommendationProvider: 'deepseek', deepseekApiKey: 'synthetic-fixture', deepseekModel: 'fixture' } },
  }, fetch);
}
for (const [label, response] of [
  ['HTTP failure', { ok: false }],
  ['empty candidates', { ok: true, json: async () => ({ choices: [{ message: { content: '{"recommendedSlots":[]}' } }] }) }],
  ['invalid candidates', { ok: true, json: async () => ({ choices: [{ message: { content: '{"recommendedSlots":["23:59"]}' } }] }) }],
]) it(`${label} preserves continuity fallback and its truthful source`, async () => {
  const result = await engine(async () => response).recommendAvailableSlotsWithAi(params);
  assert.equal(result.source, 'rule');
  assert.equal(result.recommendedSlots[0], '14:00');
});
it('sends late-day candidates beyond the former forty-slot cutoff', async () => {
  let payload;
  const api = engine(async (_, options) => { payload=JSON.parse(options.body); return { ok:false }; });
  const availableSlots=Array.from({length:49}, (_,i)=>timeFromMinutes(480+i*15));
  await api.recommendAvailableSlotsWithAi({...params, availableSlots, baselineRecommendedSlots:['19:00']});
  const input=JSON.parse(payload.messages[1].content);
  assert.equal(input.availableSlots.length,49);
  assert.ok(input.availableSlots.includes('19:00'));
});
const shop={ id:'solo-shop', business_hours:Object.fromEntries(Array.from({length:7},(_,i)=>[i,{open:'10:00',close:'18:00',enabled:true}])),
  regular_closed_days:[],temporary_closed_dates:[],booking_available_start_time:'10:00',booking_available_end_time:'18:00',
  booking_slot_interval_minutes:15,booking_slot_offset_minutes:0,concurrent_capacity:1,reservation_policy_settings:{} };
const services=[{id:'short',name:'미용',duration_minutes:90,is_active:true},{id:'long',name:'긴 미용',duration_minutes:240,is_active:true}];
const staff={id:'solo',shop_id:shop.id,name:'원장',services:['미용','긴 미용'],startTime:'10:00',endTime:'18:00',defaultDays:['sun','mon','tue','wed','thu','fri','sat'],status:'active'};
it('offers an exact ninety-minute fit before the next solo-shop booking', () => {
  const date=params.date;
  const appointments=[{id:'existing',appointment_date:date,appointment_time:'14:10',status:'confirmed',service_id:'long',staff_id:staff.id}];
  const slots=availability.computeAvailableSlots({date,serviceId:'short',shop,services,appointments,staffId:staff.id,staffMembers:[staff]});
  assert.ok(slots.includes('12:40'), 'off-grid exact fit must be an available candidate');
  const baseline=availability.computeRecommendedAvailableSlots({date,availableSlots:slots,durationMinutes:90,appointments,services,staffId:staff.id});
  const result=rules.buildRuleBasedSlotRecommendations({availableSlots:slots,baselineRecommendedSlots:baseline,recommendationMode:'continuity'});
  assert.equal(result[0],'12:40');
});
it('defaults other-time access to off and preserves an explicit owner choice', () => {
  assert.equal(normalizeReservationPolicySettings(undefined).customer_other_available_times_enabled,false);
  assert.equal(normalizeReservationPolicySettings({customer_other_available_times_enabled:true}).customer_other_available_times_enabled,true);
  assert.equal(normalizeReservationPolicySettings({customer_other_available_times_enabled:'true'}).customer_other_available_times_enabled,false);
});
for(const enabled of [false,true]) it(`availability obeys owner other-time setting ${enabled} including full=1`, async () => {
  const bootstrap={shop:{...shop,reservation_policy_settings:{customer_other_available_times_enabled:enabled}},services,appointments:[],staffMembers:[staff],staffScheduleOverrides:[]};
  class OwnerApiError extends Error {}
  const endpoint=moduleWithMocks('../../src/app/api/availability/route.ts', {
    'next/server':{NextResponse:{json:(body,options)=>({body,options})}},
    '@/lib/availability':availability, '@/lib/customer-booking-window':{validateCustomerBookingDate},
    '@/lib/staff-booking-load':{getStaffBookingLoads},
    '@/server/ai-slot-recommendations':{recommendAvailableSlotsWithAi:async()=>({recommendedSlots:['11:00','14:00'],source:'rule'})},
    '@/server/owner-api-auth':{OwnerApiError},
    '@/server/owner-initial-setup-guard':{requireOwnerInitialSetupCompleteBootstrap:async()=>bootstrap},
  });
  const base=`http://example.test/api/availability?shopId=${shop.id}&date=${params.date}&serviceId=short`;
  for(const suffix of ['', '&full=1']) {
    const result=await endpoint.GET({url:base+suffix});
    assert.equal(result.body.allowOtherAvailableTimes,enabled);
    if(enabled) assert.ok(result.body.slots.length>4);
    else assert.deepEqual(Array.from(result.body.slots),['11:00','14:00']);
  }
});

for(const enabled of [true,false]) it(`mobile owner API saves ${enabled} while preserving other reservation settings`, async () => {
  const originalPolicy={customer_other_available_times_enabled:!enabled,cancel_window:'2h',booking_blocked_windows:[{start:'12:00',end:'13:00'}]};
  let row={id:'shop',owner_user_id:'owner',name:'예시 매장',phone:'000',address:'예시 주소',description:'',reservation_policy_settings:originalPolicy,customer_page_settings:{},notification_settings:{enabled:true},updated_at:'2026-11-01T00:00:00Z'};
  let writes;
  const admin={from(){let update;const q={select(){return q;},eq(){return q;},update(value){update=value;writes=value;return q;},async maybeSingle(){if(update)row={...row,...update};return {data:row,error:null};}};return q;}};
  class OwnerApiError extends Error {constructor(message,status){super(message);this.status=status;}}
  const endpoint=moduleWithMocks('../../src/app/api/owner/shops/route.ts',{
    'next/server':{},'zod':{z},
    '@/lib/customer-page-settings':{MAX_CUSTOMER_PAGE_HERO_IMAGES:8,normalizeDiscountCoupons:x=>x},
    '@/lib/notification-settings':{coerceEnabledShopNotificationSettings:x=>x,normalizeShopNotificationSettings:x=>x},
    '@/lib/server-env':{hasSupabaseServerEnv:()=>true,getSupabaseServerRuntimeStage:()=> 'development'},
    '@/lib/supabase/server':{getSupabaseAdmin:()=>admin,getSupabaseAuthClient:()=>null},
    '@/server/owner-api-auth':{OwnerApiError,requireOwnerShop:async()=>({shopId:'shop',userId:'owner'}),assertOwnerOrManager(){},assertServerManagedAccountActive(){}},
    '@/server/owner-initial-setup-guard':{assertOwnerInitialSetupComplete:async()=>{},OWNER_INITIAL_SETUP_REQUIRED_MESSAGE:'준비 필요'},
    '@/server/owner-mobile-cors':{ownerMobileCorsJson:(_,body,init)=>({body,status:init?.status??200}),ownerMobileCorsPreflight(){}},
    '@/server/owner-shop-list':{readOwnerShopSummaries:async()=>[]},
    '@/server/shop-identity-guard':{buildShopIdentityChanges:()=>[],assertShopIdentityChangeLimit:async()=>({changeGroupId:null}),insertShopIdentityChangeEvents:async()=>{}},
  });
  const result=await endpoint.PATCH({json:async()=>({shopId:'shop',reservationPolicySettings:{customer_other_available_times_enabled:enabled}})});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.shop.reservation_policy_settings.customer_other_available_times_enabled,enabled);
  assert.deepEqual(JSON.parse(JSON.stringify(result.body.shop.reservation_policy_settings.booking_blocked_windows)),originalPolicy.booking_blocked_windows);
  assert.equal(writes.notification_settings,undefined,'saving time display must preserve notification settings');
});
