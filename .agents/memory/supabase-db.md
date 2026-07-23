---
name: Supabase database preference
description: The user intends to use Supabase as the production database, not Replit's built-in PostgreSQL.
---

The user explicitly stated they will use Supabase for the database, not Replit's built-in PostgreSQL.

**Rule:** When wiring up any database connection, environment variables, or deployment config, use Supabase. Do not suggest or configure Replit's built-in DB for production.

**Why:** User's explicit preference stated during the DAK Transcription build.

**How to apply:** 
- In dev, the Replit DB is fine as a scratch environment (current setup).
- For any deployment or production discussion, point to Supabase and `DATABASE_URL` from Supabase project settings.
- When adding new tables or schema changes, remind the user to run `pnpm --filter @workspace/db run push` against their Supabase `DATABASE_URL`.
- Do not call `checkDatabase()` or reference Replit's database pane for production data.
