-- Public Teamflow UI, private database/storage access through the validated Edge API.
create table public.teamflow_board_tiles (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 80),
 description text not null default '' check(length(description)<=250),
 author text not null check(author in ('Viet','Do Hai','Can','John')),
 color text not null check(color in ('blue','purple','mint','amber','rose','slate')),
 archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teamflow_board_files (
 id uuid primary key, tile_id uuid not null references public.teamflow_board_tiles(id),
 name text not null check(length(name) between 1 and 180), path text not null unique,
 size bigint not null check(size between 1 and 10485760), mime text not null,
 ready boolean not null default false, archived boolean not null default false, created_at timestamptz not null default now()
);
create index teamflow_board_files_tile_idx on public.teamflow_board_files(tile_id);
alter table public.teamflow_board_tiles enable row level security;
alter table public.teamflow_board_files enable row level security;
revoke all on public.teamflow_board_tiles,public.teamflow_board_files from anon,authenticated;
grant select,insert,update,delete on public.teamflow_board_tiles,public.teamflow_board_files to service_role;
create policy board_tiles_deny_direct on public.teamflow_board_tiles for all to anon,authenticated using(false) with check(false);
create policy board_files_deny_direct on public.teamflow_board_files for all to anon,authenticated using(false) with check(false);

create function public.teamflow_board_create(p_id uuid,p_title text,p_description text,p_author text,p_color text)
returns setof public.teamflow_board_tiles language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7364001);
 if (select count(*) from public.teamflow_board_tiles)>=50 then raise exception 'TILE_LIMIT'; end if;
 return query insert into public.teamflow_board_tiles(id,title,description,author,color) values(p_id,p_title,p_description,p_author,p_color) returning *;
end $$;
revoke all on function public.teamflow_board_create(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.teamflow_board_create(uuid,text,text,text,text) to service_role;

create function public.teamflow_board_reserve(p_id uuid,p_tile_id uuid,p_name text,p_path text,p_size bigint,p_mime text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7364001);
 if not exists(select 1 from public.teamflow_board_tiles where id=p_tile_id and not archived) then raise exception 'TILE_MISSING'; end if;
 if (select count(*) from public.teamflow_board_files)>=200 or (select coalesce(sum(size),0) from public.teamflow_board_files)+p_size>262144000 then raise exception 'STORAGE_LIMIT'; end if;
 insert into public.teamflow_board_files(id,tile_id,name,path,size,mime) values(p_id,p_tile_id,p_name,p_path,p_size,p_mime);
end $$;
revoke all on function public.teamflow_board_reserve(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.teamflow_board_reserve(uuid,uuid,text,text,bigint,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('teamflow-board','teamflow-board',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
