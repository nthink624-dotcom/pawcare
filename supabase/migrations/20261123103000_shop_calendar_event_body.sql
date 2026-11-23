-- Notes get a body apart from their title. Existing rows keep their text in the title with an empty body.
alter table public.shop_calendar_events
  add column body text not null default ''
  constraint shop_calendar_events_body_length check (char_length(body) <= 1000);
