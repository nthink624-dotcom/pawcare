insert into shops (id, name, phone, address, description, business_hours, regular_closed_days, temporary_closed_dates, concurrent_capacity, approval_mode)
values (
  'demo-shop',
  '포근한 발바닥 미용실',
  '02-1234-5678',
  '서울 강남구 논현로 123',
  '소형견 중심의 1인 미용샵 운영을 돕는 예약 관리 앱',
  '{"0":{"open":"10:00","close":"16:00","enabled":false},"1":{"open":"10:00","close":"19:00","enabled":true},"2":{"open":"10:00","close":"19:00","enabled":true},"3":{"open":"10:00","close":"19:00","enabled":true},"4":{"open":"10:00","close":"19:00","enabled":true},"5":{"open":"10:00","close":"19:00","enabled":true},"6":{"open":"10:00","close":"18:00","enabled":true}}'::jsonb,
  '{0}',
  '{2026-03-25}',
  2,
  'manual'
)
on conflict (id) do nothing;

insert into guardians (id, shop_id, name, phone, memo) values
('11111111-1111-1111-1111-111111111111','demo-shop','김민지','010-1234-5678','문 앞 픽업 선호'),
('22222222-2222-2222-2222-222222222222','demo-shop','박서준','010-9876-5432',''),
('33333333-3333-3333-3333-333333333333','demo-shop','이수연','010-5555-1234','오전 시간 선호')
on conflict (id) do nothing;

insert into pets (id, shop_id, guardian_id, name, breed, weight, age, notes, grooming_cycle_weeks, avatar_seed) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','demo-shop','11111111-1111-1111-1111-111111111111','몽이','말티즈',3.5,3,'귀 예민, 짧은 컷 선호',4,'🐶'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','demo-shop','11111111-1111-1111-1111-111111111111','차이','포메라니안',2.7,2,'첫 미용 때 긴장 심함',5,'🐕'),
('cccccccc-cccc-cccc-cccc-cccccccccccc','demo-shop','22222222-2222-2222-2222-222222222222','코코','푸들',5.1,5,'간식 후 진정 잘 됨',3,'🐩'),
('dddddddd-dddd-dddd-dddd-dddddddddddd','demo-shop','33333333-3333-3333-3333-333333333333','보리','시츄',4.2,4,'',4,'🐕‍🦺')
on conflict (id) do nothing;

insert into services (id, shop_id, name, price, duration_minutes, is_active) values
('svc-full','demo-shop','전체 미용',55000,120,true),
('svc-bath','demo-shop','목욕 + 부분정리',38000,80,true),
('svc-bath-only','demo-shop','목욕',25000,45,true),
('svc-care','demo-shop','위생 미용',18000,30,true)
on conflict (id) do nothing;

insert into appointments (id, shop_id, guardian_id, pet_id, service_id, appointment_date, appointment_time, status, memo, start_at, end_at, source) values
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','demo-shop','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','svc-full','2026-03-16','10:00','confirmed','스포팅 5mm','2026-03-16T10:00:00Z','2026-03-16T12:00:00Z','owner'),
('ffffffff-ffff-ffff-ffff-ffffffffffff','demo-shop','22222222-2222-2222-2222-222222222222','cccccccc-cccc-cccc-cccc-cccccccccccc','svc-bath','2026-03-16','14:00','confirmed','','2026-03-16T14:00:00Z','2026-03-16T15:20:00Z','customer'),
('12121212-1212-1212-1212-121212121212','demo-shop','33333333-3333-3333-3333-333333333333','dddddddd-dddd-dddd-dddd-dddddddddddd','svc-full','2026-03-17','11:00','confirmed','짧게','2026-03-17T11:00:00Z','2026-03-17T13:00:00Z','customer'),
('34343434-3434-3434-3434-343434343434','demo-shop','11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','svc-bath-only','2026-03-18','10:30','pending','','2026-03-18T10:30:00Z','2026-03-18T11:15:00Z','customer')
on conflict (id) do nothing;

insert into grooming_records (id, shop_id, guardian_id, pet_id, service_id, appointment_id, style_notes, memo, price_paid, groomed_at) values
('56565656-5656-5656-5656-565656565656','demo-shop','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','svc-full',null,'스포팅 5mm','귀 예민해서 빠르게 진행',55000,'2026-02-15T11:30:00Z'),
('78787878-7878-7878-7878-787878787878','demo-shop','22222222-2222-2222-2222-222222222222','cccccccc-cccc-cccc-cccc-cccccccccccc','svc-full',null,'테디베어 컷','발 패드 정리 필수',55000,'2026-02-22T14:00:00Z'),
('90909090-9090-9090-9090-909090909090','demo-shop','33333333-3333-3333-3333-333333333333','dddddddd-dddd-dddd-dddd-dddddddddddd','svc-full',null,'짧은 얼굴컷','눈물자국 정리',50000,'2026-02-10T12:00:00Z')
on conflict (id) do nothing;

insert into notifications (id, shop_id, appointment_id, pet_id, guardian_id, type, channel, message, status, sent_at) values
('abababab-abab-abab-abab-abababababab','demo-shop','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','booking_confirmed','mock','몽이 예약이 확정되었어요.','mocked','2026-03-16T09:00:00Z'),
('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd','demo-shop',null,'cccccccc-cccc-cccc-cccc-cccccccccccc','22222222-2222-2222-2222-222222222222','revisit_notice','mock','코코 재방문 시기가 다가왔어요.','mocked','2026-03-16T09:00:00Z')
on conflict (id) do nothing;

insert into landing_interests (id, shop_name, owner_name, phone, needs) values
('efefefef-efef-efef-efef-efefefefefef','몽실몽실','홍길동','010-0000-0000','{"예약 통합","재방문 알림"}')
on conflict (id) do nothing;

insert into landing_feedback (id, type, text) values
('01010101-0101-0101-0101-010101010101','feature','네이버 예약 동기화도 나중에 추가되면 좋아요.')
on conflict (id) do nothing;
