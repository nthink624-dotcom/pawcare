-- Operator-authored resources, shared by owner web/mobile community panels.
begin;
create table public.community_resources (
  id uuid primary key,
  title text not null check(char_length(btrim(title)) between 1 and 100),
  body text not null check(char_length(btrim(body)) between 1 and 5000),
  source_url text not null default '' check(source_url='' or (char_length(source_url)<=2000 and source_url ~ '^https?://')),
  closes_on date,
  published boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index community_resources_feed on public.community_resources(created_at desc,id desc) where published;
alter table public.community_resources enable row level security;
revoke all on public.community_resources from public,anon,authenticated;
grant select,insert,update,delete on public.community_resources to service_role;

create function public.community_resource_json(r public.community_resources) returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('id',r.id,'title',r.title,'body',r.body,'sourceUrl',r.source_url,
  'closesOn',r.closes_on,'closed',coalesce(r.closes_on<(now() at time zone 'Asia/Seoul')::date,false),
  'published',r.published,'createdAt',r.created_at,'updatedAt',r.updated_at);
$$;
create function public.community_resource_list(p_user uuid,p_shop text,p_page integer default 0) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare items jsonb; page integer:=greatest(0,least(10000,coalesce(p_page,0))); more boolean;
begin
 if p_user is null or not public.community_member(p_user,p_shop) then raise exception 'COMMUNITY_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(public.community_resource_json(r) order by r.created_at desc,r.id desc),'[]') into items
 from (select * from public.community_resources where published order by created_at desc,id desc limit 21 offset page*20) r;
 more:=jsonb_array_length(items)>20; if more then items:=items-20; end if;
 return jsonb_build_object('resources',items,'page',page,'hasMore',more);
end $$;
create function public.community_resource_admin(p_admin text,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.community_resources; id_value uuid; items jsonb; more boolean;
 page integer:=greatest(0,least(10000,coalesce((p_payload->>'page')::integer,0)));
begin
 if p_admin is null or not exists(select 1 from public.admin_accounts a where a.id::text=p_admin and a.is_active)
  then raise exception 'COMMUNITY_FORBIDDEN'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(public.community_resource_json(x) order by x.created_at desc,x.id desc),'[]') into items
   from (select * from public.community_resources order by created_at desc,id desc limit 21 offset page*20) x;
  more:=jsonb_array_length(items)>20; if more then items:=items-20; end if;
  return jsonb_build_object('resources',items,'page',page,'hasMore',more);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('community_resources:'||p_admin,23));
 id_value:=(p_payload->>'id')::uuid;
 select * into r from public.community_resources where id=id_value for update;
 if p_action='create' then
  if found then
   if r.created_by<>p_admin or r.title<>btrim(p_payload->>'title') or r.body<>btrim(p_payload->>'body')
    or r.source_url<>coalesce(p_payload->>'sourceUrl','') or r.closes_on is distinct from (p_payload->>'closesOn')::date
    or r.published is distinct from (p_payload->>'published')::boolean then raise exception 'COMMUNITY_CONFLICT'; end if;
   return jsonb_build_object('resource',public.community_resource_json(r));
  end if;
  insert into public.community_resources(id,title,body,source_url,closes_on,published,created_by,updated_by)
   values(id_value,btrim(p_payload->>'title'),btrim(p_payload->>'body'),coalesce(p_payload->>'sourceUrl',''),
    (p_payload->>'closesOn')::date,(p_payload->>'published')::boolean,p_admin,p_admin) returning * into r;
 elsif p_action in ('update','delete') then
  if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
  if r.updated_at is distinct from (p_payload->>'expectedUpdatedAt')::timestamptz then raise exception 'COMMUNITY_CONFLICT'; end if;
  if p_action='delete' then
   delete from public.community_resources where id=id_value;
   return jsonb_build_object('success',true,'id',id_value);
  end if;
  update public.community_resources set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),
   source_url=coalesce(p_payload->>'sourceUrl',''),closes_on=(p_payload->>'closesOn')::date,
   published=(p_payload->>'published')::boolean,updated_by=p_admin,updated_at=clock_timestamp()
   where id=id_value returning * into r;
 else raise exception 'COMMUNITY_INVALID_ACTION'; end if;
 return jsonb_build_object('resource',public.community_resource_json(r));
end $$;
revoke all on function public.community_resource_json(public.community_resources),
 public.community_resource_list(uuid,text,integer),public.community_resource_admin(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_resource_json(public.community_resources),
 public.community_resource_list(uuid,text,integer),public.community_resource_admin(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
