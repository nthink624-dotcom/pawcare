-- One member community shared by web and mobile. Only the verified server API
-- can execute these functions. Browser roles cannot read or mutate tables.
begin;
create table public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 24),
  created_at timestamptz not null default now()
);
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.community_profiles(user_id) on delete cascade,
  category text not null check (category in ('operations','knowledge','lounge','feedback')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index community_posts_feed on public.community_posts(created_at desc, id desc) where not hidden;
create index community_posts_author on public.community_posts(author_id, created_at);
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  hidden boolean not null default false, created_at timestamptz not null default now()
);
create index community_comments_post on public.community_comments(post_id, created_at, id);
create index community_comments_author on public.community_comments(author_id, created_at);
create table public.community_media_assets (
  media_asset_id uuid primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  object_path text not null unique,
  position smallint not null check (position between 0 and 2)
);
create index community_media_post on public.community_media_assets(post_id);
-- Durable cleanup queue also covers account deletion cascades and Storage outages.
create table public.community_media_deletions (
  object_path text primary key, requested_at timestamptz not null default now()
);
alter table public.community_media_deletions enable row level security;
revoke all on public.community_media_deletions from public, anon, authenticated;
grant select,insert,delete on public.community_media_deletions to service_role;
create schema if not exists community_private;
revoke all on schema community_private from public, anon, authenticated;
-- Internal trigger only: account-delete cascades run under a different DB role.
create function community_private.queue_media_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.community_media_deletions(object_path) values(old.object_path) on conflict do nothing;
  return old;
end $$;
revoke all on function community_private.queue_media_deletion() from public,anon,authenticated;
create trigger community_media_deletion after delete on public.community_media_assets
for each row execute function community_private.queue_media_deletion();
create table public.community_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  blocked_user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  check (user_id <> blocked_user_id), unique(user_id, blocked_user_id)
);
create index community_blocks_target on public.community_blocks(blocked_user_id);
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.community_profiles(user_id) on delete set null,
  post_id uuid references public.community_posts(id) on delete set null,
  comment_id uuid references public.community_comments(id) on delete set null,
  target_type text not null check (target_type in ('post','comment')),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  status text not null default 'open' check (status in ('open','hidden','dismissed')),
  created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by text
);
create index community_reports_queue on public.community_reports(status, created_at);
create index community_reports_reporter on public.community_reports(reporter_id, created_at);
create index community_reports_post on public.community_reports(post_id);
create index community_reports_comment on public.community_reports(comment_id);

alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_media_assets enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;
revoke all on public.community_profiles, public.community_posts, public.community_comments,
  public.community_media_assets, public.community_blocks, public.community_reports from public, anon, authenticated;
grant select, insert, update, delete on public.community_profiles, public.community_posts, public.community_comments,
  public.community_media_assets, public.community_blocks, public.community_reports to service_role;

