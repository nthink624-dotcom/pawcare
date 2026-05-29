alter table public.shops
  alter column customer_page_settings set default '{}'::jsonb;

update public.shops
set customer_page_settings =
  coalesce(customer_page_settings, '{}'::jsonb)
  || jsonb_build_object(
    'shop_name',
    coalesce(nullif(customer_page_settings->>'shop_name', ''), name, ''),
    'tagline',
    coalesce(
      nullif(customer_page_settings->>'tagline', ''),
      nullif(description, ''),
      '우리 아이에게 맞는 미용 시간을 편하게 예약해 주세요.'
    ),
    'hero_image_url',
    coalesce(customer_page_settings->>'hero_image_url', ''),
    'primary_color',
    coalesce(nullif(customer_page_settings->>'primary_color', ''), '#1F6B5B'),
    'notices',
    coalesce(
      customer_page_settings->'notices',
      jsonb_build_array(
        '첫 방문은 상담 포함으로 여유 있게 예약해 주세요.',
        '대기 시간이 길어질 수 있어 예약 시간 10분 전에 도착해 주세요.',
        '피부 예민한 아이는 메모에 꼭 남겨 주세요.'
      )
    ),
    'operating_hours_note',
    coalesce(nullif(customer_page_settings->>'operating_hours_note', ''), '월-토 10:00 - 19:00, 일요일 휴무'),
    'holiday_notice',
    coalesce(nullif(customer_page_settings->>'holiday_notice', ''), '매주 일요일 휴무, 임시 휴무는 공지사항으로 안내드려요.'),
    'parking_notice',
    coalesce(customer_page_settings->>'parking_notice', '건물 뒤편 공용 주차장을 이용해 주세요.'),
    'kakao_inquiry_url',
    coalesce(customer_page_settings->>'kakao_inquiry_url', ''),
    'show_notices',
    case
      when customer_page_settings->>'show_notices' in ('true', 'false') then (customer_page_settings->>'show_notices')::boolean
      else true
    end,
    'show_parking_notice',
    case
      when customer_page_settings->>'show_parking_notice' in ('true', 'false') then (customer_page_settings->>'show_parking_notice')::boolean
      else true
    end,
    'show_services',
    case
      when customer_page_settings->>'show_services' in ('true', 'false') then (customer_page_settings->>'show_services')::boolean
      else true
    end,
    'booking_button_label',
    coalesce(nullif(customer_page_settings->>'booking_button_label', ''), '예약하기'),
    'show_kakao_inquiry',
    case
      when customer_page_settings->>'show_kakao_inquiry' in ('true', 'false') then (customer_page_settings->>'show_kakao_inquiry')::boolean
      else true
    end,
    'font_preset',
    coalesce(nullif(customer_page_settings->>'font_preset', ''), 'soft'),
    'font_scale',
    coalesce(nullif(customer_page_settings->>'font_scale', ''), 'comfortable'),
    'business_category',
    coalesce(nullif(customer_page_settings->>'business_category', ''), '애견미용'),
    'additional_contact',
    coalesce(customer_page_settings->>'additional_contact', ''),
    'postal_code',
    coalesce(customer_page_settings->>'postal_code', ''),
    'address_detail',
    coalesce(customer_page_settings->>'address_detail', '')
  )
where customer_page_settings is null
   or customer_page_settings = '{}'::jsonb
   or nullif(customer_page_settings->>'shop_name', '') is null
   or nullif(customer_page_settings->>'tagline', '') is null;

update public.shops
set customer_page_settings =
  jsonb_set(
    coalesce(customer_page_settings, '{}'::jsonb),
    '{shop_name}',
    to_jsonb(coalesce(name, '')),
    true
  )
where customer_page_settings->>'shop_name' = '포근한 발바닥 미용실'
  and coalesce(name, '') <> '포근한 발바닥 미용실';
