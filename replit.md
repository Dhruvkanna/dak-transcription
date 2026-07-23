# DAK Transcription

A professional audio/video processing SaaS with four AI tools: Transcription, Subtitling, Captioning, and AI Dubbing. Uses a credit-based billing system (Rs.) with team management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/dak-transcription run dev` — run the frontend (served at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Wouter, Tailwind CSS v4
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — DB tables: `jobs.ts`, `wallet.ts`, `team.ts`
- `artifacts/api-server/src/routes/` — Express routes: `jobs.ts`, `wallet.ts`, `dashboard.ts`, `team.ts`
- `artifacts/dak-transcription/src/` — React frontend

## Architecture decisions

- Job lifecycle is simulated with setTimeout in the API server (pending → processing → completed in ~7s). Replace with a real worker queue (BullMQ/Inngest) for production.
- Wallet is a single-row table (no user auth yet). Extend with a users table when adding auth.
- Credit deduction happens on job completion, not on submission. Credits are held conceptually but not locked.
- No real file storage — file upload UI uses a filename + manual duration input as a stand-in for a real upload pipeline (Whisper/ElevenLabs APIs).
- Dark mode is toggled via next-themes with class-based CSS variable switching.

## Product

- **Transcription** — Upload audio/video, get plain text output. Rs. 5/min.
- **Subtitling** — Upload audio/video, get SRT/VTT subtitle file. Rs. 8/min.
- **Captioning** — Upload audio/video, get MP4 with burned-in captions. Rs. 12/min.
- **AI Dubbing** — Upload audio/video + select target language, get dubbed MP4/MP3. Rs. 50/min.
- **Dashboard** — Live stats, recent activity feed, jobs-by-type breakdown.
- **History** — Filterable table of all past jobs with download links.
- **Billing** — Wallet balance, top-up form, transaction history.

## Credit pricing

| Tool | Rs./min | API cost/min | Margin |
|------|---------|--------------|--------|
| Transcription | 5 | 0.50 | 9x |
| Subtitling | 8 | 0.50 | 15x |
| Captioning | 12 | 0.50 | ~20x |
| AI Dubbing | 50 | 8.40 | 6x |

## Gotchas

- After any `lib/*` change, run `pnpm run typecheck:libs` before running the API server typecheck — stale declarations cause false "no exported member" errors.
- After OpenAPI spec changes, always re-run `pnpm --filter @workspace/api-spec run codegen` before touching routes or frontend hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
