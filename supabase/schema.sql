create table public.teamflow_workspace (
 id text primary key check(id='teamflow'),
 revision bigint not null default 0 check(revision>=0),
 data jsonb not null default '{"meetings":[],"todos":[]}'::jsonb check(jsonb_typeof(data)='object'),
 updated_at timestamptz not null default now()
);
alter table public.teamflow_workspace enable row level security;
revoke all on public.teamflow_workspace from anon, authenticated;
grant select,insert,update on public.teamflow_workspace to service_role;
create table public.teamflow_access_keys (
 key_hash text primary key check(length(key_hash)=64),
 workspace_id text not null references public.teamflow_workspace(id),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.teamflow_access_keys enable row level security;
revoke all on public.teamflow_access_keys from anon,authenticated;
grant select on public.teamflow_access_keys to service_role;
insert into public.teamflow_workspace(id) values('teamflow');
create policy deny_direct_clients_workspace on public.teamflow_workspace for all to anon, authenticated using(false) with check(false);
create policy deny_direct_clients_keys on public.teamflow_access_keys for all to anon,authenticated using(false) with check(false);

