-- Run once in the Supabase SQL editor. Replace the example email first.
create table if not exists public.portfolio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.portfolio_admins enable row level security;
revoke all on public.portfolio_admins from public, anon, authenticated;
grant select on public.portfolio_admins to authenticated;
drop policy if exists "read own membership" on public.portfolio_admins;
create policy "read own membership" on public.portfolio_admins
  for select to authenticated using (user_id = (select auth.uid()));

do $$
declare
  owner_email text := 'jiho@example.com';
  owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'Create the owner in Authentication > Users, then set the matching email in this script.';
  end if;
  insert into public.portfolio_admins(user_id) values (owner_id)
  on conflict do nothing;
end $$;

create table if not exists public.portfolio_site (
  id integer primary key check (id = 1),
  revision integer not null default 0,
  content jsonb
);

insert into public.portfolio_site(id) values (1) on conflict do nothing;
alter table public.portfolio_site enable row level security;
revoke all on public.portfolio_site from public, anon, authenticated;
grant select on public.portfolio_site to anon, authenticated;
grant update (content, revision) on public.portfolio_site to authenticated;

drop policy if exists "read published site" on public.portfolio_site;
create policy "read published site" on public.portfolio_site for select using (true);
drop policy if exists "publish as owner" on public.portfolio_site;
create policy "publish as owner" on public.portfolio_site for update to authenticated
  using (exists (select 1 from public.portfolio_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.portfolio_admins where user_id = (select auth.uid())));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "owner uploads portfolio images" on storage.objects;
create policy "owner uploads portfolio images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portfolio' and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    exists (select 1 from public.portfolio_admins where user_id = (select auth.uid()))
  );
