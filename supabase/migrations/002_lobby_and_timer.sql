-- ============================================================================
-- 002 · Lobby + question timer
--
-- Additive: run it on top of 001 (and re-run it freely). Nothing is dropped or rewritten.
--
--   started           false until the teacher presses "Start lesson". Until then the projector shows
--                     the lobby (join code + the names of whoever has joined) and phones show "You're in".
--   question_timer_s  length of the open question in seconds (0 = untimed). Every screen shows the
--                     countdown; the teacher's screen closes the question when it reaches zero.
--   participants      joins the realtime publication so the projector can show names as people join.
--
-- How to run: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- ============================================================================

alter table public.classroom_sessions
  add column if not exists started boolean not null default false,
  add column if not exists question_timer_s integer not null default 0
    check (question_timer_s between 0 and 600);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end
$$;
