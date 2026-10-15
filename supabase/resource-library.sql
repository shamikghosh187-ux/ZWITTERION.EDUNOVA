-- Zwitterion Classes: private resource library (Supabase free tier)
-- Run in Supabase SQL Editor after creating Sir's real Supabase Auth user.
-- No demo account is granted admin access by this schema.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  resource_type text not null check (resource_type in ('notes','question-paper','pyq','sample-paper','worksheet')),
  class_name text not null check (class_name in ('11','12')),
  subject text not null check (subject in ('Chemistry','Physics','Mathematics','Biology','Other')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.resources enable row level security;

-- Admin identities are provisioned manually by the project owner in SQL Editor.
create policy "Admins can read own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

create policy "Admins can read resource metadata"
on public.resources for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can insert resource metadata"
on public.resources for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "Admins can update resource metadata"
on public.resources for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can delete resource metadata"
on public.resources for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Create a private bucket. Run once; if it already exists, verify it is NOT public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-resources', 'class-resources', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create policy "Admins can upload resource PDFs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'class-resources'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "Admins can read private resource PDFs"
on storage.objects for select to authenticated
using (
  bucket_id = 'class-resources'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "Admins can update private resource PDFs"
on storage.objects for update to authenticated
using (
  bucket_id = 'class-resources'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'class-resources'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "Admins can delete private resource PDFs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'class-resources'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

-- IMPORTANT:
-- 1) After creating Sir's real Auth user, insert their UUID into admin_users:
--    insert into public.admin_users (user_id) values ('AUTH_USER_UUID');
-- 2) Do not add the demo email or a demo UUID to admin_users.
-- 3) This policy set does not expose PDFs to anonymous visitors. Add a separate
--    authorized server-side signed-URL endpoint before students can download files.
