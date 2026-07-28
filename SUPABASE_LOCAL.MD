# Local Supabase Development

Taskline runs fully locally against the Supabase CLI stack. The database, auth,
and mail-capture all live in Docker containers managed by `supabase start`.

> Taskline uses ports **54340–54349** so it can run alongside other local
> Supabase projects (`app` uses 5432x, `sourcebridge` uses 5433x).

## Daily workflow

```bash
supabase start     # from the repo root — boots db/auth/studio/mailpit
npm run dev        # app on http://localhost:5173
```

`supabase stop` shuts the stack down (data persists in a Docker volume).

## Services

| Service            | URL                                                     |
| ------------------ | ------------------------------------------------------- |
| API / Auth         | http://127.0.0.1:54341                                  |
| Postgres           | postgresql://postgres:postgres@127.0.0.1:54342/postgres |
| Studio (DB UI)     | http://127.0.0.1:54343                                  |
| Mailpit (emails)   | http://127.0.0.1:54344                                  |

## Environment

`.env` points at the local stack (see `.env.example` for the shape). The
anon/service-role keys are the Supabase CLI's **shared local-dev defaults** —
identical on every machine, not secrets. Cloud/production values are kept in
`.env.cloud.backup`; swap the files to target the hosted database again.

## Notes

- Prisma migrations: `npx prisma migrate deploy` (direct connection, no pooler).
- Signups are open locally and email confirmation is disabled
  (`supabase/config.toml` → `[auth.email] enable_confirmations = false`).
  Any confirmation/reset emails that do get sent land in Mailpit.
- First login auto-creates the app's `User` row (`src/hooks.server.ts`).
- Prod-parity containerized run: `docker compose up --build` — see
  `docker-compose.yml` for the host-networking requirement.
