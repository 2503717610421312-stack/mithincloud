-- Run once on an existing Supabase project before enabling public registration.
-- Existing accounts are trusted during this migration; newly registered users
-- are created unapproved by the updated handle_new_user trigger.

alter table public.profiles
  add column if not exists approved boolean not null default true;

alter table public.profiles
  alter column approved set default false;

alter table public.profiles
  alter column role set default 'exam_centre';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, approved)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User'),
    'exam_centre',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;