-- Public workspace by owner request. No recordings or transcripts in these counters.
create table if not exists public.teamflow_ai_usage (
 bucket timestamptz primary key,
 audio_seconds integer not null default 0,
 requests integer not null default 0
);
alter table public.teamflow_ai_usage enable row level security;
revoke all on public.teamflow_ai_usage from public,anon,authenticated;
grant select,insert,update on public.teamflow_ai_usage to service_role;
create policy "No direct client access" on public.teamflow_ai_usage for all to anon,authenticated using(false) with check(false);
create or replace function public.teamflow_reserve_ai(p_seconds integer)
returns void language plpgsql security invoker set search_path='' as $$
declare h timestamptz:=date_trunc('hour',now()); d timestamptz:=date_trunc('day',now()); a integer; n integer;
begin
 if p_seconds<0 or p_seconds>181 then raise exception 'INVALID';end if;
 perform pg_advisory_xact_lock(719105205);
 select coalesce(sum(audio_seconds),0),coalesce(sum(requests),0) into a,n from public.teamflow_ai_usage where bucket>=d;
 if a+p_seconds>21600 or n>=300 then raise exception 'DAILY_LIMIT';end if;
 insert into public.teamflow_ai_usage(bucket) values(h) on conflict do nothing;
 select audio_seconds,requests into a,n from public.teamflow_ai_usage where bucket=h;
 if a+p_seconds>6000 or n>=100 then raise exception 'HOURLY_LIMIT';end if;
 update public.teamflow_ai_usage set audio_seconds=audio_seconds+p_seconds,requests=requests+1 where bucket=h;
end $$;
revoke all on function public.teamflow_reserve_ai(integer) from public,anon,authenticated;
grant execute on function public.teamflow_reserve_ai(integer) to service_role;