create function public.community_member(p_user uuid, p_shop text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists(select 1 from public.shops s where s.id = p_shop and s.owner_user_id = p_user)
  or exists(select 1 from public.owner_shop_memberships m where m.owner_user_id = p_user and m.shop_id = p_shop
    and (m.role in ('owner','manager') or (m.role = 'staff' and exists(
      select 1 from public.staff_members s where s.shop_id = p_shop and s.auth_user_id = p_user and s.is_active = true))))
$$;
create function public.community_blocked(p_user uuid, p_author uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists(select 1 from public.community_blocks b where
    (b.user_id = p_user and b.blocked_user_id = p_author) or (b.user_id = p_author and b.blocked_user_id = p_user))
$$;
create function public.community_post_json(p public.community_posts, p_user uuid, p_detail boolean) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('id',p.id,'category',p.category,'title',p.title,
    'body',case when p_detail then p.body else left(p.body,200) end,
    'authorName',(select nickname from public.community_profiles where user_id=p.author_id),
    'isMine',p.author_id=p_user,'createdAt',p.created_at,'updatedAt',p.updated_at,
    'commentCount',(select count(*) from public.community_comments c where c.post_id=p.id and not c.hidden
      and not public.community_blocked(p_user,c.author_id)),
    'images',coalesce((select jsonb_agg(jsonb_build_object('mediaAssetId',a.media_asset_id,'objectPath',a.object_path) order by a.position)
      from public.community_media_assets a where a.post_id=p.id),'[]'::jsonb))
$$;

create function public.community_dispatch(p_user uuid, p_shop text, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_post public.community_posts; v_comment public.community_comments; v_target uuid;
  v_id uuid; v_count int; v_page int := greatest(0, least(10000, coalesce((p_payload->>'page')::int,0)));
  v_posts jsonb; v_comments jsonb; v_viewer jsonb; v_blocks jsonb; v_paths jsonb := '[]'; v_more boolean;
begin
  if p_user is null or not public.community_member(p_user,p_shop) then raise exception 'COMMUNITY_FORBIDDEN'; end if;
  v_viewer := jsonb_build_object('nickname',coalesce((select nickname from public.community_profiles where user_id=p_user),'멤버 '||left(md5(p_user::text),8)));
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'nickname',a.nickname)),'[]') into v_blocks
    from public.community_blocks b join public.community_profiles a on a.user_id=b.blocked_user_id where b.user_id=p_user;
  if p_action='list' then
    with rows as (select p from public.community_posts p where not p.hidden and not public.community_blocked(p_user,p.author_id)
      and (coalesce(p_payload->>'category','')='' or p.category=p_payload->>'category')
      and (coalesce(p_payload->>'q','')='' or position(lower(p_payload->>'q') in lower(p.title||' '||p.body))>0)
      order by p.created_at desc,p.id desc limit 21 offset v_page*20)
    select coalesce(jsonb_agg(public.community_post_json(p,p_user,false)),'[]') into v_posts from rows;
    v_more := jsonb_array_length(v_posts)>20;
    if v_more then v_posts:=v_posts-20; end if;
    return jsonb_build_object('viewer',v_viewer,'blockedUsers',v_blocks,'posts',v_posts,'page',v_page,'hasMore',v_more);
  end if;
  if p_action='detail' then
    select * into v_post from public.community_posts where id=(p_payload->>'postId')::uuid and not hidden and not public.community_blocked(p_user,author_id);
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    with rows as (select c.* from public.community_comments c where c.post_id=v_post.id and not c.hidden and not public.community_blocked(p_user,c.author_id)
      order by c.created_at,c.id limit 21 offset v_page*20)
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'body',c.body,'authorName',a.nickname,'isMine',c.author_id=p_user,'createdAt',c.created_at)
      order by c.created_at,c.id),'[]') into v_comments from rows c join public.community_profiles a on a.user_id=c.author_id;
    v_more:=jsonb_array_length(v_comments)>20;
    if v_more then v_comments:=v_comments-20; end if;
    return jsonb_build_object('viewer',v_viewer,'blockedUsers',v_blocks,'post',public.community_post_json(v_post,p_user,true),'comments',v_comments,'page',v_page,'hasMore',v_more);
  end if;
  -- Serialize user mutations so rate limits and duplicate retries stay atomic.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,23));
  insert into public.community_profiles(user_id,nickname) values(p_user,v_viewer->>'nickname') on conflict do nothing;
  if p_action='profile' then
    update public.community_profiles set nickname=btrim(p_payload->>'nickname') where user_id=p_user;
  elsif p_action in ('create_post','update_post') then
    v_id:=(p_payload->>'id')::uuid;
    if p_action='create_post' then
      if exists(select 1 from public.community_posts where id=v_id and author_id=p_user) then
        if not exists(select 1 from public.community_posts where id=v_id and title=btrim(p_payload->>'title') and body=btrim(p_payload->>'body') and category=p_payload->>'category') then raise exception 'COMMUNITY_CONFLICT'; end if;
        insert into public.community_media_deletions(object_path)
          select x->>'objectPath' from jsonb_array_elements(coalesce(p_payload->'newMedia','[]')) x on conflict do nothing;
        return jsonb_build_object('id',v_id,'removedPaths',coalesce((select jsonb_agg(x->>'objectPath') from jsonb_array_elements(coalesce(p_payload->'newMedia','[]')) x),'[]'));
      end if;
      if (select count(*) from public.community_posts where author_id=p_user and created_at>now()-interval '1 day')>=20 then raise exception 'COMMUNITY_RATE_LIMIT'; end if;
      insert into public.community_posts(id,author_id,category,title,body) values(v_id,p_user,p_payload->>'category',btrim(p_payload->>'title'),btrim(p_payload->>'body'));
    else
      select * into v_post from public.community_posts where id=v_id and author_id=p_user and not hidden for update;
      if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
      if v_post.updated_at<>(p_payload->>'expectedUpdatedAt')::timestamptz then raise exception 'COMMUNITY_CONFLICT'; end if;
      update public.community_posts set category=p_payload->>'category',title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),updated_at=clock_timestamp() where id=v_id;
      select coalesce(jsonb_agg(object_path),'[]') into v_paths from public.community_media_assets where post_id=v_id
        and media_asset_id::text not in(select jsonb_array_elements_text(coalesce(p_payload->'retainedMediaIds','[]')));
      delete from public.community_media_assets where post_id=v_id and media_asset_id::text not in(select jsonb_array_elements_text(coalesce(p_payload->'retainedMediaIds','[]')));
    end if;
    select count(*) into v_count from public.community_media_assets where post_id=v_id;
    if v_count+jsonb_array_length(coalesce(p_payload->'newMedia','[]'))>3 then raise exception 'COMMUNITY_INVALID_MEDIA'; end if;
    -- Position does not need to be unique: retained photos keep their durable IDs.
    insert into public.community_media_assets(media_asset_id,post_id,object_path,position)
      select (x->>'mediaAssetId')::uuid,v_id,x->>'objectPath',least(2,v_count+ordinality::int-1)
      from jsonb_array_elements(coalesce(p_payload->'newMedia','[]')) with ordinality as t(x,ordinality);
  elsif p_action='delete_post' then
    v_id:=(p_payload->>'id')::uuid;
    select * into v_post from public.community_posts where id=v_id and author_id=p_user for update;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    select coalesce(jsonb_agg(object_path),'[]') into v_paths from public.community_media_assets where post_id=v_id;
    delete from public.community_posts where id=v_id;
  elsif p_action='create_comment' then
    v_id:=(p_payload->>'id')::uuid;
    if exists(select 1 from public.community_comments where id=v_id and author_id=p_user) then return jsonb_build_object('id',v_id); end if;
    select * into v_post from public.community_posts where id=(p_payload->>'postId')::uuid and not hidden and not public.community_blocked(p_user,author_id) for update;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    if (select count(*) from public.community_comments where author_id=p_user and created_at>now()-interval '1 day')>=100 then raise exception 'COMMUNITY_RATE_LIMIT'; end if;
    insert into public.community_comments(id,post_id,author_id,body) values(v_id,v_post.id,p_user,btrim(p_payload->>'body'));
  elsif p_action='delete_comment' then
    delete from public.community_comments where id=(p_payload->>'id')::uuid and author_id=p_user;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
  elsif p_action in ('report','block') then
    if p_payload->>'targetType'='comment' then
      select * into v_comment from public.community_comments where id=(p_payload->>'targetId')::uuid and not hidden;
      if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
      select * into v_post from public.community_posts where id=v_comment.post_id and not hidden;
      v_target:=v_comment.author_id;
    else
      select * into v_post from public.community_posts where id=(p_payload->>'targetId')::uuid and not hidden;
      v_target:=v_post.author_id;
    end if;
    if v_post.id is null or public.community_blocked(p_user,v_post.author_id) or public.community_blocked(p_user,v_target) then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    if v_target=p_user then raise exception 'COMMUNITY_FORBIDDEN'; end if;
    if p_action='block' then
      insert into public.community_blocks(user_id,blocked_user_id) values(p_user,v_target) on conflict do nothing;
    else
      if (select count(*) from public.community_reports where reporter_id=p_user and created_at>now()-interval '1 day')>=20 then raise exception 'COMMUNITY_RATE_LIMIT'; end if;
      insert into public.community_reports(reporter_id,post_id,comment_id,target_type,reason) values(p_user,v_post.id,v_comment.id,p_payload->>'targetType',btrim(p_payload->>'reason'));
    end if;
  elsif p_action='unblock' then
    delete from public.community_blocks where id=(p_payload->>'id')::uuid and user_id=p_user;
  else raise exception 'COMMUNITY_INVALID_ACTION';
  end if;
  return jsonb_build_object('id',v_id,'removedPaths',v_paths);
