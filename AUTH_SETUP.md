# Auth setup notes

Reference for what each auth flow in this project needs, and how to port it
into another Next.js + Supabase project.

For the detailed runbook and a troubleshooting table of every error hit
while building this (401s, `phone_provider_disabled`, key propagation
delays, etc.), see the Claude Code skill at
[`.claude/skills/supabase-auth-setup/`](./.claude/skills/supabase-auth-setup/SKILL.md)
— it's written to be portable into other projects, so it's the canonical
copy of that material.

## Stack notes

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (exported function
  `middleware` → `proxy`, same location). This project uses `src/proxy.ts`.
  If porting into an app on an older Next.js version, rename back.
- **Supabase's client-safe key is called the "publishable key"** on newer
  projects (`sb_publishable_...`), not "anon key." Same slot, newer label —
  check what the target project's dashboard actually shows before naming
  the env var.

## File map

```
.env.local                                   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (gitignored)
.env.local.example                           # template with empty values, tracked in git
src/utils/supabase/client.ts                 # browser client (createBrowserClient)
src/utils/supabase/server.ts                 # server client for Server Components/Route Handlers (cookies-based)
src/utils/supabase/proxy.ts                  # updateSession() — refreshes the auth token on every request
src/proxy.ts                                 # Next.js proxy entrypoint, calls updateSession()
src/utils/supabase/status-check.ts           # try/catch wrapper so /test/status doesn't crash if env vars are missing
src/components/UserStatus.tsx                # shared "signed in as..." card + sign-out button
src/app/auth/callback/route.ts               # OAuth code-exchange route (Google flow lands here)
src/app/test/page.tsx                        # index linking to all 5 test pages
src/app/test/email-password/page.tsx
src/app/test/email-otp/page.tsx
src/app/test/phone-otp/page.tsx
src/app/test/google/page.tsx
src/app/test/status/page.tsx                 # env var + client sanity checks, manual setup checklist
supabase/functions/send-sms-hook/index.ts    # Edge Function: Supabase "Send SMS" Auth Hook → Africa's Talking
supabase/config.toml                         # from `supabase init` — no secrets in it, safe to commit
```

Every auth page follows the same shape: local component state for
email/phone/code inputs, a `createClient()` call guarded with try/catch (so
the page renders even before `.env.local` is filled in), and `UserStatus`
rendered once `supabase.auth.getUser()` returns a user.

## Flow 1 & 2 — Email + password, Email OTP

Work out of the box once `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set. No dashboard config needed
beyond having a Supabase project — email provider and email OTP are on by
default. Uses `supabase.auth.signUp` / `signInWithPassword` /
`signInWithOtp({ email })` / `verifyOtp({ email, token, type: "email" })`.

## Flow 3 — Phone OTP via Africa's Talking (sandbox)

Supabase has no built-in Africa's Talking provider (only Twilio,
Twilio Verify, MessageBird, Vonage, TextLocal). Integration path is
Supabase's **Send SMS Auth Hook** — a webhook Supabase calls instead of a
built-in provider. Implemented as a Supabase Edge Function
(`supabase/functions/send-sms-hook`) that verifies the Standard Webhooks
signature and forwards the OTP to Africa's Talking's sandbox API.

Setup, in order:

1. Get the sandbox API key from **inside the Sandbox app specifically**
   (account.africastalking.com/apps/sandbox → Settings → API Key) — a key
   copied from a live/production AT app will not work with `username=sandbox`.
2. `supabase login` (needs a real interactive terminal).
3. `supabase init` (once per project directory) → `supabase link --project-ref <ref>`
4. `supabase secrets set AFRICASTALKING_API_KEY=<sandbox key>`
5. `supabase functions deploy send-sms-hook --no-verify-jwt`
6. Dashboard → **Authentication → Sign In / Providers → Phone** → enable.
7. Dashboard → **Authentication → Auth Hooks → Send SMS hook** → enable,
   HTTPS, paste `https://<project-ref>.supabase.co/functions/v1/send-sms-hook`.
   Copy the generated `v1,whsec_...` secret.
8. `supabase secrets set SEND_SMS_HOOK_SECRET=<that value>`

Where the OTP actually lands in sandbox mode (never a real phone): the
[AT Simulator](https://simulator.africastalking.com:1517/), or faster, the
AT dashboard's **SMS** tab, which logs every send including the message body.

**To go to production**: swap the function's endpoint to
`https://api.africastalking.com/version1/messaging`, use the live app's own
API key and username (not `sandbox`), and redo steps 4–8 with production
values.

## Flow 4 — Google (social login)

Code is built (`/test/google`, `signInWithOAuth`, and
`src/app/auth/callback/route.ts` for the code exchange); dashboard config is
manual and outstanding:

1. **Google Cloud Console** → OAuth consent screen (External) → Credentials
   → Create Credentials → OAuth client ID (Web application). Authorized
   redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   (Supabase's own callback — different from this app's `/auth/callback`
   route). Copy the Client ID and Client Secret.
2. **Supabase dashboard** → Authentication → Sign In / Providers → Google →
   enable, paste Client ID + Client Secret.
3. **Supabase dashboard** → Authentication → URL Configuration → Redirect
   URLs → add `http://localhost:3000/auth/callback` (and the production URL
   later). Without this, Supabase finishes the Google handshake but refuses
   the final redirect back to the app.

## Porting checklist for a new project

1. Copy `src/utils/supabase/*`, `src/proxy.ts`, `src/components/UserStatus.tsx`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
   the new project.
3. For phone OTP: copy `supabase/functions/send-sms-hook`, then repeat the
   Dashboard/CLI steps above against the new project ref (own secrets, own
   hook URL, own hook secret — none of these transfer between projects).
4. For Google: configure OAuth credentials fresh per project (redirect URIs
   are project-specific).
