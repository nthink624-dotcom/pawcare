begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('community-videos', 'community-videos', false, 12582912, array['video/mp4']);

create policy community_videos_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'community-videos')
with check (bucket_id <> 'community-videos');

create table public.community_video_uploads (
  id uuid primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null,
  object_path text not null unique,
  bytes integer not null check (bytes between 16 and 12582912),
  expires_at timestamptz not null,
  attached boolean not null default false
);
create index community_video_uploads_author on public.community_video_uploads(author_id);
create index community_video_uploads_expiry on public.community_video_uploads(expires_at);
alter table public.community_video_uploads enable row level security;
revoke all on public.community_video_uploads from public, anon, authenticated;
grant select, insert, update, delete on public.community_video_uploads to service_role;

-- Do not delete a video while an already issued signed upload can still
-- recreate the path. This also covers user and post deletion cascades.
create or replace function community_private.queue_media_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.community_media_deletions(object_path, requested_at)
  values (old.object_path, case when right(old.object_path, 4) = '.mp4'
    then now() + interval '2 hours 15 minutes' else now() end)
  on conflict do nothing;
  return old;
end $$;

create trigger community_video_upload_deleted
after delete on public.community_video_uploads
for each row when (not old.attached)
execute function community_private.queue_media_deletion();

create unique index community_one_video_per_post on public.community_media_assets(post_id)
where right(object_path, 4) = '.mp4';

create function public.community_reserve_video(
  p_user uuid, p_shop text, p_post uuid, p_upload uuid, p_bytes integer
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_upload public.community_video_uploads;
  v_path text := p_user::text || '/' || p_upload::text || '.mp4';
begin
  if p_user is null or not public.community_member(p_user, p_shop) then raise exception 'COMMUNITY_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 23));
  if exists (select 1 from public.community_posts where id = p_post and (author_id <> p_user or hidden)) then
    raise exception 'COMMUNITY_FORBIDDEN';
  end if;

  -- A Storage upload signature lasts two hours. Leave expired paths in the
  -- durable queue until Storage acknowledges their removal.
  delete from public.community_video_uploads where id in (
    select id from public.community_video_uploads where expires_at < now()
    order by expires_at limit 24 for update skip locked
  );

  select * into v_upload from public.community_video_uploads where id = p_upload for update;
  if found then
    if v_upload.author_id <> p_user or v_upload.post_id <> p_post or v_upload.bytes <> p_bytes or v_upload.expires_at < now() then
      raise exception 'COMMUNITY_INVALID_VIDEO';
    end if;
    update public.community_video_uploads set expires_at = now() + interval '2 hours 15 minutes' where id = p_upload;
    return v_upload.object_path;
  end if;

  if exists (select 1 from public.community_media_assets where media_asset_id = p_upload) then
    if exists (select 1 from public.community_media_assets where media_asset_id = p_upload and post_id = p_post and object_path = v_path) then
      return v_path;
    end if;
    raise exception 'COMMUNITY_INVALID_VIDEO';
  end if;

  if exists (select 1 from public.community_media_deletions where object_path = v_path) then
    raise exception 'COMMUNITY_INVALID_VIDEO';
  end if;
  if (select count(*) from public.community_video_uploads where author_id = p_user and expires_at >= now()) >= 6 then
    raise exception 'COMMUNITY_RATE_LIMIT';
  end if;
  insert into public.community_video_uploads(id, author_id, post_id, object_path, bytes, expires_at)
  values (p_upload, p_user, p_post, v_path, p_bytes, now() + interval '2 hours 15 minutes');
  return v_path;
end $$;

create function public.community_save_post_with_video(
  p_user uuid, p_shop text, p_action text, p_payload jsonb, p_upload uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_upload public.community_video_uploads;
  v_result jsonb;
  v_post uuid := (p_payload->>'id')::uuid;
  v_media jsonb := coalesce(p_payload->'newMedia', '[]'::jsonb);
begin
  if p_user is null or not public.community_member(p_user, p_shop) then raise exception 'COMMUNITY_FORBIDDEN'; end if;
  if p_action not in ('create_post', 'update_post') then raise exception 'COMMUNITY_INVALID_VIDEO'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 23));
  if p_action = 'create_post' and exists (select 1 from public.community_posts where id = v_post and author_id = p_user) then
    return public.community_dispatch(p_user, p_shop, p_action, p_payload);
  end if;

  select * into v_upload from public.community_video_uploads
  where id = p_upload and author_id = p_user and post_id = v_post and expires_at >= now() and not attached
  for update;
  if not found then raise exception 'COMMUNITY_INVALID_VIDEO'; end if;

  v_media := v_media || jsonb_build_array(jsonb_build_object('mediaAssetId', p_upload, 'objectPath', v_upload.object_path));
  v_result := public.community_dispatch(p_user, p_shop, p_action, jsonb_set(p_payload, '{newMedia}', v_media));
  update public.community_video_uploads set attached = true where id = p_upload;
  delete from public.community_video_uploads where id = p_upload;
  return v_result;
end $$;

revoke all on function public.community_reserve_video(uuid,text,uuid,uuid,integer),
  public.community_save_post_with_video(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.community_reserve_video(uuid,text,uuid,uuid,integer),
  public.community_save_post_with_video(uuid,text,text,jsonb,uuid) to service_role;

commit;