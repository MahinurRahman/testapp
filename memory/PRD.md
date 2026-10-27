# Good vs Broken — QA Playground (PRD)

## Original problem statement
An app with 2 parts: every feature has a good and a bad version. At start the user picks Good app or Broken app; in Broken they choose which features fail. Based on the 5 most troublesome mobile bugs (QATestLab).

## User choices
- Demo app: notes & tasks (login, list, editor, save)
- Failures: broken form checks, misbehaving buttons, crashes, rotation data loss, slow & battery-heavy
- No in-app bug explanations in the demo; nothing logged/saved

## Architecture
- Backend FastAPI + MongoDB: /api/notes CRUD, /api/notes/reset (seeds 8 notes on each login)
- Frontend Expo Router: `/` mode select, `/bugs` failure picker, `/demo/login`, `/demo/notes`, `/demo/editor`
- In-memory BugProvider (src/bug-config.tsx) — `isBroken(key)` switches behaviour
- Brutalist design (Space Grotesk + JetBrains Mono), orientation unlocked

## Implemented (2026-06)
- Good mode: full validation, guarded buttons, skeleton loading, FlatList, state survives rotation
- Broken bugs: forms (no validation / silent fail on symbol password), buttons (ignored taps, tiny hit area, wrong-row delete, double save), crash (open completed task / save existing note), rotation (forms remount), slow (CPU freezes, laggy typing, background burn, unvirtualized list)
- Mode badge on every demo screen returns to start
- Tested: backend 11/11, frontend all flows pass

## Backlog
- P1: Persist config across web refresh (optional), more bug types (network offline, memory leak, layout overflow)
- P2: Side-by-side compare view, accessibility states on toggles
