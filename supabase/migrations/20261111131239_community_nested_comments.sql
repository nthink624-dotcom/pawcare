-- Nested comments and account-bound votes. Only the authenticated server RPC
-- may access these rows; no browser-role grants or client-supplied identities.
begin;
alter table public.community_comments add column parent_comment_id uuid;
alter table public.community_comments add constraint community_comments_post_id_unique unique(post_id,id);
alter table public.community_comments add constraint community_comments_parent_fk
  foreign key(post_id,parent_comment_id) references public.community_comments(post_id,id)
  on delete set null(parent_comment_id);
alter table public.community_comments add constraint community_comments_not_self
  check(parent_comment_id is distinct from id);
create index community_comments_parent on public.community_comments(post_id,parent_comment_id);

create table public.community_comment_votes (
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  value smallint not null check(value in (-1,1)),
  primary key(comment_id,user_id)
);
create index community_comment_votes_user on public.community_comment_votes(user_id);
alter table public.community_comment_votes enable row level security;
revoke all on public.community_comment_votes from public,anon,authenticated;
grant select,insert,update,delete on public.community_comment_votes to service_role;

create function public.community_comment_json(p public.community_comments,p_user uuid,p_author uuid) returns jsonb
language sql stable security invoker set search_path = public,pg_temp as $$
  select case when p.hidden or public.community_blocked(p_user,p.author_id) then
    jsonb_build_object('id',p.id,'parentId',p.parent_comment_id,'body','볼 수 없는 댓글입니다.',
      'authorName','','isMine',false,'isPostAuthor',false,'unavailable',true,'createdAt',p.created_at,'score',0,'vote',0)
  else jsonb_build_object('id',p.id,'parentId',p.parent_comment_id,'body',p.body,
    'authorName',(select nickname from public.community_profiles where user_id=p.author_id),
    'isMine',p.author_id=p_user,'isPostAuthor',p.author_id=p_author,'unavailable',false,'createdAt',p.created_at,
    'score',coalesce((select sum(value) from public.community_comment_votes where comment_id=p.id),0),
    'vote',coalesce((select value from public.community_comment_votes where comment_id=p.id and user_id=p_user),0)) end;
$$;
revoke all on function public.community_comment_json(public.community_comments,uuid,uuid) from public,anon,authenticated;
grant execute on function public.community_comment_json(public.community_comments,uuid,uuid) to service_role;

alter function public.community_dispatch(uuid,text,text,jsonb) rename to community_dispatch_posts;
revoke all on function public.community_dispatch_posts(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_dispatch_posts(uuid,text,text,jsonb) to service_role;

create function public.community_dispatch(p_user uuid,p_shop text,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public,pg_temp as $$
declare
  v_result jsonb; v_comments jsonb; v_post public.community_posts; v_comment public.community_comments;
  v_id uuid; v_parent uuid; v_depth int; v_vote int;
  v_page int := greatest(0,least(10000,coalesce((p_payload->>'page')::int,0)));
  v_more boolean;
begin
  if p_user is null or not public.community_member(p_user,p_shop) then raise exception 'COMMUNITY_FORBIDDEN'; end if;
  if p_action='detail' then
    v_result:=public.community_dispatch_posts(p_user,p_shop,p_action,p_payload);
    select * into v_post from public.community_posts where id=(p_payload->>'postId')::uuid;
    -- Bound each page to 20 visible comments plus their ancestor context.
    -- Hidden/blocked ancestors carry no author, body, or voting information.
    with recursive selected as (
      select c.* from public.community_comments c
      where c.post_id=v_post.id and not c.hidden and not public.community_blocked(p_user,c.author_id)
      order by c.created_at,c.id limit 21 offset v_page*20
    ), page_rows as (select * from selected order by created_at,id limit 20),
    ancestors as (
      select c.* from page_rows c
      union
      select p.* from public.community_comments p join ancestors child on child.parent_comment_id=p.id
      where p.post_id=v_post.id
    )
    select coalesce(jsonb_agg(public.community_comment_json(a,p_user,v_post.author_id) order by a.created_at,a.id),'[]'),
      (select count(*)>20 from selected) into v_comments,v_more from ancestors a;
    return v_result || jsonb_build_object('comments',v_comments,'hasMore',v_more);
  elsif p_action in ('create_comment','vote_comment') then
    perform pg_advisory_xact_lock(hashtextextended(p_user::text,23));
    -- Match the existing post lock order, including concurrent post deletion.
    select * into v_post from public.community_posts where id=(p_payload->>'postId')::uuid
      and not hidden and not public.community_blocked(p_user,author_id) for update;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    insert into public.community_profiles(user_id,nickname)
      values(p_user,'멤버 '||left(md5(p_user::text),8)) on conflict do nothing;
    if p_action='create_comment' then
      v_id:=(p_payload->>'id')::uuid; v_parent:=(p_payload->>'parentId')::uuid;
      select * into v_comment from public.community_comments where id=v_id;
      if found then
        if v_comment.author_id<>p_user or v_comment.post_id<>v_post.id or v_comment.hidden
          or v_comment.parent_comment_id is distinct from v_parent or v_comment.body<>btrim(p_payload->>'body')
          then raise exception 'COMMUNITY_CONFLICT'; end if;
        return jsonb_build_object('id',v_id);
      end if;
      if v_parent is not null then
        perform 1 from public.community_comments where id=v_parent and post_id=v_post.id
          and not hidden and not public.community_blocked(p_user,author_id) for share;
        if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
        with recursive chain as (
          select id,parent_comment_id,1 depth from public.community_comments where id=v_parent
          union all
          select p.id,p.parent_comment_id,c.depth+1 from public.community_comments p
            join chain c on c.parent_comment_id=p.id where c.depth<8
        ) select max(depth) into v_depth from chain;
        if v_depth>=8 then raise exception 'COMMUNITY_INVALID_DEPTH'; end if;
      end if;
      if (select count(*) from public.community_comments where author_id=p_user and created_at>now()-interval '1 day')>=100
        then raise exception 'COMMUNITY_RATE_LIMIT'; end if;
      insert into public.community_comments(id,post_id,parent_comment_id,author_id,body)
        values(v_id,v_post.id,v_parent,p_user,btrim(p_payload->>'body'));
      return jsonb_build_object('id',v_id);
    end if;
    v_id:=(p_payload->>'commentId')::uuid; v_vote:=(p_payload->>'value')::int;
    if v_vote is null or v_vote not in (-1,0,1) then raise exception 'COMMUNITY_INVALID_VOTE'; end if;
    select * into v_comment from public.community_comments where id=v_id and post_id=v_post.id
      and not hidden and not public.community_blocked(p_user,author_id) for update;
    if not found then raise exception 'COMMUNITY_NOT_FOUND'; end if;
    if v_vote=0 then
      delete from public.community_comment_votes where comment_id=v_id and user_id=p_user;
    else
      insert into public.community_comment_votes(comment_id,user_id,value) values(v_id,p_user,v_vote)
        on conflict(comment_id,user_id) do update set value=excluded.value;
    end if;
    return jsonb_build_object('id',v_id,'commentReaction',jsonb_build_object('id',v_id,'vote',v_vote,
      'score',coalesce((select sum(value) from public.community_comment_votes where comment_id=v_id),0)));
  end if;
  return public.community_dispatch_posts(p_user,p_shop,p_action,p_payload);
end;
$$;
revoke all on function public.community_dispatch(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_dispatch(uuid,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
