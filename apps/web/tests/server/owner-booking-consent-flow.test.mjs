import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const stub = source => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(source)}` });
const actor = { shopId: 'fixture-shop', userId: 'fixture-owner', role: 'owner' };
const identity = { id: 'fixture-appointment', guardianId: 'fixture-guardian', petId: 'fixture-pet' };
const choice = { decision: 'recognize', policyVersion: 3, documents: [{ id: 'fixture-document', version: 2 }] };
let recognize, reads, queued, saved, state, afterTasks, bookingSaved, requests, recognitionError, failureRecord;
globalThis.__bookingConsentFlow = {
  rpc: async (name, args) => { if (name === 'save_booking_preparation') { failureRecord = args.p_data; return { error: null }; } assert.equal(name, 'pm_record_consent_recognitions'); assert.equal(args.p_pet, identity.petId); await recognize; if (recognitionError) return { error: { message: 'CONSENT_DOCUMENT_CHANGED' } }; saved = true; for (const doc of state.documents) if (args.p_documents.some(chosen => chosen.id === doc.id && chosen.version === doc.version)) doc.status = 'recognized'; return { error: null }; },
  read: async () => { reads++; return state; },
  after: task => afterTasks.push(task),
  create: async input => { bookingSaved = true; return { id: identity.id, guardian_id: input.guardianId, pet_id: input.petId }; },
  request: async input => { requests.push(input); },
  preparation: () => ({ version: 1, data: { requests: [] } }),
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/lib/supabase/server') return stub('export const getSupabaseAdmin=()=>({rpc:(...args)=>globalThis.__bookingConsentFlow.rpc(...args),from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:globalThis.__bookingConsentFlow.preparation(),error:null})};return query}});');
  if (specifier === '@/server/customer-consent-state') return stub('export const readCustomerConsentState=(...args)=>globalThis.__bookingConsentFlow.read(...args);');
  if (specifier === '@/server/booking-preparation') return stub('export const getPreparation=async()=>({version:1,data:{requests:[]}});export const initializePreparation=getPreparation;export const actOnPreparation=async(prep,input)=>globalThis.__bookingConsentFlow.request(input);');
  if (specifier === '@/server/owner-api-auth') return stub('export class OwnerApiError extends Error{constructor(message,status){super(message);this.status=status}}export const requireOwnerShop=async()=>({shopId:"fixture-shop",userId:"fixture-owner",role:"owner"});export const assertOwnerOrManager=()=>{};');
  if (specifier === 'next/server') return stub('export class NextRequest extends Request{};export const after=task=>globalThis.__bookingConsentFlow.after(task);');
  if (specifier === '@/server/bootstrap') return stub('export const getBootstrap=async()=>({});');
  if (specifier === '@/server/owner-mutations') return stub('export const createAppointment=(...args)=>globalThis.__bookingConsentFlow.create(...args);export const createGuardian=async()=>{};export const createPet=async()=>{};export const updateAppointmentDetails=async()=>{};export const updateAppointmentStatus=async()=>{};');
  if (specifier === '@/server/owner-mobile-cors') return stub('export const ownerMobileCorsJson=(request,data,init)=>Response.json(data,init);export const ownerMobileCorsPreflight=()=>new Response(null);');
  if (specifier === '@/server/owner-initial-setup-guard') return stub('export const assertOwnerInitialSetupComplete=async()=>({});');
  if (specifier === '@/server/staff-privacy') return stub('export const scopeBootstrapForStaff=data=>data;export const appointmentBelongsToStaff=()=>true;');
  if (specifier === '@/server/booking-deposit-ledger') return stub('export const flushDepositOutbox=async()=>{};');
  return next(specifier, context);
} });
const { processOwnerBookingConsent, validateOwnerBookingConsentChoice } = await import('../../src/server/owner-booking-consent.ts');
const { POST: schedulePost } = await import('../../src/app/api/owner/schedule/route.ts');
const { POST: appointmentPost } = await import('../../src/app/api/appointments/route.ts');
function reset(documents = []) { reads = 0; queued = []; saved = false; recognize = Promise.resolve(); state = { enabled: true, policyVersion: 3, documents }; afterTasks = []; bookingSaved = false; requests = []; recognitionError = false; failureRecord = null; }

test('saved booking waits for recognition persistence, then returns without waiting on follow-up reads', async () => {
  reset(); let release; recognize = new Promise(resolve => { release = resolve; }); let returned = false;
  const pending = processOwnerBookingConsent(actor, identity, choice, task => queued.push(task)).then(() => { returned = true; });
  await Promise.resolve(); assert.equal(returned, false); assert.equal(saved, false); assert.equal(queued.length, 0); assert.equal(reads, 0);
  release(); await pending; assert.equal(saved, true); assert.equal(returned, true); assert.equal(queued.length, 1); assert.equal(reads, 0);
  await queued[0](); assert.equal(reads, 1); assert.equal(queued.length, 1, 'follow-up never queues itself again');
});

test('default direct consumers keep existing awaited follow-up semantics', async () => {
  reset(); await processOwnerBookingConsent(actor, identity, choice); assert.equal(saved, true); assert.equal(reads, 1); assert.equal(queued.length, 0);
});

test('sending guidance never creates an owner recognition', async () => {
  reset(); await processOwnerBookingConsent(actor, identity, null); assert.equal(saved, false); assert.equal(reads, 1);
});

test('only current pending pet documents can be explicitly recognized by an owner', async () => {
  reset([{ id: 'fixture-document', version: 2, scope: 'pet', status: 'pending' }]);
  assert.deepEqual(await validateOwnerBookingConsentChoice(actor, identity, choice), choice);
  await assert.rejects(validateOwnerBookingConsentChoice({ ...actor, role: 'manager' }, identity, choice), { status: 403 });
  await assert.rejects(validateOwnerBookingConsentChoice(actor, identity, choice, true), { status: 403 });
  await assert.rejects(validateOwnerBookingConsentChoice(actor, identity, { ...choice, policyVersion: 2 }), { status: 409 });
  state.documents[0].scope = 'appointment'; await assert.rejects(validateOwnerBookingConsentChoice(actor, identity, choice), { status: 409 });
  state.documents[0].scope = 'pet'; state.documents[0].status = 'recognized'; await assert.rejects(validateOwnerBookingConsentChoice(actor, identity, choice), { status: 409 });
});

test('missing or send-only choices leave consent unrecognized', async () => {
  reset(); assert.equal(await validateOwnerBookingConsentChoice(actor, identity, undefined), null); assert.equal(await validateOwnerBookingConsentChoice(actor, identity, { ...choice, decision: 'send' }), null); assert.equal(saved, false);
});

for (const [name, post] of [['owner schedule', schedulePost], ['appointments', appointmentPost]]) {
  test(`${name} responds after recognition is saved, before consent follow-up or delivery`, async () => {
    reset([{ id: 'fixture-document', version: 2, scope: 'pet', status: 'pending' }]);
    let release; recognize = new Promise(resolve => { release = resolve; }); let responded = false;
    const request = new Request('http://fixture/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId: actor.shopId, customerMode: 'existing', guardianId: identity.guardianId, petId: identity.petId, appointmentDate: '2030-01-02', appointmentTime: '10:00', serviceId: 'fixture-service', staffId: 'fixture-staff', consentChoice: choice }) });
    const responsePromise = post(request).then(response => { responded = true; return response; });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(bookingSaved, true); assert.equal(saved, false); assert.equal(responded, false); assert.equal(reads, 1, 'validation only');
    release(); const response = await responsePromise; assert.equal(response.status, 200); assert.equal(saved, true); assert.equal(responded, true); assert.equal(reads, 1, 'follow-up cannot delay successful response');
    await Promise.all(afterTasks.map(task => task())); assert.equal(reads, 2); assert.equal(requests.length, 0); assert.equal(state.documents.filter(doc => doc.status === 'pending').length, 0, 'next fresh consent state no longer requires a prompt');
  });
}

test('per-appointment documents remain pending and receive deferred guidance after pet recognition', async () => {
  reset([{ id: 'fixture-document', version: 2, scope: 'pet', status: 'pending' }, { id: 'visit-document', version: 1, scope: 'appointment', status: 'pending' }]);
  await processOwnerBookingConsent(actor, identity, choice, task => queued.push(task)); assert.equal(requests.length, 0);
  await queued[0](); assert.equal(requests.length, 1); assert.equal(requests[0].consent, true); assert.equal(state.documents[1].status, 'pending'); assert.equal(state.documents[0].status, 'recognized');
});

test('recognition failure keeps the saved booking safe and records failure without deferring a false success', async () => {
  reset([{ id: 'fixture-document', version: 2, scope: 'pet', status: 'pending' }]); recognitionError = true;
  await processOwnerBookingConsent(actor, identity, choice, task => queued.push(task));
  assert.equal(saved, false); assert.equal(queued.length, 0); assert.equal(state.documents[0].status, 'pending'); assert.equal(failureRecord.requests.length, 1); assert.equal(failureRecord.requests[0].status, 'failed');
});
