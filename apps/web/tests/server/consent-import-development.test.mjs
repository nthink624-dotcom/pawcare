import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { zipSync, strToU8 } from 'fflate';
import { buildCustomerServiceSourceOptions, buildCustomerServiceMenuOptions } from '../../src/lib/customer-service-options.ts';
import { findCustomerBreedPricingGroup } from '../../src/lib/customer-breed-pricing-group.ts';
const require = createRequire(import.meta.url);
const enabled = process.env.PM_CONSENT_DEV_TEST === '1';

function workbook(name, phone, pet) {
  const escape = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const rows = [['보호자명','연락처','반려동물이름','품종','몸무게kg'],[name,phone,pet,'말티즈','4']];
  const strings=rows.flat();
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="s"><v>${i*5+j}</v></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files = {
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="고객" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
    'xl/sharedStrings.xml':`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(s=>`<si><t>${escape(s)}</t></si>`).join('')}</sst>`,
    'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>',
  };
  files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)]))));
}

test('saved development shop policy: import, recognition, identity, owner booking and customer signature', {skip:!enabled,timeout:360000}, async () => {
  require('@next/env').loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  assert.equal(new URL(url).hostname,'qefxdtmdtvnzgupmjlom.supabase.co','development project required');
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME,'development');
  const admin = createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const authClient = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const shopId = 'pm-consent-qa-'+randomUUID().slice(0,8), serviceId = shopId+'-service', staffId=shopId+'-staff';
  const email=shopId+'@example.invalid', password=randomBytes(24).toString('base64url')+'aA1!';
  const origin='http://127.0.0.1:3000';
  let userId, session, shopCreated=false, browserPage, browserConnection, browserContext, storageBefore, cookiesBefore;
  const check = async promise => { const r=await promise; if(r.error)throw new Error(r.error.message); return r.data; };
  const ownerHttp = async(path,method='GET',body,expected=200) => {
    const headers={Authorization:'Bearer '+session.access_token};
    if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
    let r,data;
    for(let attempt=0;attempt<3;attempt++){
      r=await fetch(origin+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
      data=await r.json();
      if(method!=='GET'||r.status!==503||attempt===2)break;
      await new Promise(resolve=>setTimeout(resolve,400));
    }
    assert.equal(r.status,expected,path+' '+(data.message??''));return data;
  };
  const publicHttp = async(path,body,expected=200) => {
    const r=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();assert.equal(r.status,expected,path+' '+(data.message??''));return data;
  };
  const state=(g,p)=>ownerHttp(`/api/owner/customer-consents?shopId=${shopId}&guardianId=${g}&petId=${p}`);
  const waitRequest=async appointmentId=>{
    for(let i=0;i<70;i++){
      const prep=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${appointmentId}`);
      if(prep.data.requests.some(r=>r.purposes.includes('consent')&&r.status!=='sending'))return prep;
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    assert.fail('automatic consent request must settle in existing preparation ledger');
  };
  const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  const consentInput=(name,phone,pet)=>({shopId,guardianName:name,phone,petName:pet,appointmentDate:date});
  let policy, policyVersion, main, serviceOption, bookingBreed='말티즈', bookingWeight=4;
  const addCustomer=async(name,phone,pet)=>{
    const g=await ownerHttp('/api/guardians','POST',{shopId,name,phone,enabled:false});
    const p=await ownerHttp('/api/pets','POST',{shopId,guardianId:g.id,name:pet,breed:'말티즈',weight:4});
    return {g:g.id,p:p.id,name,phone,pet};
  };
  const imported=async(name,phone,pet,decision)=>{
    const buffer=workbook(name,phone,pet);
    const form=mode=>{const f=new FormData();f.set('shopId',shopId);f.set('source','generic');f.set('mode',mode);f.set('file',new Blob([buffer]),'synthetic-customers.xlsx');if(decision)f.set('consentDecision',decision);f.set('consentPolicyVersion',String(policyVersion));return f;};
    const preview=await ownerHttp('/api/owner/data-import','POST',form('preview'));
    const result=await ownerHttp('/api/owner/data-import','POST',form('commit'));
    const gs=await check(admin.from('guardians').select('id,name').eq('shop_id',shopId).eq('name',name));assert.equal(gs.length,1);
    const ps=await check(admin.from('pets').select('id').eq('shop_id',shopId).eq('guardian_id',gs[0].id).eq('name',pet));assert.equal(ps.length,1);
    return {g:gs[0].id,p:ps[0].id,name,phone,pet,preview,result,form};
  };
  const bookingInput=c=>({...consentInput(c.name,c.phone,c.pet),bookingPolicyVersion:policyVersion,bookingPolicyAccepted:true,serviceId,customerServiceOptionId:serviceOption.id,staffId,breed:bookingBreed,weightKg:bookingWeight,appointmentTime:'10:00',consentAcceptances:[]});
  const recognize=async(c,doc=main,pv=policyVersion,expected=200)=>ownerHttp('/api/owner/customer-consents','POST',{shopId,guardianId:c.g,petId:c.p,policyVersion:pv,templateId:doc.id,templateVersion:doc.version,confirmedExistingConsent:true},expected);
  const savePolicy=async next=>{const r=await ownerHttp('/api/owner/booking-policy','PUT',{shopId,version:policyVersion,policy:next});policy=r.policy;policyVersion=r.version;main=policy.templates.find(t=>t.enabled&&!t.archivedAt&&t.scope==='pet');return r;};
  try {
    const source=await check(admin.from('shop_booking_policies').select('policy').eq('shop_id','shop-950db4fa').single());
    assert.equal(source.policy.consentBeforeStart,true,'saved real development consent policy required');
    policy=structuredClone(source.policy);policy.depositMode='off';
    policy.templates=policy.templates.map(t=>({...t,reconsentExisting:true}));policyVersion=1;
    main=policy.templates.find(t=>t.enabled&&!t.archivedAt&&t.scope==='pet');assert(main);
    const created=await check(admin.auth.admin.createUser({email,password,email_confirm:true}));userId=created.user.id;
    await check(admin.from('shops').insert({id:shopId,owner_user_id:userId,name:'동의서 개발 검증',phone:'01000000000',address:'합성 검증 주소',business_hours:Object.fromEntries(Array.from({length:7},(_,i)=>[i,{open:'00:00',close:'23:59',enabled:true}])),regular_closed_days:[],temporary_closed_dates:[],concurrent_capacity:5,approval_mode:'auto',notification_settings:{enabled:false}}));shopCreated=true;
    await check(admin.from('owner_profiles').insert({user_id:userId,shop_id:shopId,login_id:email,name:'합성 검증 오너',birth_date:'19900101',phone_number:'01000000000',agreements:{}}));
    await check(admin.from('owner_shop_memberships').insert({owner_user_id:userId,shop_id:shopId,role:'owner',is_primary:true}));
    await check(admin.from('owner_subscriptions').insert({user_id:userId,shop_id:shopId,current_plan_code:'single_monthly_v1',billing_cycle:'1m',product_version:'2026-09-v1',price_snapshot_amount:29000,price_snapshot_currency:'KRW',trial_started_at:new Date().toISOString(),trial_ends_at:new Date(Date.now()+7*86400000).toISOString(),payment_method_exists:false,subscription_status:'trialing',cancel_at_period_end:false,last_payment_status:'none',portone_customer_id:shopId,featured_plan_code:'single_monthly_v1',auto_renew_plan_code:'single_monthly_v1'}));
    await check(admin.from('staff_members').insert({id:staffId,shop_id:shopId,name:'검증 담당',role:'owner',default_days:['mon','tue','wed','thu','fri','sat','sun'],start_time:'00:00',end_time:'23:59',is_active:true}));
    const sourceServices=await check(admin.from('services').select('*').eq('shop_id','shop-950db4fa').eq('is_active',true));
    const sourceService=sourceServices.find(s=>buildCustomerServiceSourceOptions([s]).length>0);assert(sourceService,'saved real bookable price guide required');
    await check(admin.from('services').insert({id:serviceId,shop_id:shopId,name:'미용 검증',price:sourceService.price,duration_minutes:sourceService.duration_minutes,price_guide:sourceService.price_guide,is_active:true,price_type:sourceService.price_type,staff_selection_mode:'all'}));
    await check(admin.from('shop_booking_policies').insert({shop_id:shopId,policy,version:policyVersion}));
    session=(await check(authClient.auth.signInWithPassword({email,password}))).session;
    const bootstrap=await ownerHttp(`/api/bootstrap?shopId=${shopId}`);
    assert.equal(bootstrap.shop.id,shopId);
    const savedServices=await check(admin.from('services').select('*').eq('shop_id',shopId));
    for(const breed of ['말티즈','푸들','비숑','검증견종']) {
      const pricingGroup=findCustomerBreedPricingGroup(savedServices,breed);
      for(let weight=0.5;weight<=50;weight+=0.5) {
        const options=buildCustomerServiceMenuOptions(buildCustomerServiceSourceOptions(savedServices,{priceGuideGroupKey:pricingGroup?.key,weightKg:weight}));
        if(options.length){serviceOption=options[0];bookingBreed=breed;bookingWeight=weight;break;}
      }
      if(serviceOption)break;
    }
    assert(serviceOption,'saved shop guide must contain a bookable breed/weight');

    const a=await imported('가져오기 요청고객','01000000001','요청강아지','request');
    assert.equal(a.preview.consentPolicy.enabled,true);assert.equal((await state(a.g,a.p)).documents[0].status,'pending');
    assert((await publicHttp('/api/customer-booking-consent',consentInput(a.name,a.phone,a.pet))).documents.length>0);
    await publicHttp('/api/customer-bookings',bookingInput(a),409);
    console.log('PASS 1 XLSX import request requires signature before online booking');

    const b=await imported('가져오기 인정고객','01000000002','인정강아지','consider_received');
    const bs=await state(b.g,b.p);assert.equal(bs.documents[0].status,'recognized');assert.equal(bs.documents[0].recognizedBy,userId);assert(!bs.documents[0].signature);
    assert.equal((await publicHttp('/api/customer-booking-consent',consentInput(b.name,b.phone,b.pet))).documents.length,0);
    const booking=await publicHttp('/api/customer-bookings',bookingInput(b));assert(booking.appointment?.id,'recognition must allow persisted reservation');
    assert.equal((await ownerHttp('/api/owner/data-import','POST',b.form('commit'))).alreadyImported,true);
    console.log('PASS 2 recognized current version permits real rebooking even with reconsentExisting=true; duplicate file remains idempotent');

    const c=await addCustomer('직접 등록 단골','01000000003','단골강아지');
    assert.equal((await state(c.g,c.p)).documents[0].status,'pending');await recognize(c);
    assert.equal((await state(c.g,c.p)).documents[0].status,'recognized');
    console.log('PASS 3 owner adds customer and explicitly recognizes existing document with actor/time');

    const d=await addCustomer('미용기록 단골','01000000004','이력강아지');
    const recordId=randomUUID();await check(admin.from('grooming_records').insert({id:recordId,shop_id:shopId,guardian_id:d.g,pet_id:d.p,service_id:serviceId,appointment_id:null,groomed_at:new Date().toISOString(),style_notes:'보존할 합성 과거 이력',price_paid:20000}));
    assert((await publicHttp('/api/customer-booking-consent',consentInput(d.name,d.phone,d.pet))).documents.length>0);
    await publicHttp('/api/customer-bookings',bookingInput(d),409);
    assert(await check(admin.from('grooming_records').select('id').eq('id',recordId).single()));
    console.log('PASS 4 past grooming history never waives consent; past record preserved');

    const ownerBooking=await ownerHttp('/api/appointments','POST',{shopId,guardianId:d.g,petId:d.p,serviceId,staffId,appointmentDate:date,appointmentTime:'16:00',source:'owner',memo:'합성 검증 예약'});
    let prep=await waitRequest(ownerBooking.id);
    assert(prep.consentStatus.pendingCount>0);assert(prep.manageUrl.includes('#t='));
    const token=new URL(prep.manageUrl,origin).hash.slice(3), document=prep.data.consents.find(t=>t.status==='pending');assert(document);
    const sign=await fetch(origin+'/api/customer-booking-preparation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shopId,appointmentId:ownerBooking.id,accessToken:decodeURIComponent(token),version:prep.version,action:'sign',templateId:document.id,templateVersion:document.version,signerName:'합성 검증 고객',agreed:true,signature:[[{x:0.1,y:0.2},{x:0.8,y:0.7}]]})});
    assert.equal(sign.status,200,'existing customer signing endpoint');
    prep=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${ownerBooking.id}`);
    assert.equal(prep.consentStatus.pendingCount,0);assert(prep.consentStatus.signedCount>0);assert.equal(prep.data.consents[0].status,'signed');assert(prep.data.consents[0].signature);
    console.log('PASS 5 owner reservation persists pending; existing manage link/signature flow changes it only after customer signs');

    const collision=await imported('같은 번호 다른 보호자',b.phone,b.pet,'request');assert.notEqual(collision.g,b.g);
    assert.equal((await state(collision.g,collision.p)).documents[0].status,'pending');assert.equal((await state(b.g,b.p)).documents[0].status,'recognized');
    console.log('PASS identity collision: same phone/pet with different guardian never inherits recognition');

    let nextOwnerDay=9;
    const nextOwnerInput=()=>({shopId,serviceId,staffId,appointmentDate:new Date(Date.now()+nextOwnerDay++*86400000).toISOString().slice(0,10),appointmentTime:'10:00'});
    const reserveExisting=(customer,consentChoice)=>ownerHttp('/api/owner/schedule','POST',{...nextOwnerInput(),customerMode:'existing',guardianId:customer.g,petId:customer.p,consentChoice});
    await check(admin.from('shops').update({notification_settings:{enabled:true,booking_consent_request:true}}).eq('id',shopId));
    const automatic=await ownerHttp('/api/owner/schedule','POST',{...nextOwnerInput(),customerMode:'new',customerName:'신규 자동 요청',customerPhone:'01000000008',petName:'자동강아지'});
    const automaticPrep=await waitRequest(automatic.appointment.id);
    assert.equal(automaticPrep.appointmentStatus,'confirmed');assert(automaticPrep.consentStatus.pendingCount>0);
    const automaticNotifications=await check(admin.from('notifications').select('type,status,provider').eq('shop_id',shopId).eq('appointment_id',automatic.appointment.id).eq('type','booking_consent_request'));
    assert.equal(automaticNotifications.length,1);assert.equal(automaticNotifications[0].provider,'development_mock');assert.equal(automaticNotifications[0].status,'mocked');
    const duplicateBody={shopId,appointmentId:automatic.appointment.id,version:automaticPrep.version,action:'request_guidance',consent:true,deposit:false};
    await ownerHttp('/api/owner/booking-preparation','POST',duplicateBody,409);
    assert.equal((await check(admin.from('notifications').select('id').eq('appointment_id',automatic.appointment.id).eq('type','booking_consent_request'))).length,1);
    console.log('PASS AUTO 1 new owner customer/booking invokes existing dispatch once; no fabricated signature or actual send');

    const valid=await reserveExisting(b);await new Promise(resolve=>setTimeout(resolve,450));
    const validPrep=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${valid.appointment.id}`);
    assert.equal(validPrep.consentStatus.pendingCount,0);assert.equal(validPrep.data.requests.filter(r=>r.purposes.includes('consent')).length,0);
    assert.equal((await check(admin.from('notifications').select('id').eq('appointment_id',valid.appointment.id).eq('type','booking_consent_request'))).length,0);
    console.log('PASS AUTO 2 existing valid consent requires no choice or repeated request');

    const send=await reserveExisting(a,{decision:'send',policyVersion,documents:[]});
    assert((await waitRequest(send.appointment.id)).consentStatus.pendingCount>0);
    const recognizeCustomer=await addCustomer('예약 중 기존동의 인정','01000000009','예약인정강아지');
    const recognizeBooking=await reserveExisting(recognizeCustomer,{decision:'recognize',policyVersion,documents:[{id:main.id,version:main.version}]});
    let recognizedState;for(let i=0;i<50;i++){recognizedState=await state(recognizeCustomer.g,recognizeCustomer.p);if(recognizedState.documents[0].status==='recognized')break;await new Promise(resolve=>setTimeout(resolve,150));}
    assert.equal(recognizedState.documents[0].status,'recognized');assert.equal(recognizedState.documents[0].recognizedBy,userId);assert(recognizedState.documents[0].recognizedAt);assert(!recognizedState.documents[0].signature);
    assert.equal((await check(admin.from('notifications').select('id').eq('appointment_id',recognizeBooking.appointment.id).eq('type','booking_consent_request'))).length,0);
    const otherPet=await ownerHttp('/api/pets','POST',{shopId,guardianId:recognizeCustomer.g,name:'동의없는 둘째',breed:'말티즈',weight:4});
    const other=await reserveExisting({...recognizeCustomer,p:otherPet.id});assert((await waitRequest(other.appointment.id)).consentStatus.pendingCount>0);
    console.log('PASS AUTO 3/4/5 missing existing consent requests by default; explicit recognition audits actor/time; another pet cannot inherit it');

    await check(admin.from('shops').update({notification_settings:{enabled:false}}).eq('id',shopId));
    const blocked=await reserveExisting(a);const blockedPrep=await waitRequest(blocked.appointment.id);
    assert.equal(blockedPrep.appointmentStatus,'confirmed');assert.equal(blockedPrep.data.requests.find(r=>r.purposes.includes('consent')).status,'blocked');assert(blockedPrep.consentStatus.pendingCount>0);
    await check(admin.from('shops').update({notification_settings:{enabled:true}}).eq('id',shopId));
    await check(admin.from('guardians').update({notification_settings:{enabled:false}}).eq('id',a.g));
    const optOut=await reserveExisting(a);assert.equal((await waitRequest(optOut.appointment.id)).data.requests.find(r=>r.purposes.includes('consent')).status,'blocked');
    await check(admin.from('guardians').update({notification_settings:{enabled:true},phone:''}).eq('id',a.g));
    const failed=await reserveExisting(a);const failedPrep=await waitRequest(failed.appointment.id);
    assert.equal(failedPrep.data.requests.find(r=>r.purposes.includes('consent')).status,'failed');assert.equal(failedPrep.appointmentStatus,'confirmed');assert(failedPrep.consentStatus.pendingCount>0);
    await check(admin.from('guardians').update({phone:a.phone}).eq('id',a.g));
    console.log('PASS AUTO 7 shop OFF, customer opt-out, failed request preserve reservation and pending signature');

    await savePolicy({...policy,depositMode:'required',depositAudience:'all',depositBase:'all',bankName:'검증 은행',bankAccount:'000000000000',bankHolder:'합성 검증 오너'});
    const depositBooking=await reserveExisting(a);const beforeSign=await waitRequest(depositBooking.appointment.id);
    assert.equal(beforeSign.appointmentStatus,'pending');assert.equal(beforeSign.data.deposit.receivedAmount,0);
    const pendingDoc=beforeSign.data.consents.find(doc=>doc.status==='pending');assert(pendingDoc);
    const depositToken=decodeURIComponent(new URL(beforeSign.manageUrl,origin).hash.slice(3));
    const signedDeposit=await fetch(origin+'/api/customer-booking-preparation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shopId,appointmentId:depositBooking.appointment.id,accessToken:depositToken,version:beforeSign.version,action:'sign',templateId:pendingDoc.id,templateVersion:pendingDoc.version,signerName:'합성 검증 고객',agreed:true,signature:[[{x:0.1,y:0.2},{x:0.8,y:0.7}]]})});
    assert.equal(signedDeposit.status,200);
    const afterSign=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${depositBooking.appointment.id}`);
    assert.equal(afterSign.appointmentStatus,'pending');assert.equal(afterSign.data.deposit.receivedAmount,0);assert.equal(afterSign.consentStatus.pendingCount,0);
    await savePolicy({...policy,depositMode:'off'});
    console.log('PASS owner required-deposit reservation stays pending with zero received amount after actual customer signature');

    await savePolicy({...policy,consentBeforeStart:false});
    const disabled=await reserveExisting(a);await new Promise(resolve=>setTimeout(resolve,400));
    assert.equal((await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${disabled.appointment.id}`)).data.requests.filter(r=>r.purposes.includes('consent')).length,0);
    await savePolicy({...policy,consentBeforeStart:true});
    console.log('PASS AUTO 6 consent feature OFF creates no consent request');

    const oldVersion=policyVersion, oldMain=structuredClone(main);
    await savePolicy({...policy,templates:policy.templates.map(t=>t.id===main.id?{...t,body:t.body+'\n개발 검증용 새 버전',reconsentExisting:true}:t)});
    assert.equal((await state(b.g,b.p)).documents[0].status,'pending');await recognize(b,oldMain,oldVersion,409);
    const signedHistory=await check(admin.from('booking_preparations').select('data').eq('appointment_id',ownerBooking.id).single());
    assert(signedHistory.data.consents.some(t=>t.status==='signed'&&t.signature&&t.version===document.version),'signed original must survive policy updates');
    const perBooking={...main,id:randomUUID(),version:1,title:'예약별 검증 동의',scope:'appointment',reconsentExisting:false};
    await savePolicy({...policy,templates:[...policy.templates,perBooking]});
    await recognize(b,perBooking,policyVersion,409);
    const second=await imported('예약별 문서 인정검증','01000000005','예약별강아지','consider_received');
    const secondState=await state(second.g,second.p);assert.equal(secondState.documents.find(t=>t.id===main.id).status,'recognized');assert.equal(secondState.documents.find(t=>t.id===perBooking.id).status,'pending');
    console.log('PASS new versions/stale policy and per-booking forms cannot be silently waived');

    const unrelated={...main,id:randomUUID(),version:1,title:'별도 내용 검증 문서',reconsentExisting:false};
    const replacement={...main,id:randomUUID(),version:1,title:'연결된 새 미용 동의서',previousTemplateId:main.id,reconsentExisting:false};
    await savePolicy({...policy,templates:[...policy.templates.map(t=>t.id===main.id?{...t,enabled:false}:t),unrelated,replacement]});
    const inherited=await state(b.g,b.p);assert.equal(inherited.documents.find(t=>t.id===replacement.id).status,'recognized');assert.equal(inherited.documents.find(t=>t.id===unrelated.id).status,'pending');
    await ownerHttp(`/api/owner/customer-consents?shopId=shop-950db4fa&guardianId=${c.g}&petId=${c.p}`,'GET',undefined,403);
    const anonymous=await fetch(origin+`/api/owner/customer-consents?shopId=${shopId}&guardianId=${c.g}&petId=${c.p}`);assert.equal(anonymous.status,401);
    console.log('PASS explicit replacement chain only; unrelated documents and unauthorized reads remain blocked');

    await savePolicy({...policy,consentBeforeStart:false});
    const off=await imported('동의서 기능끔','01000000006','끄기강아지',undefined);assert.equal(off.preview.consentPolicy.enabled,false);
    await savePolicy({...policy,consentBeforeStart:true});assert((await state(off.g,off.p)).documents.some(t=>t.status==='pending'));
    const notifications=await check(admin.from('notifications').select('type,status,provider,channel').eq('shop_id',shopId));
    assert(!notifications.some(n=>n.status==='sent'&&n.channel!=='in_app'));
    console.log('PASS disabled-feature import, subsequent enablement and zero actual message sends');

    if(process.env.PM_CONSENT_UI_TEST==='1') {
      const {chromium}=require('playwright');
      browserConnection=await chromium.connectOverCDP('http://127.0.0.1:5171');browserContext=browserConnection.contexts()[0];
      assert(!browserContext.pages().some(p=>p.url().startsWith(origin)),'do not interfere with an existing local owner tab');
      cookiesBefore=await browserContext.cookies(origin);
      browserPage=await browserContext.newPage();await browserPage.goto(origin,{waitUntil:'domcontentloaded'});
      storageBefore=await browserPage.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
      await browserPage.addInitScript(({origin,shopId,session})=>{if(location.origin!==origin)return;sessionStorage.setItem('petmanager.ownerAuthHandoff',JSON.stringify({accessToken:session.access_token,refreshToken:session.refresh_token,expiresAt:session.expires_at}));localStorage.setItem('petmanager:owner-current-shop',shopId);},{origin,shopId,session});
      await browserPage.goto(origin+'/owner?screen=customers',{waitUntil:'domcontentloaded'});
      await browserPage.locator('[data-customer-management]').waitFor({timeout:40000});
      await browserPage.getByText(d.name,{exact:true}).first().click();
      const detail=browserPage.locator('[data-customer-detail]'), card=detail.locator('[aria-label="고객 동의서"]');
      await card.waitFor({timeout:20000});assert((await card.innerText()).includes('동의서 미완료'));
      for(const summary of await card.locator('summary').all())await summary.click();
      const pendingBefore=(await state(d.g,d.p)).documents.filter(t=>t.scope==='pet'&&t.status==='pending').length;
      // CDP may already have another observer that dismisses native dialogs. Accept
      // only this test tab's owner confirmation, then verify the actual API write.
      await browserPage.evaluate(()=>{window.confirm=()=>true;});await card.getByRole('button',{name:'기존 동의 인정',exact:true}).first().click();
      for(let i=0;i<30;i++){if((await state(d.g,d.p)).documents.filter(t=>t.scope==='pet'&&t.status==='pending').length<pendingBefore)break;await browserPage.waitForTimeout(200);}
      assert((await state(d.g,d.p)).documents.filter(t=>t.scope==='pet'&&t.status==='pending').length<pendingBefore,'UI confirmation must persist actual owner recognition');
      const evidence=path.resolve('../../.codex-work/consent-repair-20261021');fs.mkdirSync(evidence,{recursive:true});
      for(const width of [1440,1024,390]){await browserPage.setViewportSize({width,height:950});await browserPage.screenshot({path:path.join(evidence,`customer-${width}.png`)});assert(await detail.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1),'customer dialog fits viewport');}
      await detail.getByRole('button',{name:'닫기',exact:true}).click();
      await browserPage.setViewportSize({width:1440,height:950});
      await browserPage.getByRole('button',{name:'티피에서 이전',exact:true}).click();
      await browserPage.locator('input[type=file]').setInputFiles({name:'synthetic-ui.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook('화면 검증 고객','01000000007','화면강아지')});
      await browserPage.getByRole('button',{name:'이전 결과 미리보기',exact:true}).click();
      const final=browserPage.getByRole('button',{name:'이 결과대로 이전',exact:true});await final.waitFor();await browserPage.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='이 결과대로 이전'&&!b.disabled));await final.click();
      const dialog=browserPage.getByRole('dialog',{name:'이관 고객의 동의서를 어떻게 할까요?'});await dialog.waitFor();
      assert(await dialog.getByRole('radio',{name:/다음 예약할 때 동의서 받기/}).isChecked());assert((await dialog.innerText()).includes('기존에 받은 동의서 인정하기'));
      for(const width of [1440,1024,390]){await browserPage.setViewportSize({width,height:950});await browserPage.screenshot({path:path.join(evidence,`import-${width}.png`)});const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=950,'import confirmation fits viewport');}
      console.log('PASS actual owner UI: customer recognition and import choice at 1440/1024/390; screenshots in .codex-work/consent-repair-20261021');
      const latest=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${ownerBooking.id}`);
      await browserPage.setViewportSize({width:390,height:950});await browserPage.goto(new URL(latest.manageUrl,origin).href,{waitUntil:'domcontentloaded'});
      const startSign=browserPage.getByRole('button',{name:'동의서 작성',exact:true}).first();
      // Pending documents are collapsed in the existing customer management panel.
      await browserPage.waitForFunction(()=>document.body.innerText.includes('예약'));
      const summaries=browserPage.locator('details summary').filter({hasText:'확인 대기'});
      await summaries.first().waitFor({timeout:25000});await summaries.first().click();await startSign.click();
      await browserPage.getByLabel('서명자 이름',{exact:true}).fill('합성 고객 화면 검증');
      await browserPage.getByRole('checkbox',{name:'위 내용을 읽고 동의합니다.'}).check();
      const pad=browserPage.getByRole('img',{name:'직접 서명하는 창'});await pad.scrollIntoViewIfNeeded();const box=await pad.boundingBox();
      await browserPage.mouse.move(box.x+20,box.y+35);await browserPage.mouse.down();await browserPage.mouse.move(box.x+box.width-20,box.y+110,{steps:12});await browserPage.mouse.up();
      await browserPage.getByRole('button',{name:'서명 완료 및 제출',exact:true}).click();
      await browserPage.waitForFunction(()=>!document.querySelector('[aria-label="직접 서명하는 창"]'),null,{timeout:20000});
      const signedPreparation=await ownerHttp(`/api/owner/booking-preparation?shopId=${shopId}&appointmentId=${ownerBooking.id}`);
      assert.equal(signedPreparation.consentStatus.pendingCount,0,'customer UI signature must complete this booking, without waiving per-booking forms for future bookings');
      assert(signedPreparation.data.consents.some(t=>t.id===perBooking.id&&t.status==='signed'&&t.signature));
      assert.equal((await state(d.g,d.p)).documents.find(t=>t.id===perBooking.id).status,'pending','a future booking must still require its own signature');
      await browserPage.screenshot({path:path.join(evidence,'customer-manage-signed-390.png')});console.log('PASS actual customer manage-link UI and pointer signature');
    }
  } finally {
    if(browserPage){if(storageBefore)await browserPage.evaluate(before=>{for(const key of Object.keys(localStorage))if(!(key in before))localStorage.removeItem(key);for(const [key,value]of Object.entries(before))localStorage.setItem(key,value);sessionStorage.clear();},storageBefore);await browserPage.close();}
    if(browserContext&&cookiesBefore){await browserContext.clearCookies({domain:'127.0.0.1',name:/^(sb-|petmanager)/});if(cookiesBefore.length)await browserContext.addCookies(cookiesBefore);}
    if(browserConnection)await browserConnection.close();
    if(shopCreated){assert(shopId.startsWith('pm-consent-qa-'));await check(admin.from('shops').delete().eq('id',shopId).eq('owner_user_id',userId));assert.equal((await check(admin.from('shops').select('id').eq('id',shopId))).length,0);}
    if(userId)await check(admin.auth.admin.deleteUser(userId));
    console.log('CLEANUP synthetic development shop/account removed');
  }
});
