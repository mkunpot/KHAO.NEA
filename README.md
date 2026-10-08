# Second Law · Classroom Demo

**One lesson. One physics model. Three learning experiences. One realtime classroom session.**

A small demo that proves one architecture: a single canonical lesson — *The Second Law of
Thermodynamics*, 15 minutes, introductory university level — rendered three different ways:

| Rendering state | Where | What it shows |
| --- | --- | --- |
| **Presentation** | Projector (1920×1080, [Spectacle](https://github.com/FormidableLabs/spectacle)) | Big type, equations, the simulation, live vote results, progressive reveal. Follows the teacher. |
| **Live Student** | Phone, portrait | Only what a student acts on: the open question (large touch targets) and a compact simulation read-out. Does **not** mirror the slides. |
| **Self-Study** | Any screen, after class | A reading page: objectives, long-form explanations, every equation, a simulation you can push around, expandable answers, a self-check. Needs no backend. |

The classroom is synchronised through Supabase, but only *meaning* is synchronised ("start the
simulation with these parameters"), never animation frames.

> Built for a short demo to **at most ~40 people**. It is deliberately simple; see
> [Security](#security-demo-level) and [Free-tier notes](#free-tier-notes-up-to-40-people).

---

## Quick start

Requires **Node 22.12 or newer**.

```bash
npm install
npm run dev          # http://localhost:5173
```

* **Self-Study works immediately** at `/study` — no Supabase needed.
* **Live classes** (`/create-session`, `/teacher/…`, `/present/…`, `/student/…`) need a free
  Supabase project: follow [Supabase setup](#supabase-setup) (about 5 minutes). Until then those
  screens show a friendly "setup needed" page.

Other scripts: `npm test` · `npm run typecheck` · `npm run build` · `npm run preview` ·
`npm run dev:lan` (reachable from phones on your Wi-Fi).

---

## Running a classroom demo

1. **Teacher creates a session.** Open `/create-session`, press **Create session**. You get a
   6-character code (e.g. `F7K3Q2`) and a QR code.
2. **Open the teacher controller** (button on the same page → `/teacher/F7K3Q2`) on your laptop or tablet.
3. **Open the presentation on the projector** (**Open presentation** → `/present/F7K3Q2`, in its own
   window; press F11 for full screen). The join QR code and code are on every slide.
4. **Students scan the QR code** (or open the link / type the code at `/student`). No account.
   Each phone gets a random name such as *Blue Fox*; the teacher sees how many have joined.
5. **Teacher opens the first question** (**Open question**). Phones show the question at once.
6. **Students respond.** The teacher sees live counts per option (and which is correct); the
   projector shows nothing yet — no peeking.
7. **Results appear live.** **Close question** → **Show results** puts the anonymous aggregate on the
   projector → **Reveal answer** highlights the correct option and the explanation (phones show
   Correct / Not quite).
8. **Teacher continues the lesson** with **Next →** (or the ← → / PageUp / PageDown keys, which is what
   presentation clickers send). **Connect** and **Try reverse** start the simulation on every screen at
   once.

The lesson runs in 7 steps (2 + 3 + 3 + 2 + 2 + 2 + 1 = 15 minutes) and 16 positions (15 presses of **Next**, because
the entropy step reveals itself in stages).

---

## Architecture

```
                         ┌───────────────────────────────┐
                         │   LessonDefinition (data)     │  src/lesson/secondLaw.ts — the ONLY place
                         └──────────────┬────────────────┘  lesson text lives
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
     PresentationRenderer       StudentRenderer            StudyRenderer
     (Spectacle, projector)     (phone)                    (reading page, no backend)
              │                         │
              └───────────┬─────────────┘
                          ▼
              SessionProvider  (roles, optimistic teacher commands, ordering)
                          ▼
              RealtimeAdapter  (interface)  ◀── the only door to a backend
                          ▼
              SupabaseRealtimeAdapter  → Supabase Postgres + Realtime

    Physics:  simulations/thermal-contact/model.ts  (pure functions, no React) → used by all three renderers
```

```
src/
  lesson/            types.ts · secondLaw.ts (the lesson) · cursor.ts (step/reveal positions)
  simulations/thermal-contact/
                     model.ts (pure physics) · types.ts · useThermalContact.ts
                     ThermalContactSimulation.tsx · ThermalBodiesView.tsx · EntropyPanel.tsx
  realtime/          RealtimeAdapter.ts (interface) · SupabaseRealtimeAdapter.ts · events.ts
                     supabaseMapping.ts (row ⇄ record)
  session/           SessionProvider.tsx · sessionReducer.ts · sessionService.ts · identity.ts
  supabase/          client.ts · types.ts
  renderers/         presentation/ · student/ · study/ (+ shared results/useSessionSimulation)
  pages/             Landing · CreateSession · Teacher · Present · Student · Study
supabase/migrations/001_classroom_demo.sql
```

Components never call Supabase. Screens use `useSession()`; the provider talks to a
`RealtimeAdapter`. To move to WebSocket / Socket.IO / Ably / Firebase, write another class that
implements `src/realtime/RealtimeAdapter.ts` — the lesson model and renderers do not change.

---

## Lesson architecture

`src/lesson/types.ts` defines the schema; `src/lesson/secondLaw.ts` is the one lesson. It is plain
data, independent of Spectacle and Supabase:

```
LessonDefinition { metadata, objectives, simulations, questions, steps[], summary }
LessonStep       { id, title, minutes, blocks[] }
Block            concept | equation | simulation | question | explanation | diagram | summary
```

* **Strings may contain inline math** between `$…$` (rendered with KaTeX); equation blocks are LaTeX.
* **Each renderer picks what suits it.** The projector skips long-form `explanation` blocks; phones show
  only the open question and a compact simulation card; Self-Study shows everything.
* **Progressive reveal.** A block can carry `reveal: n` (appears at stage *n* on the projector).
  A simulation block lists its read-outs with the stage at which each appears. The teacher's position
  is a single integer — the *cursor* — over every (step, reveal stage) pair; `current_step` in the
  database is that integer. Entropy (step 3) has 5 stages, so the whole lesson has 16 positions.
* **Questions** live in `lesson.questions` and are referenced by a `question` block. Option ids are
  stored as the answer (`A`–`D`, `yes`/`no`).
* **Editing the lesson** = editing `secondLaw.ts`. The tests then check that the steps still add up to
  15 minutes and that no renderer contains lesson text of its own (see [Tests](#tests)). The lesson text
  and UI are in English; to translate, edit that one file.

---

## Physics model & assumptions

`src/simulations/thermal-contact/model.ts` — pure functions, unit tested, no React.

* **Two identical finite bodies**, each with the same constant heat capacity *C* (default 1.0 kJ/K,
  roughly 2.6 kg of copper), **isolated from the surroundings**. Heat only moves between the two bodies.
* **Temperatures are in kelvin.** Defaults: 400 K and 300 K.
* Final temperature `T_f = (T₁ + T₂) / 2` — here **350 K**.
* Entropy change of one body: `ΔS = C ln(T_f / T_i)`. For the pair:
  `ΔS_total = ΔS₁ + ΔS₂ = C ln[(T₁+T₂)² / (4 T₁ T₂)] ≥ 0`, equal to 0 only when `T₁ = T₂`.
  With the defaults: ΔS_hot = −133.5 J/K, ΔS_cold = +154.2 J/K, **ΔS_total = +20.6 J/K**.
* **Time evolution:** the heat moved follows `Q(t) = Q_full (1 − e^(−t/τ))` — the exact solution for two
  bodies exchanging heat through a fixed conductance. `τ` is only the animation speed (2 s).
* **Try reverse** is a *hypothetical* process: the same heat moves cold → hot (the cold body is never driven
  below half its initial kelvin temperature). Result with the defaults: 450 K / 250 K and
  **ΔS_total = −64.5 J/K** — not allowed for an isolated macroscopic system.
* The lesson avoids defining entropy as "disorder"; it is introduced as the state function whose total
  change decides which direction is possible.

### Why animation frames are local

The state of the simulation is a **pure function of (parameters, mode, time since start)**. So the
network carries one small fact — "run N started: forward, 400 K / 300 K" — and every browser draws
its own frames from it:

* traffic stays tiny (a handful of row updates per lesson, not 60 messages a second per device);
* a phone that sleeps and wakes simply computes the correct state for "now";
* nothing needs to be integrated, so devices cannot drift apart.

Each browser starts its clock when it *receives* the start command (no dependence on device clocks), so
screens are in step to within network latency (~100–300 ms). Reloading mid-run restarts that device's
animation from the beginning.

---

## Realtime design

**Postgres Changes is the only realtime mechanism.** Why:

* The class state is **one row** in `classroom_sessions`. The teacher updates it; every browser
  subscribes to that row. The database is the single source of truth, so a phone that joins late or
  reconnects just re-reads the row (the adapter does this on every (re)subscribe, and the app does it when a
  phone wakes up). There is no event log to replay.
* Answers are `INSERT`s into `responses`; the teacher and the projector subscribe to those inserts.
* **Teacher commands** (`NEXT_STEP`, `OPEN_QUESTION`, `START_SIMULATION`, …) are semantic events
  (`src/realtime/events.ts`). A pure reducer turns the current state + an event into the next state; the
  next state is what gets written. Nothing about UI layout travels over the wire.
* A `version` counter (bumped by the teacher on every change) lets every client ignore anything older
  than what it already holds, so late or re-ordered updates can never move the class backwards. The
  teacher applies a command locally first (instant UI) and publishes in order.

| Supabase feature | Used? | Why |
| --- | --- | --- |
| **Postgres Changes** | **Yes** — session row + response inserts | Durable *and* realtime from one write; simplest to reason about; plenty fast at this size. |
| **Broadcast** | No | Ephemeral — a late joiner would miss it, so the database row is still needed. At ≤ ~40 people the extra latency saving does not justify two mechanisms. Add it *inside* `SupabaseRealtimeAdapter` if you ever need it. |
| **Presence** | No | Participant count is read from the `participants` table (polled every 5 s by the teacher). Presence fans every join out to every client, which is wasteful. |

**Database writes happen only on semantic transitions** (a step change, a question opening, a
simulation starting, an answer) — never per frame.

### Data model (`supabase/migrations/001_classroom_demo.sql`)

* `classroom_sessions` — `id`, `session_code`, `lesson_id`, `current_step`, `question_open`,
  `results_visible`, `status`, `created_at`, `updated_at` (as specified) plus `active_question_id`,
  `answer_revealed`, `sim` (jsonb: `{mode, runId, params}`) and `version`.
* `participants` — `id` (generated in the phone, so a refresh keeps the identity), `session_id`,
  `anonymous_name`, `joined_at`.
* `responses` — `id`, `session_id`, `participant_id`, `question_id`, `answer`, `submitted_at`, with
  `unique (session_id, participant_id, question_id)`: **the first answer wins** and accidental
  double-taps do nothing.

---

## Supabase setup

1. **Create a free project** at [supabase.com](https://supabase.com) → *New project*. Pick a region close to
   the classroom. (You will not need the database password in this app.)
2. **Create the tables, policies and realtime publication.** Dashboard → *SQL Editor* → *New query* →
   paste the whole of [`supabase/migrations/001_classroom_demo.sql`](supabase/migrations/001_classroom_demo.sql)
   → *Run*. It is safe to run twice. (With the Supabase CLI: `supabase db push`.)
3. **Realtime needs no toggle.** The migration adds `classroom_sessions` and `responses` to the
   `supabase_realtime` publication. To double-check, run
   `select tablename from pg_publication_tables where pubname = 'supabase_realtime';` — it should list both.
4. **Copy the keys.** *Project Settings → API Keys*: the **Project URL** and the **publishable key**
   (`sb_publishable_…`). Projects that only have the legacy key can use the `anon` key instead
   (Supabase is retiring the legacy `anon` / `service_role` keys by the end of 2026; publishable keys are
   the replacement).
5. **Create `.env.local`** (see below) and restart `npm run dev`.

No sign-in providers need to be enabled: the app uses no Supabase Auth.

### Environment variables

Copy `.env.example` to `.env.local` (git-ignored; never commit real credentials):

| Variable | Meaning |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **publishable** (or legacy anon) key (`VITE_SUPABASE_PUBLISHABLE_KEY` is accepted as an alias). Safe in the browser. **Never** put a secret key or the `service_role` key here — nothing in this repo uses one. |
| `VITE_PUBLIC_BASE_URL` | Optional. The origin phones must open (join link + QR). Needed when the teacher page runs on `localhost`. |

---

## Local development

```bash
npm run dev        # localhost only
npm run dev:lan    # also reachable from phones on the same Wi-Fi
```

A phone cannot open `localhost`. For a local classroom test, start `npm run dev:lan`, open the page via
your computer's LAN address (e.g. `http://192.168.1.20:5173`) **or** set
`VITE_PUBLIC_BASE_URL=http://192.168.1.20:5173` in `.env.local`, then create a new session. (The create
page warns you when the join link points at `localhost`.) A deployed site needs none of this.

Phones on plain `http://` work too: participant ids are generated with a fallback for the secure-context-only
`crypto.randomUUID`.

---

## Deployment

It is a static single-page app — build once, host anywhere:

```bash
npm run build      # → dist/
```

* **Vercel:** import the repo (Vite is detected), add the two `VITE_SUPABASE_*` variables, deploy.
  [`vercel.json`](vercel.json) rewrites every path to `index.html` so `/student/F7K3Q2` works.
* **Cloudflare Pages:** build command `npm run build`, output directory `dist`, add the two variables.
  [`public/_redirects`](public/_redirects) provides the same single-page fallback.

Variables are baked in at build time: change them → redeploy. Supabase is the only backend.

---

## Spectacle usage

```
LessonDefinition → PresentationRenderer → Spectacle
```

* One `<Slide>` per lesson step is **generated** from the definition — no slide files, no lesson text in
  Spectacle code. The deck canvas is 1920×1080 (`theme.size`) and scales to any display.
* **The teacher drives it**, not Spectacle: a small `DeckSync` calls Spectacle's `skipTo()` whenever the
  session's slide changes. Reveal stages inside a slide are a CSS fade controlled by the session cursor.
* The deck is created with Spectacle's `disableInteractivity` (no arrow-key navigation, no writes to the URL
  or history), and key events are stopped before Spectacle sees them — a stray key on the projector laptop
  cannot move the slide or switch Spectacle modes. Browser shortcuts such as F11 are untouched.
* Spectacle is only loaded for `/present` (route-level code splitting, ~400 kB gzip); phones and Self-Study
  never download it.
* `.npmrc` sets `legacy-peer-deps=true`: Spectacle depends on the full `react-spring` umbrella, whose
  optional renderers would otherwise pull in react-native/three/konva as peers (a few hundred extra packages).
* Keep the presentation in **its own window** (not a background tab): browsers pause animations in hidden tabs.

---

## Free-tier notes (up to ~40 people)

Supabase's documented Realtime limits on the Free plan are **200 concurrent connections, 100 messages per
second and 256 KB per message**. A class of 40 is far below them:

* **≈ 42 connections** (40 phones + teacher + projector; the limit is 200).
* **One teacher action ≈ 42 messages at once** (one row change delivered to every subscriber) against 100/s.
* **≈ 2,300 messages for the whole lesson** (my estimate: ~45 state changes × 42 receivers, plus ~400
  for answers going to two subscribers). Animation frames add **nothing**.
* Students do not subscribe to answers — only the teacher and projector do.

Two practical tips: Supabase may **pause free projects that have been idle for a while** — open the dashboard
the day before and restore it if needed; and a school network that blocks WebSockets (`wss://…supabase.co`)
will stop live updates, so test on the real network once.

If you later teach hundreds of people at once, move the fan-out to Broadcast (inside `SupabaseRealtimeAdapter`).

---

## Security (demo-level)

You asked not to worry about security for this first stage, so it is **intentionally open**:

* The browser uses only the publishable/anon key. **No service-role/secret key exists anywhere in this repo.**
* Row Level Security is on for all three tables. Students (anyone with the anon key) **cannot** edit or delete
  participants or responses, an answer is **only accepted while its question is open**, and there is one answer
  per participant per question.
* **Not protected:** anyone who has the anon key and knows a session can change that session's state, and
  responses are readable by anyone (they are anonymous). Students are kept out of teacher controls by the
  frontend (`SessionProvider` rejects teacher commands from any other role), not by the database.

### Hardening (when you want it)

Restrict state changes to the teacher with a one-line sign-in. Enable *Authentication → Sign In / Providers →
Anonymous sign-ins*, then run (verified against a Postgres engine):

```sql
alter table public.classroom_sessions add column if not exists teacher_id uuid default auth.uid();

drop policy if exists "sessions can be created" on public.classroom_sessions;
drop policy if exists "sessions can be updated (demo-level)" on public.classroom_sessions;

create policy "teachers create sessions"
  on public.classroom_sessions for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "only the teacher updates a session"
  on public.classroom_sessions for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

revoke insert, update on public.classroom_sessions from anon;
```

In the app, call `supabase.auth.signInAnonymously()` once on the create/teacher pages (and set
`persistSession: true` in `src/supabase/client.ts` for that client). Only the browser that created a session can then
control it. Students stay anonymous and keep working unchanged. (Supabase rate-limits anonymous sign-ins per IP, which
is fine because only the teacher signs in.)

---

## Tests

```bash
npm test           # Vitest
npm run typecheck
```

What is covered (57 tests):

1. **Physics** — T₁ = 400 K, T₂ = 300 K gives T_f = 350 K; ΔS_total > 0; T₁ = T₂ gives ΔS_total = 0; swapping the
   bodies gives the same equilibrium; closed form; energy conservation and monotonic entropy over time; the
   reverse process; input validation.
2. **Student cannot change teacher-controlled state** — through the session layer a student or the projector can
   neither publish a state change nor submit as a teacher (`SessionProvider.test.tsx`); the migration's RLS rules
   were exercised on a real Postgres engine (see below).
3. **One canonical lesson drives all three renderers** — a fixture lesson of unique sentinel strings is rendered by
   the Presentation, Student and Study renderers; a source scan fails if any renderer/page repeats a sentence of
   the lesson; the lesson adds up to 15 minutes.
4. **Session logic** — the reducer, ordering, first-answer-wins (including a fast double-tap), results tally.
5. **SQL ⇄ adapter contract** — every column the teacher writes exists in the migration; rows map to records and back.

### What has and has not been verified

Verified: type-check, all unit tests, production build, the migration (fresh and re-run) and its RLS behaviour on a real
Postgres engine (PGlite), the hardening snippet, and all three screens plus the teacher controller driven end to end in a
browser against an in-memory adapter.

**Also verified against a real Supabase project** (free plan, Seoul region; migration applied through the SQL Editor):
with the teacher controller, the projector and a phone view open as three browser tabs — create a session; the phone joins
(participant row written, teacher sees "1 joined"); the teacher opens a question and the phone shows it within about a second
(Postgres Changes on the session row); the phone answers and the teacher's count updates (Postgres Changes on `responses`);
close → show results → reveal answer reach the projector and the phone; **Next** and **Connect** reach every screen and the
simulation runs on both with matching values; reloading the phone mid-lesson returns to the current step with the same
name and without a duplicate participant.

**Not yet verified:** several physical phones at once, scanning the QR code with a phone camera, and a real school network
(some block WebSockets). Before the class, do a 5-minute rehearsal on that network with your own phone: create a session,
open `/present/CODE` in a second window, join from the phone, open a question, answer, close, show results, press Next.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Live classes are not set up yet" | `.env.local` missing or not filled in; restart `npm run dev` after editing it. |
| "No class with code …" | Wrong code, or the migration was not run in *this* project. |
| Screens load but never update | `classroom_sessions` / `responses` missing from the `supabase_realtime` publication (step 3 above), or a network that blocks WebSockets. |
| The QR code opens `localhost` | Set `VITE_PUBLIC_BASE_URL` (or use `npm run dev:lan`) and create a new session. |
| An answer is "not counted" | The question had just been closed — answers are only accepted while it is open. |
| Projector slides freeze | The presentation is in a background tab; give it its own window. |
| `npm install` prints deprecation notices | They come from Spectacle's transitive dependencies; harmless. |

---

## Third-party licenses

Every runtime dependency (the whole production tree, checked with `license-checker`) is permissive: MIT (React, React
Router, Spectacle, KaTeX, supabase-js and most of the rest) · ISC (`qrcode.react`) · Apache-2.0 (a few Spectacle
transitive packages) · BSD / 0BSD / CC0. Dev tooling: MIT (Vite, Tailwind, Vitest) and Apache-2.0 (TypeScript). The three typefaces — Fraunces, Instrument Sans, Martian Mono — are SIL OFL 1.1, bundled locally
through Fontsource, so the app makes **no third-party network requests** at runtime (important on a classroom network).
