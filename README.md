# Supabase Auth test bed

A Next.js (App Router) project for trying out Supabase authentication
methods side by side before wiring one into production. Each method has its
own test page showing the raw signed-in user (`id`, `email`/`phone`,
`created_at`) so you can visually confirm a flow actually works.

See [`AUTH_SETUP.md`](./AUTH_SETUP.md) for the full build notes: what each
flow needs, the exact dashboard/CLI steps for the Africa's Talking phone-OTP
integration, gotchas hit along the way, and a checklist for porting this into
another app.

## Auth methods

| Method | Route | Status |
|---|---|---|
| Email + password | `/test/email-password` | Works out of the box |
| Email OTP | `/test/email-otp` | Works out of the box |
| Phone OTP (SMS, via Africa's Talking) | `/test/phone-otp` | Needs a Send SMS Auth Hook deployed — see `AUTH_SETUP.md` |
| Google (OAuth) | `/test/google` | Needs Google OAuth credentials in the Supabase dashboard |

`/test/status` checks env vars and client setup at a glance.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + publishable key
npm run dev
```

Open [http://localhost:3000/test](http://localhost:3000/test).

## Stack

- Next.js 16 (App Router, Turbopack) — note: uses `src/proxy.ts`, not
  `middleware.ts` (renamed in Next 16)
- `@supabase/ssr` + `@supabase/supabase-js`
- Tailwind CSS
- A Supabase Edge Function (`supabase/functions/send-sms-hook`) for the
  phone-OTP → Africa's Talking integration
