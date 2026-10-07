begin;
do $verify$
declare
 s text := 'pm-preparation-check-' || gen_random_uuid()::text;
 g uuid := gen_random_uuid(); p uuid := gen_random_uuid(); a uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
 st text := gen_random_uuid()::text; sv text := gen_random_uuid()::text;
 d date := current_date+7; t timestamptz; docid uuid := gen_random_uuid(); data jsonb; signed jsonb; v integer; failed boolean;
begin
 t := (d + time '10:00') at time zone 'Asia/Seoul';
 insert into public.shops(id,name,phone,address,business_hours)
 values(s,'예약준비 검증 전용','000-0000-0000','검증 전용',
 (select jsonb_object_agg(i::text,'{"enabled":true,"open":"09:00","close":"20:00"}'::jsonb) from generate_series(0,6)i));
 insert into public.guardians(id,shop_id,name,phone) values(g,s,'검증 보호자','000-0000-0000');
 insert into public.pets(id,shop_id,guardian_id,name,breed) values(p,s,g,'검증 반려동물','검증');
 insert into public.staff_members(id,shop_id,name,start_time,end_time,default_days) values(st,s,'검증 담당',time '09:00',time '20:00',array['sun','mon','tue','wed','thu','fri','sat']);
 insert into public.services(id,shop_id,name,price,duration_minutes) values(sv,s,'검증 미용',50000,60);
 insert into public.shop_booking_policies(shop_id,policy) values(s,jsonb_build_object(
 'depositMode','required','depositAudience','all','depositAmount',20000,'depositDueHours',24,'bankName','검증 은행','bankAccount','TEST-NOT-A-REAL-ACCOUNT','bankHolder','검증',
 'firstNoshowRule','approval','repeatNoshowRule','blocked','consentBeforeStart',true,'cancellationCutoffHours',2,
 'templates',jsonb_build_array(jsonb_build_object('id',docid,'version',1,'title','검증 동의서','body','서명 보존 확인용 문구','required',true,'scope','pet','enabled',true,'audience','all'))));
 insert into public.appointments(id,shop_id,guardian_id,pet_id,service_id,staff_id,appointment_date,appointment_time,status,start_at,end_at,source,discount_snapshot)
 values(a,s,g,p,sv,st,d,time '10:00','confirmed',t,t+interval '1 hour','customer','{"bookingPolicyVersion":1}');
 if (select status from public.appointments where id=a)<>'pending' then raise exception 'FAIL deposit must hold booking pending'; end if;
 select b.data,b.version into data,v from public.booking_preparations b where appointment_id=a;
 if data#>>'{deposit,status}'<>'pending' or jsonb_array_length(data->'consents')<>1 then raise exception 'FAIL policy snapshot'; end if;
 failed:=false;
 begin
  insert into public.appointments(shop_id,guardian_id,pet_id,service_id,staff_id,appointment_date,appointment_time,status,start_at,end_at)
  values(s,g,p,sv,st,d,time '10:30','pending',t+interval '30 minutes',t+interval '90 minutes');
 exception when exclusion_violation then failed:=true;
 end;
 if not failed then raise exception 'FAIL pending overlap accepted'; end if;
 failed:=false;
 begin update public.appointments set status='confirmed' where id=a;
 exception when others then if SQLERRM='BOOKING_DEPOSIT_REQUIRED' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL unpaid booking confirmation'; end if;
 data:=jsonb_set(jsonb_set(data,'{deposit,status}','"reported"'),'{deposit,payerName}','"검증 입금자"');
 v:=public.save_booking_preparation(s,a,v,data);
 if (select status from public.appointments where id=a)<>'pending' then raise exception 'FAIL report is not receipt'; end if;
 data:=jsonb_set(jsonb_set(data,'{deposit,status}','"confirmed"'),'{deposit,receivedAmount}','20000');
 v:=public.save_booking_preparation(s,a,v,data,'confirmed');
 if (select status from public.appointments where id=a)<>'confirmed' then raise exception 'FAIL receipt confirmation'; end if;
 failed:=false;
 begin update public.appointments set status='in_progress' where id=a;
 exception when others then if SQLERRM='BOOKING_CONSENT_REQUIRED' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL unsigned required consent'; end if;
 signed:=(data->'consents'->0)||jsonb_build_object('status','signed','signerName','검증 보호자','signedAt',now(),'signature',jsonb_build_array(jsonb_build_array(jsonb_build_object('x',0.1,'y',0.2),jsonb_build_object('x',0.8,'y',0.4))));
 data:=jsonb_set(data,'{consents}',jsonb_build_array(signed));
 v:=public.save_booking_preparation(s,a,v,data);
 failed:=false;
 begin perform public.save_booking_preparation(s,a,v,jsonb_set(data,'{consents}','[]'));
 exception when others then if SQLERRM='BOOKING_SIGNED_DOCUMENT_IMMUTABLE' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL signed document mutability'; end if;
 failed:=false;
 begin perform public.save_booking_preparation(s,a,v-1,data);
 exception when others then if SQLERRM='BOOKING_VERSION_CONFLICT' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL optimistic concurrency'; end if;
 insert into public.appointments(id,shop_id,guardian_id,pet_id,service_id,staff_id,appointment_date,appointment_time,status,start_at,end_at,source,discount_snapshot)
 values(a2,s,g,p,sv,st,d,time '11:00','confirmed',t+interval '1 hour',t+interval '2 hours','customer','{"bookingPolicyVersion":1}');
 if (select b.data->'consents'->0 from public.booking_preparations b where appointment_id=a2) is distinct from signed then raise exception 'FAIL signed consent reuse'; end if;
 update public.appointments set status='in_progress' where id=a;
 if (select status from public.appointments where id=a)<>'in_progress' then raise exception 'FAIL signed booking start'; end if;
 failed:=false;
 begin update public.appointments set status='noshow' where id=a2;
 exception when others then if SQLERRM='BOOKING_NOSHOW_NOT_STARTED' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL future noshow accepted'; end if;
 select b.data,b.version into data,v from public.booking_preparations b where appointment_id=a2;
 data:=jsonb_set(jsonb_set(data,'{deposit,status}','"waived"'),'{history}','[{"action":"set_condition","note":"검증 차단"}]');
 v:=public.save_booking_preparation(s,a2,v,data,'confirmed','blocked','{"consent":false,"deposit":false}');
 if (select notification_settings->>'deposit_request_enabled' from public.guardians where id=g)<>'false' then raise exception 'FAIL preference persistence'; end if;
 failed:=false;
 begin
 insert into public.appointments(shop_id,guardian_id,pet_id,service_id,staff_id,appointment_date,appointment_time,status,start_at,end_at,source,discount_snapshot)
 values(s,g,p,sv,st,d,time '12:00','confirmed',t+interval '2 hours',t+interval '3 hours','customer','{"bookingPolicyVersion":1}');
 exception when others then if SQLERRM='BOOKING_ONLINE_RESTRICTED' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'FAIL blocked guardian accepted'; end if;
 data:=jsonb_set(data,'{cancellation}','{"kind":"customer","reason":"검증 취소","at":"2026-10-06T00:00:00Z"}');
 perform public.save_booking_preparation(s,a2,v,data,'cancelled');
 if (select status from public.appointments where id=a2)<>'cancelled' then raise exception 'FAIL cancellation'; end if;
end $verify$;
set local role anon;
do $acl$ declare denied boolean:=false; begin
 begin perform 1 from public.booking_preparations limit 1; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL anon read allowed'; end if;
end $acl$;
reset role;
set local role authenticated;
do $acl$ declare denied boolean:=false; begin
 begin perform public.save_booking_preparation('test',gen_random_uuid(),1,'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL authenticated RPC allowed'; end if;
end $acl$;
reset role;
rollback;
select 'passed: pending overlap, receipt confirmation, required consent, immutable signature, version conflict, reuse, future noshow, guardian restriction, preferences, cancellation, anon/authenticated denial; all fixtures rolled back' as verification;
