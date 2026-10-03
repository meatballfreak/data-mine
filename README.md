# Workshop

Workshop trainee portal. Admins create groups and activities; trainees join via a QR code, sign in with Google, and submit answers or file uploads. Built on Next.js + Supabase, deployed to Vercel.

Hosted at: https://data-mine-eight.vercel.app

## Status

Phase 5 of 9 complete. Delivered so far: Google OAuth (Supabase), role-gated admin/trainee dashboards, dark UI shell, core schema + RLS, admin group CRUD, QR-based trainee onboarding (per-group QR codes, `/join/<token>` flow, sign-in redirect preservation), admin activity CRUD (Q&A or file-upload activities with questions editor and multi-group assignment), and trainee submissions (dashboard lists assigned activities with status, `/activities/<id>` lets trainees answer Q&A activities and resubmit). Admin submission review + Drive uploads land in Phases 6–7.

## Deploy setup (hosted on Vercel)

### 1. Create a Supabase project

- New project at [supabase.com](https://supabase.com). From **Project Settings > API**, copy:
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

### 2. Apply the database migration

Recommended (Supabase CLI):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste the files in `supabase/migrations/` into the Supabase **SQL Editor** in order (`0001_init.sql`, `0002_qr_join.sql`, …). All migrations are idempotent.

### 3. Wire Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/), create OAuth 2.0 credentials (Web application):

- Authorized JavaScript origins:
  - `https://data-mine-eight.vercel.app`
- Authorized redirect URIs:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`

Copy the Client ID and Client Secret into **Supabase → Authentication → Providers → Google** and enable it.

In **Supabase → Authentication → URL Configuration**:

- Site URL: `https://data-mine-eight.vercel.app`
- Redirect URLs (allowlist): `https://data-mine-eight.vercel.app/**`

### 4. Set env vars in Vercel

Vercel dashboard → **Project → Settings → Environment Variables**. Add for **Production** (and Preview if you deploy PR previews):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 (mark as "sensitive") |
| `ADMIN_EMAILS` | comma-separated admin emails, case-insensitive |

Redeploy after adding vars so the running instance picks them up.

### 5. Verify

Open https://data-mine-eight.vercel.app — you should be redirected to `/login`. Sign in with an admin email → land on `/admin`. Sign in with any other Google account → land on `/dashboard`.

## Local development (optional)

```bash
cp .env.example .env.local  # then fill in the four vars
npm install
npm run dev
```

Add `http://localhost:3000/**` to Supabase → Auth → URL Configuration → Redirect URLs so local sign-in also works.

## Env vars

| Name | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public `anon` key used by browser and server clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 2+ | Server-only key for admin operations. Not read in Phase 1. |
| `ADMIN_EMAILS` | yes | Comma-separated admin emails, case-insensitive. Matching users are routed to `/admin`. |

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase Auth (`@supabase/ssr`).
