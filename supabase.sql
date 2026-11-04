-- Hours Planner cloud setup. Paste this into Supabase > SQL Editor > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.backups enable row level security;

drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles delete own" on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "backups select own" on public.backups;
drop policy if exists "backups insert own" on public.backups;
drop policy if exists "backups update own" on public.backups;
drop policy if exists "backups delete own" on public.backups;
create policy "backups select own" on public.backups for select to authenticated using (auth.uid() = user_id);
create policy "backups insert own" on public.backups for insert to authenticated with check (auth.uid() = user_id);
create policy "backups update own" on public.backups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backups delete own" on public.backups for delete to authenticated using (auth.uid() = user_id);

-- profile pictures: a public bucket, and everyone can only write inside their own folder
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars read" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);