# Supabase Auth test project — what was built and how

This project is a working reference for wiring Supabase Auth into a Next.js
(App Router) app, covering four sign-in methods side by side. Built to be
tried out here first, then ported into a real app (MSRH) once each flow is
confirmed working.

Supabase project used: `mbzzmxcpzsplredehryj` (https://mbzzmxcpzsplredehryj.supabase.co)

## Stack notes that matter for porting this elsewhere

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (exported function
  `middleware` → `proxy`). This project uses `src/proxy.ts`, not
  `middleware.ts`. If the target app is on an older Next.js version, rename
  back and check whether it still needs the old convention.
- **Supabase's client-safe key is now called the "publishable key"**, not
  "anon key," on newer projects (format `sb_publishable_...`). Env var here
  is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Older Supabase projects may still only show "anon key" — same purpose,
  goes in the same slot.

## File map

```
.env.local                                   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (gitignored)
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
built-in provider, fully replacing that path.

**Code**: `supabase/functions/send-sms-hook/index.ts` (Deno Edge Function)
1. Verifies the incoming request using the `standardwebhooks` library — the
   same signing convention Svix uses (`webhook-id` / `webhook-timestamp` /
   `webhook-signature` headers, HMAC-SHA256 over `id.timestamp.body`).
2. Reads `{ user: { phone }, sms: { otp } }` from the verified payload.
3. POSTs to Africa's Talking's sandbox endpoint
   (`https://api.sandbox.africastalking.com/version1/messaging`) with
   `apiKey` header + form-encoded `username=sandbox&to=...&message=...`.
4. Returns `{}` / HTTP 200 on success, or `{ error: { http_code, message } }`
   on failure — this is the exact contract Supabase's hook system expects.

**Dashboard/CLI steps required** (all manual, account-specific — this is the
part to redo per project when porting):
1. Get the sandbox API key from **inside the Sandbox app specifically**
   (account.africastalking.com/apps/sandbox → Settings → API Key). The key
   from your live/production AT app will NOT work with `username=sandbox` —
   Africa's Talking returns a generic `401 The supplied authentication is
   invalid` if you use the wrong one. Freshly generated/rotated keys can also
   take ~15–20s to propagate before they start working.
2. `supabase login` (needs a real interactive terminal — the automatic
   browser flow doesn't work over SSH/non-TTY sessions).
3. `supabase init` (only needed once per project directory).
4. `supabase link --project-ref <project-ref>`
5. `supabase secrets set AFRICASTALKING_API_KEY=<sandbox key>`
6. `supabase functions deploy send-sms-hook --no-verify-jwt` — the
   `--no-verify-jwt` flag matters: Supabase's hook caller doesn't send a user
   JWT, it sends the Standard Webhooks signature instead, so default JWT
   verification would reject every legitimate call.
7. Dashboard → **Authentication → Sign In / Providers → Phone** → enable the
   toggle. (Menu got renamed from "Providers" at some point — if instructions
   elsewhere say "Providers → Phone" and you don't see that, look for
   "Sign In / Providers" instead. Skipping this step produces a
   `phone_provider_disabled` error even with the hook fully configured.)
8. Dashboard → **Authentication → Auth Hooks → Send SMS hook** → enable,
   type HTTPS, paste the deployed function URL
   (`https://<project-ref>.supabase.co/functions/v1/send-sms-hook`).
   Supabase generates a secret (`v1,whsec_...`) at this point.
9. `supabase secrets set SEND_SMS_HOOK_SECRET=<that v1,whsec_... value>`

**Where the OTP actually lands in sandbox mode** — it never reaches a real
phone. Check either:
- The AT Simulator: https://simulator.africastalking.com:1517/ (register the
  test number as a virtual device for your browser session), or
- AT dashboard → **SMS** tab, which logs every sandbox send including the
  message body — usually faster than the simulator.

**To go from sandbox to production**: swap the Edge Function's endpoint to
`https://api.africastalking.com/version1/messaging`, use the live app's own
API key and username (not `sandbox`), and re-run steps 5–9 with production
values.

**Debugging tip**: this CLI version (`supabase 2.113.0`) has no
`functions logs` command. To test the Edge Function in isolation (bypassing
Supabase Auth's generic error wrapper, which hides the function's actual
error message), sign a test payload yourself and POST it directly — see the
Python snippet pattern used during development: build
`{user: {phone}, sms: {otp}}`, sign with
`HMAC-SHA256(base64decode(secret_after_stripping_"v1,whsec_"), "{msg_id}.{timestamp}.{payload}")`,
send as `webhook-signature: v1,<base64 sig>` plus `webhook-id` /
`webhook-timestamp` headers.

## Flow 4 — Google (social login)

Scaffolded (`/test/google`, `signInWithOAuth({ provider: "google" })`, and
`src/app/auth/callback/route.ts` to exchange the OAuth code for a session)
but **not configured** in this session — needs a Google Cloud OAuth client
ID/secret pasted into Dashboard → Authentication → Sign In / Providers →
Google, plus Supabase's callback URL added on the Google Cloud side.

## Porting checklist for a new project

1. Copy `src/utils/supabase/*`, `src/proxy.ts`, `src/components/UserStatus.tsx`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
   the new project.
3. For phone OTP: copy `supabase/functions/send-sms-hook`, then repeat the
   Dashboard/CLI steps above against the new project ref (own secrets, own
   hook URL, own hook secret — none of these transfer between projects).
4. For Google: configure OAuth credentials fresh per project (redirect URIs
   are project-specific).
