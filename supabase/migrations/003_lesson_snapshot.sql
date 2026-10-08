-- ============================================================================
-- 003 · Lesson snapshot (lets a teacher run an edited version of the lesson)
--
-- Additive and optional: run it on top of 001 (and 002), and re-run it freely. Nothing is dropped or rewritten.
--
--   lesson_json   null = the lesson that ships with the app (looked up by lesson_id).
--                 Not null = a complete copy of the teacher's edited lesson, written once when the session
--                 is created. The projector and every phone read it from the session row, so a class never
--                 mixes the edited wording with somebody's built-in text.
--
-- Sessions that use the built-in lesson never write this column, so the app also works on a database
-- that has not run this file; only creating a session with an EDITED lesson needs it.
--
-- How to run: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- ============================================================================

alter table public.classroom_sessions
  add column if not exists lesson_json jsonb;
