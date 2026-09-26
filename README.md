# JEE E-Tutor (prototype)

An agentic AI tutor for Class 11-12 students in Hyderabad preparing for JEE Main & Advanced. This prototype covers **one chapter each** in Maths (Quadratic Equations), Physics (Kinematics), and Chemistry (Atomic Structure) end-to-end: a personalized dashboard, a daily study planner, topic-scoped tutor chat, practice with hints, timed weekly tests that alternate JEE Main / Advanced pattern, and an LLM day-close recap.

See [plan.md](./plan.md) for the full design rationale.

## Run it

```bash
npm install
npx prisma migrate deploy   # creates prisma/dev.db
npm run seed                # seeds 2 demo students: arun-demo / student-2 (password: demo1234)
npm run dev
```

Open http://localhost:3000 and sign in as either demo student (buttons on the login page) or a manual username/password.

Live tutoring, hints, and the recap's prose need a free Groq API key:

```bash
# .env.local
GROQ_API_KEY="gsk_..."   # https://console.groq.com/keys
```

Without a key: the dashboard, daily planner, practice, and weekly tests all still fully work (nothing about scoring or mastery depends on the LLM). Chat/hints return a clear "not configured" message, and the day-close recap falls back to a plain templated sentence built from the same stats a live recap would have used.

## Why this shape, not 7 running agents

The use case suggested a multi-agent design (tutor, assessment, performance, gap-analysis, recommendation, memory, orchestrator agents). For one student and three chapters, running each of those as an independent LLM loop would add latency, cost, and debug surface without adding capability. Instead:

- Those seven names became **modules** (`lib/planner.ts`, `lib/assessment.ts`, `lib/mastery.ts`, `lib/recommend.ts`, `lib/tutor.ts`), not independent agents passing messages.
- Everything that produces a *number* on the dashboard (schedule, paper assembly, grading, mastery, gaps, recommendations) is deterministic code over frozen JSON + SQLite — **no LLM**.
- Exactly one LLM surface is live at runtime: the topic-scoped tutor chat (`lib/tutor.ts`), plus two small assist features (hints, day-close recap prose) that use the same single Groq call pattern. One Groq call per student message, never a chain of agents.

## Where the "agent" boundaries actually are

| Concern | Where it lives | LLM? |
|---|---|---|
| Curriculum, lessons, question bank | `content/*.json`, loaded once by `lib/content.ts` | No |
| Daily study-hour planner | `lib/planner.ts` | No |
| Weekly Main/Advanced paper assembly, shuffling, grading | `lib/assessment.ts` | No |
| Mastery score & gap detection | `lib/mastery.ts` | No |
| "What's next" ranking | `lib/recommend.ts` | No |
| Tutor chat (topic-scoped) | `lib/tutor.ts` via `lib/groq.ts` | Yes |
| Practice hints (stem-only, no key) | `lib/hint.ts` | Yes |
| Day-close recap prose | `lib/recap.ts` (falls back to a template without a key) | Yes |

`lib/tools/registry.ts` is the single place that names every lookup (topic lesson, mastery-for-one-topic, last N thread messages, a question's stem) an LLM prompt is ever allowed to pull from — so it's obvious by reading one file what could reach a prompt, and those lookups hit the in-memory content index / an indexed DB query instead of ad hoc re-fetching.

## Topic-scoped chat

Chat is one thread per `(student, topic)`, never per-subject or campus-wide. Opening a different topic starts a new thread with its own context — the prompt only ever contains that topic's lesson, that student's mastery on that topic, and that thread's recent messages. See `lib/prompts/tutor.ts` and the "Topic-scoped chat" section of [plan.md](./plan.md) for the reasoning.

## Swapping the Groq model

Set `GROQ_MODEL` in `.env.local` (defaults to `llama-3.3-70b-versatile`). Any Groq-hosted open-weight chat model works — `lib/groq.ts` is the only place the model name is read.

## Prototype scope / known simplifications

- 1 chapter per subject, ~40-45 questions per chapter — enough to demo the full loop, not a full syllabus.
- Practice draws don't shuffle MCQ options (only the graded weekly paper does, with a server-stored permutation) — a deliberate simplification to avoid client-tamperable state for a low-stakes draw.
- "Matching" questions render as free-text inputs per Column-I label (Column II is shown in the question stem itself, not as a separate structured field).
- No automated test suite yet — verified manually end-to-end against a local dev server (login, dashboard, practice grading, a full weekly-paper submission, day-close → recap).
