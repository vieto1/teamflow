-- Private allocation ledger: direct clients cannot mint meeting credentials.
create table public.teamflow_video_devices (
 month date not null,
 device_id uuid not null,
 issued integer not null default 0 check (issued between 0 and 1200),
 primary key(month,device_id)
);
alter table public.teamflow_video_devices enable row level security;
revoke all on public.teamflow_video_devices from public,anon,authenticated;
grant select,insert,update on public.teamflow_video_devices to service_role;
create function public.teamflow_reserve_video_device(p_device uuid,p_room text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'UTC')::date; n integer;
begin
 perform pg_advisory_xact_lock(719105204);
 if not exists(select 1 from public.teamflow_workspace w,
 jsonb_array_elements(w.data->'meetings') item where w.id='teamflow' and item->>'videoRoom'=p_room)
 then raise exception 'ROOM_NOT_FOUND'; end if;
 select issued into n from public.teamflow_video_devices where month=m and device_id=p_device;
 if found then
  if n>=1200 then raise exception 'DEVICE_RATE_LIMIT'; end if;
  update public.teamflow_video_devices set issued=issued+1 where month=m and device_id=p_device;
 else
  if (select count(*) from public.teamflow_video_devices where month=m)>=20
  then raise exception 'DEVICE_MONTH_LIMIT'; end if;
  insert into public.teamflow_video_devices values(m,p_device,1);
 end if;
 return true;
end $$;
revoke all on function public.teamflow_reserve_video_device(uuid,text) from public,anon,authenticated;
grant execute on function public.teamflow_reserve_video_device(uuid,text) to service_role;

create policy deny_direct_clients_video_devices on public.teamflow_video_devices for all to anon,authenticated using(false) with check(false);
