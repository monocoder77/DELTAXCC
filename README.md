# DeltaX College Consulting

Marketing site plus the student/counselor portal, deployed on Vercel.

- `public/`: the marketing site (static HTML, `public/css/styles.css`, `public/js/main.js`). Next.js serves it at `/`, `/pricing`, `/faq`, `/contact`.
- `src/`: the portal (Next.js App Router + Supabase).
  - `/portal`: signed-in portal (students and counselors).
  - `/portal/login`: sign in. Counselors create student accounts from the Students screen.
  - `/portal/demo`: the full portal on fictional sample data, no login. Switch between student and counselor views in the banner.

## Portal structure

- `src/lib/backend/types.ts`: every read and write the portal makes. Two implementations: `supabase.ts` (production) and `demo.ts` (in-memory sample data from `demo-data.ts`).
- `src/lib/hooks.ts`: data hooks used by every screen (loading/error state, optimistic updates, cross-screen refresh).
- `src/components/portal/`: the shell (`PortalApp.tsx`), screens, and UI primitives in `ui/`.

## Database

Run `supabase-migrate-portal-v2.sql` once in the Supabase SQL Editor (safe to re-run). It fixes the recursive profile policy, adds the permissions the portal needs, sets up the private `student-files` storage bucket, enables realtime messages, and enforces essay and task rules on the server.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, used by `/api/create-student`)

## Development

```bash
npm install
npm run dev     # http://localhost:3000/portal/demo works without Supabase
npm run lint
npm run build
```
