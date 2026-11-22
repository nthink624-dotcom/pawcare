-- Account-bound reactions for the existing shared member community.
-- Browser roles cannot read reaction rows or execute the internal RPCs.
begin;

create table public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (post_id, user_id)
);
create index community_post_likes_user on public.community_post_likes(user_id);

create table public.community_post_saves (
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, post_id)
);
create index community_post_saves_feed on public.community_post_saves(user_id, created_at desc, post_id desc);
create index community_post_saves_post on public.community_post_saves(post_id);

alter table public.community_post_likes enable row level security;
alter table public.community_post_saves enable row level security;
revoke all on public.community_post_likes, public.community_post_saves from public, anon, authenticated;
grant select, insert, delete on public.community_post_likes, public.community_post_saves to service_role;

create function public.community_reaction_json(p_post uuid, p_user uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p_post,
    'likeCount', (select count(*) from public.community_post_likes l where l.post_id=p_post),
    'liked', exists(select 1 from public.community_post_likes l where l.post_id=p_post and l.user_id=p_user),
    'saved', exists(select 1 from public.community_post_saves s where s.post_id=p_post and s.user_id=p_user)
  )
$$;
revoke all on function public.community_reaction_json(uuid,uuid) from public, anon, authenticated;
grant execute on function public.community_reaction_json(uuid,uuid) to service_role;

-- Keep the previously verified CRUD/moderation flow intact and decorate its
-- public post payloads. The renamed implementation remains server-only.
alter function public.community_dispatch(uuid,text,text,jsonb) rename to community_dispatch_core;
revoke all on function public.community_dispatch_core(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.community_dispatch_core(uuid,text,text,jsonb) to service_role;

create function public.community_dispatch(p_user uuid, p_shop text, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_active boolean;
  v_result jsonb;
  v_posts jsonb;
  v_viewer jsonb;
  v_blocks jsonb;
  v_page int := greatest(0,least(10000,coalesce((p_payload->>'page')::int,0)));
  v_more boolean;
begin
  if p_user is null or not public.community_member(p_user,p_shop) then
    raise exception 'COMMUNITY_FORBIDDEN';
  end if;

  if p_action in ('like','save') then
    if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then
      raise exception 'COMMUNITY_INVALID_REACTION';
    end if;
    v_active := (p_payload->>'active')::boolean;
    -- Use the same lock order as existing writes: account first, post second.
    perform pg_advisory_xact_lock(hashtextextended(p_user::text,23));
    select p.id into v_id from public.community_posts p
      where p.id=(p_payload->>'postId')::uuid and not p.hidden
        and not public.community_blocked(p_user,p.author_id)
      for share;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;

    insert into public.community_profiles(user_id,nickname)
      values(p_user,'멤버 '||left(md5(p_user::text),8)) on conflict do nothing;
    if p_action='like' then
      if v_active then
        insert into public.community_post_likes(post_id,user_id) values(v_id,p_user) on conflict do nothing;
      else
        delete from public.community_post_likes where post_id=v_id and user_id=p_user;
      end if;
    else
      if v_active then
        insert into public.community_post_saves(user_id,post_id) values(p_user,v_id) on conflict do nothing;
      else
        delete from public.community_post_saves where user_id=p_user and post_id=v_id;
      end if;
    end if;
    return jsonb_build_object('id',v_id,'reaction',public.community_reaction_json(v_id,p_user));
  end if;

  if p_action='list' and p_payload->'savedOnly'='true'::jsonb then
    v_viewer := jsonb_build_object('nickname',coalesce(
      (select nickname from public.community_profiles where user_id=p_user),
      '멤버 '||left(md5(p_user::text),8)));
    select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'nickname',a.nickname)),'[]') into v_blocks
      from public.community_blocks b join public.community_profiles a on a.user_id=b.blocked_user_id
      where b.user_id=p_user;
    with rows as (
      select p as postrow,s.created_at as saved_at
      from public.community_post_saves s join public.community_posts p on p.id=s.post_id
      where s.user_id=p_user and not p.hidden and not public.community_blocked(p_user,p.author_id)
        and (coalesce(p_payload->>'category','')='' or p.category=p_payload->>'category')
        and (coalesce(p_payload->>'q','')='' or position(lower(p_payload->>'q') in lower(p.title||' '||p.body))>0)
      order by s.created_at desc,p.id desc limit 21 offset v_page*20
    )
    select coalesce(jsonb_agg(
      public.community_post_json(postrow,p_user,false) || public.community_reaction_json((postrow).id,p_user)
      order by saved_at desc,(postrow).id desc),'[]') into v_posts from rows;
    v_more := jsonb_array_length(v_posts)>20;
    if v_more then v_posts:=v_posts-20; end if;
    return jsonb_build_object('viewer',v_viewer,'blockedUsers',v_blocks,'posts',v_posts,'page',v_page,'hasMore',v_more);
  end if;

  v_result := public.community_dispatch_core(p_user,p_shop,p_action,p_payload);
  if v_result ? 'posts' then
    select coalesce(jsonb_agg(entry.value || public.community_reaction_json((entry.value->>'id')::uuid,p_user)
      order by entry.ordinality),'[]') into v_posts
      from jsonb_array_elements(v_result->'posts') with ordinality as entry(value,ordinality);
    v_result := jsonb_set(v_result,'{posts}',v_posts);
  elsif v_result ? 'post' then
    v_result := jsonb_set(v_result,'{post}',(v_result->'post') ||
      public.community_reaction_json((v_result->'post'->>'id')::uuid,p_user));
  end if;
  return v_result;
end $$;

revoke all on function public.community_dispatch(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.community_dispatch(uuid,text,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
