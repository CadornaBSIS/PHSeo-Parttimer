# ViteSeo Parttimer

Internal scheduling and DTR platform for managers and employees. Built with Next.js (App Router), Supabase Auth/Postgres, Tailwind, shadcn-style UI, and server-side PDF exports.

## Features
- Supabase email/password auth (no public sign-up; manager-provisioned accounts only).
- Role-aware navigation (manager vs employee).
- Scheduling module (weekly, draft → submit lock, 7-day grid).
- DTR module (actual logs, overnight-aware duration, draft → submit lock).
- Manager monitoring, exports to PDF (schedule & DTR).
- Employee provisioning (manager-only, uses Supabase service role admin).
- Notifications + audit logging.
- Responsive admin UI (dark sidebar, light content with red accents).

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind CSS 3 · shadcn-style UI · Supabase (Auth/Postgres) · React Hook Form + Zod · TanStack Query/Table · date-fns · pdfkit.

## Environment variables
Copy `.env.example` to `.env.local` and fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed to client)
- `NEXT_PUBLIC_SITE_URL` (e.g., http://localhost:3000)

## Setup
```bash
pnpm install
pnpm dev
```

## Database & RLS
- Schema/migrations: `supabase/migrations/001_init.sql`
- RLS enabled on all tables with helper functions `is_manager`, `is_employee`, `owns_schedule`, `owns_dtr`.
- Status rules enforced in policies (employees can edit only drafts; managers can read all).
- Indexes added per spec for common filters.

Apply migration with Supabase CLI or psql:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/001_init.sql
```

## Seeding
Seed uses service role admin (creates auth users + data).
```bash
pnpm seed
```
Demo accounts (created by seed):
- Manager: `manager@viteseo.test` / `Manager123!`
- Employees: `alice@viteseo.test`, `ben@viteseo.test`, `cara@viteseo.test` (password `Employee123!`)

## Auth rules
- No public registration.
- Manager provisions employees via Employees page (server-side service role).
- Protected routes via middleware; manager-only routes: `/employees`, `/reports`, `/api/export/*`, `/settings`.
- Employees see only their own schedules/DTRs (RLS enforced).

## Scripts
- `pnpm dev` – start dev server
- `pnpm build` / `pnpm start`
- `pnpm lint` / `pnpm typecheck`
- `pnpm seed` – seed demo data (requires service key)

## PDFs
- Manager-only export endpoints:
  - `/api/export/schedule/[id]`
  - `/api/export/dtr/[id]`
- Server-side PDFKit, A4 printable with logo placeholder + metadata.

## Implementation notes
- Scheduling and DTR kept as separate modules.
- Draft vs submitted locking enforced in UI + RLS.
- Duration handles overnight (end before start).
- Notifications + audit logs inserted on saves/submits.
- UI components live under `src/components/ui` (button/input/badge/etc).
- Feature code organized under `src/features/*`.

## Next steps
- Add pagination/filter params to list endpoints.
- Add monthly DTR export API and charts.
- Add email notifications via Supabase functions if desired.

## AI commits
Set `GEMINI_API_KEY` in your shell or `.env`, then use:
```bash
git add .
pnpm ai:commit
```

Optional:
- `AI_COMMIT_PROVIDER=gemini` or `AI_COMMIT_PROVIDER=openai`
- `GEMINI_COMMIT_MODEL` overrides the Gemini default (`gemini-2.5-flash`)
- `OPENAI_COMMIT_MODEL` overrides the OpenAI default (`gpt-5.3-codex`)
- `AI_COMMIT_MODEL` overrides either provider-specific model setting
- `pnpm ai:commit --dry-run` prints the generated message without committing
