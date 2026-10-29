-- OSM upload/login fixes for Zwitterion Classes.
-- Idempotent so it can be applied to environments that already received the hotfix.

update storage.buckets
set allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'exam-scans';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exam_checkers'
      and policyname = 'Checkers can read own registration'
  ) then
    create policy "Checkers can read own registration"
      on public.exam_checkers
      for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;