end $$;

create function public.community_moderate(p_admin text, p_action text, p_id uuid default null) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_report public.community_reports; v_result jsonb;
begin
  if p_action='list' then
    select coalesce(jsonb_agg(x),'[]') into v_result from (
      select r.id,r.reason,r.target_type as "targetType",r.created_at as "createdAt",p.title,c.body as "commentBody",p.body as "postBody",(p.hidden or coalesce(c.hidden,false)) as hidden,
        coalesce((select jsonb_agg(jsonb_build_object('mediaAssetId',a.media_asset_id,'objectPath',a.object_path) order by a.position) from public.community_media_assets a where a.post_id=p.id),'[]') as images
      from public.community_reports r left join public.community_posts p on p.id=r.post_id left join public.community_comments c on c.id=r.comment_id
      where r.status='open' order by r.created_at limit 100) x;
    return jsonb_build_object('reports',v_result);
  end if;
  if p_admin is null or p_action not in ('hide','dismiss') then raise exception 'COMMUNITY_FORBIDDEN'; end if;
  select * into v_report from public.community_reports where id=p_id and status='open' for update;
  if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
  if p_action='hide' then
    if v_report.target_type='comment' then
      if v_report.comment_id is null then raise exception 'COMMUNITY_NOT_FOUND'; end if;
      update public.community_comments set hidden=true where id=v_report.comment_id;
    else update public.community_posts set hidden=true,updated_at=clock_timestamp() where id=v_report.post_id; end if;
  end if;
  update public.community_reports set status=case when p_action='hide' then 'hidden' else 'dismissed' end,reviewed_at=clock_timestamp(),reviewed_by=p_admin where id=p_id;
  return jsonb_build_object('success',true);
end $$;

revoke all on function public.community_member(uuid,text), public.community_blocked(uuid,uuid), public.community_post_json(public.community_posts,uuid,boolean),
  public.community_dispatch(uuid,text,text,jsonb), public.community_moderate(text,text,uuid) from public, anon, authenticated;
grant execute on function public.community_member(uuid,text), public.community_blocked(uuid,uuid), public.community_post_json(public.community_posts,uuid,boolean),
  public.community_dispatch(uuid,text,text,jsonb), public.community_moderate(text,text,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-images','community-images',false,1048576,array['image/webp']) on conflict(id) do nothing;
-- Restrictive policy also fences off overly broad pre-existing permissive policies.
create policy community_images_server_only on storage.objects as restrictive
  for all to anon, authenticated using (bucket_id <> 'community-images') with check (bucket_id <> 'community-images');
commit;
