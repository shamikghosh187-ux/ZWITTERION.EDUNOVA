-- OSM upload, checker access, assignment, and moderation workflow.
-- Idempotent so this can be applied after the live hotfix or to a fresh environment.

update storage.buckets
set allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'exam-scans';

alter table public.exam_checkers
  add column if not exists role text not null default 'examiner';
alter table public.exam_checkers drop constraint if exists exam_checkers_role_check;
alter table public.exam_checkers
  add constraint exam_checkers_role_check check (role in ('examiner','moderator'));

alter table public.paper_scan_sessions drop constraint if exists paper_scan_sessions_status_check;
alter table public.paper_scan_sessions
  add constraint paper_scan_sessions_status_check
  check (status in ('scanning','ready_for_review','checked','approved','returned_for_review'));

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exam_checkers' and policyname='Checkers can read own registration') then
    create policy "Checkers can read own registration" on public.exam_checkers
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='paper_scan_sessions' and policyname='Moderators read all OSM sessions') then
    create policy "Moderators read all OSM sessions" on public.paper_scan_sessions
      for select to authenticated
      using (exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='paper_scan_sessions' and policyname='Moderators review OSM sessions') then
    create policy "Moderators review OSM sessions" on public.paper_scan_sessions
      for update to authenticated
      using (exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator'))
      with check (exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='paper_scan_answers' and policyname='Moderators read OSM answers') then
    create policy "Moderators read OSM answers" on public.paper_scan_answers
      for select to authenticated
      using (exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Moderators read exam scans') then
    create policy "Moderators read exam scans" on storage.objects
      for select to authenticated
      using (bucket_id='exam-scans' and exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator') and exists (select 1 from public.paper_scan_sessions s where s.page_paths @> jsonb_build_array(name)));
  end if;
end
$$;

create or replace function public.guard_osm_moderator_updates()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.exam_checkers c where c.user_id=(select auth.uid()) and c.active=true and c.role='moderator')
     and not exists (select 1 from public.admin_users a where a.user_id=(select auth.uid())) then
    if row(new.id,new.exam_id,new.student_name,new.student_roll,new.page_paths,new.teacher_notes,new.marks_awarded,new.max_marks,new.created_by,new.created_at,new.assigned_checker,new.checked_by,new.locked_by,new.locked_at)
       is distinct from
       row(old.id,old.exam_id,old.student_name,old.student_roll,old.page_paths,old.teacher_notes,old.marks_awarded,old.max_marks,old.created_by,old.created_at,old.assigned_checker,old.checked_by,old.locked_by,old.locked_at) then
      raise exception 'Moderators may only change review status and review notes';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_osm_moderator_updates on public.paper_scan_sessions;
create trigger guard_osm_moderator_updates
before update on public.paper_scan_sessions
for each row execute function public.guard_osm_moderator_updates();
