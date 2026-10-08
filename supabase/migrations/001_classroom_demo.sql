-- ============================================================================
-- Classroom demo schema: sessions, participants, responses  (+ Realtime + RLS)
--
-- How to run: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- (Or `supabase db push` if you use the Supabase CLI.) It is safe to run more than once.
--
-- SECURITY LEVEL: DEMO. There is no login. The anon key is public by design, so
-- anyone who has it and knows a session can change that session's state. The policies
-- below still enforce the rules that matter for a classroom run:
--   * students cannot edit or delete participants/responses
--   * an answer is only accepted while its question is open
--   * one answer per participant per question (first answer wins)
-- See "Hardening" in the README for how to restrict state changes to the teacher.
-- ============================================================================


-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.classroom_sessions (
  id                uuid primary key default gen_random_uuid(),
  session_code      text not null unique check (session_code ~ '^[A-Z0-9]{6}$'),
  lesson_id         text not null,
  -- Flat cursor over (lesson step, reveal stage). Meaning is defined by the lesson, not by the DB.
  current_step      integer not null default 0 check (current_step >= 0),
  question_open     boolean not null default false,
  active_question_id text,
  answer_revealed   boolean not null default false,
  results_visible   boolean not null default false,
  -- Semantic simulation state: {"mode":"idle|forward|reverse","runId":<ms>,"params":{...}}.
  -- Only transitions are stored here; animation frames are computed locally in each browser.
  sim               jsonb not null default '{"mode":"idle"}'::jsonb,
  -- Counter the teacher's browser bumps on every change. Clients ignore anything older than what
  -- they already hold, so a late or re-ordered update can never move the class backwards.
  version           integer not null default 0,
  status            text not null default 'active' check (status in ('active', 'ended')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.participants (
  -- Generated in the student's browser, so a page refresh keeps the same identity.
  id              uuid primary key,
  session_id      uuid not null references public.classroom_sessions (id) on delete cascade,
  anonymous_name  text not null check (char_length(anonymous_name) between 1 and 40),
  joined_at       timestamptz not null default now()
);

create table if not exists public.responses (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.classroom_sessions (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  question_id     text not null,
  answer          text not null check (char_length(answer) between 1 and 16),
  submitted_at    timestamptz not null default now(),
  -- Prevents accidental duplicate answers: the first one wins.
  unique (session_id, participant_id, question_id)
);

create index if not exists participants_session_idx on public.participants (session_id);
create index if not exists responses_session_question_idx on public.responses (session_id, question_id);


-- ── updated_at ──────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists classroom_sessions_touch_updated_at on public.classroom_sessions;
create trigger classroom_sessions_touch_updated_at
  before update on public.classroom_sessions
  for each row execute function public.touch_updated_at();


-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.classroom_sessions enable row level security;
alter table public.participants       enable row level security;
alter table public.responses          enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.classroom_sessions to anon, authenticated;
grant select, insert         on public.participants       to anon, authenticated;
grant select, insert         on public.responses          to anon, authenticated;

-- classroom_sessions: readable by everyone (students look a session up by its code);
-- anyone may create one; updates are open in this demo (see the note at the top).
drop policy if exists "sessions are readable" on public.classroom_sessions;
create policy "sessions are readable"
  on public.classroom_sessions for select to anon, authenticated
  using (true);

drop policy if exists "sessions can be created" on public.classroom_sessions;
create policy "sessions can be created"
  on public.classroom_sessions for insert to anon, authenticated
  with check (true);

drop policy if exists "sessions can be updated (demo-level)" on public.classroom_sessions;
create policy "sessions can be updated (demo-level)"
  on public.classroom_sessions for update to anon, authenticated
  using (true) with check (true);

-- participants: anonymous join into an active session. No update, no delete.
drop policy if exists "participants are readable" on public.participants;
create policy "participants are readable"
  on public.participants for select to anon, authenticated
  using (true);

drop policy if exists "participants can join active sessions" on public.participants;
create policy "participants can join active sessions"
  on public.participants for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.classroom_sessions s
      where s.id = session_id and s.status = 'active'
    )
  );

-- responses: answers are anonymous, so reading them is open; inserting is only allowed
-- while that exact question is open. No update, no delete.
drop policy if exists "responses are readable" on public.responses;
create policy "responses are readable"
  on public.responses for select to anon, authenticated
  using (true);

drop policy if exists "responses can be submitted while the question is open" on public.responses;
create policy "responses can be submitted while the question is open"
  on public.responses for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.classroom_sessions s
      where s.id = session_id
        and s.question_open
        and s.active_question_id = question_id
    )
  );


-- ── Realtime (Postgres Changes) ─────────────────────────────────────────────
-- Every client subscribes to its session row; the teacher/presentation also subscribe to
-- response inserts. Nothing else is replicated.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classroom_sessions'
  ) then
    alter publication supabase_realtime add table public.classroom_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'responses'
  ) then
    alter publication supabase_realtime add table public.responses;
  end if;
end
$$;
