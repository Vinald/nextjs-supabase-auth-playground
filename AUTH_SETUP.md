# Supabase Auth test project — what was built and how

This project is a working reference for wiring Supabase Auth into a Next.js
(App Router) app, covering four sign-in methods side by side. Built to be
tried out here first, then ported into a real app (MSRH) once each flow is
confirmed working.

Supabase project used: `mbzzmxcpzsplredehryj` (https://mbzzmxcpzsplredehryj.supabase.co)

## Setup process (chronological)

This is the actual sequence of work, including the dead ends — kept because
the debugging steps are as reusable as the working code when this gets
ported into another project.

### 1. Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install @supabase/supabase-js @supabase/ssr
```

Landed on Next.js 16, which turned out to matter (see below).

### 2. Supabase SSR client helpers

Checked Supabase's current official Next.js example (`supabase/supabase`
repo, `examples/auth/nextjs-full`) rather than assuming the pattern, since
it's changed across versions. Two things had changed since older
tutorials/docs:

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (exported function
  `middleware` → `proxy`). Using `middleware.ts` on Next 16 triggers a
  deprecation error. Built `src/proxy.ts` + `src/utils/supabase/proxy.ts`
  (the `updateSession()` helper) instead.
- Supabase's official example now names the client-safe key
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not `_ANON_KEY` — see step 5.

Also built `src/utils/supabase/client.ts` (browser client) and
`src/utils/supabase/server.ts` (server client, cookies-based) following that
same example.

### 3. Test pages

Built one page per auth method under `src/app/test/`, an index page, and a
`/test/status` diagnostics page — all sharing a `UserStatus` component that
renders `id` / `email` or `phone` / `created_at` once
`supabase.auth.getUser()` resolves.

### 4. First run — crash on every request

With `.env.local` intentionally left empty (per the original ask — no fake
placeholder values), every request 500'd: `createServerClient` and
`createBrowserClient` both throw synchronously when the URL/key args are
empty strings, and that throw happened inside `src/proxy.ts`, which runs on
*every* request — so even the `/test` index page 500'd before the empty-env
case could be explained anywhere.

Fixed by making the proxy skip session refresh entirely when the env vars
are unset, and wrapping each page's `createClient()` call in try/catch so
missing config degrades to a "not configured, see /test/status" message
instead of crashing the page. This was necessary to satisfy "confirm the app
starts and /test loads without errors" while still following "don't invent
placeholder values."

### 5. Connected the real Supabase project

Given the real Project URL and a key named `sb_publishable_...`. This
confirmed the dashboard now calls it the **publishable key**, not the
**anon key** — functionally the same client-safe key, new name on newer
projects. Renamed `NEXT_PUBLIC_SUPABASE_ANON_KEY` →
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` across every file that referenced it,
to match what's actually in the dashboard rather than force an older naming
convention. Verified via `/test/status` (all three checks green) and a live
`/test/email-password` sign-up round-trip in the browser, which returned a
real Supabase Auth validation error — proof the connection worked before any
real credentials were even correctly filled in.

### 6. Africa's Talking phone-OTP integration

**Research first.** Confirmed via Supabase's docs and source repo that:
- Africa's Talking is not a built-in Supabase SMS provider (only Twilio,
  Twilio Verify, MessageBird, Vonage, TextLocal are).
- The only integration path is the **Send SMS Auth Hook** — a webhook
  Supabase calls with `{ user: { phone }, sms: { otp } }`, signed per the
  Standard Webhooks spec (`webhook-id` / `webhook-timestamp` /
  `webhook-signature` headers, HMAC-SHA256 over `id.timestamp.body`).
- It can be hosted as a Supabase Edge Function in the same project.

Also confirmed Africa's Talking sandbox specifics: fixed username `sandbox`,
endpoint `https://api.sandbox.africastalking.com/version1/messaging`,
form-encoded body, `apiKey` header. Chose raw `fetch()` over the official
`africastalking` npm package since that package is built on Node-only deps
(axios, body-parser) with no documented Deno/Edge Function support.

**Built** `supabase/functions/send-sms-hook/index.ts` — verifies the
Standard Webhooks signature, forwards the OTP to Africa's Talking, returns
`{}`/200 on success or `{ error: { http_code, message } }` on failure (the
exact contract Supabase's hook system expects).

**Deploy chain, including the friction actually hit:**

1. Installed the Supabase CLI (`brew install supabase/tap/supabase`) — not
   present on the machine.
2. `supabase login` failed non-interactively: `Cannot use automatic login
   flow inside non-TTY environments`. This session's shell has no browser to
   complete OAuth in. Handed off to the user to run in a real terminal
   rather than requesting a broad-scope personal access token, to keep an
   account-wide credential out of this session.
3. Once logged in: `supabase init` → `supabase link --project-ref
   mbzzmxcpzsplredehryj` → `supabase secrets set AFRICASTALKING_API_KEY=...`
   → `supabase functions deploy send-sms-hook --no-verify-jwt`. The
   `--no-verify-jwt` flag is required — Supabase's hook caller sends the
   Standard Webhooks signature, not a user JWT, so default JWT verification
   would reject every legitimate call.
4. **First test** (direct call to Supabase's `/auth/v1/otp` REST endpoint):
   `{"error_code":"phone_provider_disabled"}`. This is a separate toggle from
   the hook — **Authentication → Sign In / Providers → Phone** needed
   enabling. (Dashboard menu is currently labeled "Sign In / Providers," not
   "Providers" as in some older docs.)
5. **Second test**, after enabling Phone: `{"error_code":"unexpected_failure",
   "msg":"Unexpected status code returned from hook: 500"}`. Supabase's error
   wrapper doesn't forward the hook's own error body to the client, so this
   alone wasn't enough to debug. This CLI version (2.113.0) also has no
   `functions logs` command.
6. **Isolated the function directly**: hand-signed a Standard Webhooks
   payload in Python (HMAC-SHA256 over `id.timestamp.body`, using the secret
   after stripping its `v1,whsec_` prefix and base64-decoding it) and POSTed
   it straight to the deployed function URL, bypassing Supabase Auth
   entirely. This surfaced the real error: `Africa's Talking HTTP 401`.
7. Reproduced the 401 with a direct `curl` to Africa's Talking's sandbox API
   — `"The supplied authentication is invalid"`. Root cause: **the API key
   must come from inside the Sandbox app specifically**
   (`account.africastalking.com/apps/sandbox` → Settings → API Key). A key
   copied from the live/production app (even though both are visually
   similar `atsk_...` strings) does not work with `username=sandbox`.
8. Got a fresh key from the correct Sandbox context — still got the same 401
   immediately after. Root cause #2: **freshly rotated AT keys take roughly
   15–20 seconds to propagate** before they're accepted. A retry after a
   short wait succeeded (`direct curl → 201 status: Success`).
9. Re-ran the isolated function test → `200 {}`. Re-ran the real
   `/auth/v1/otp` call → `{}` (success). Full chain confirmed:
   Next.js app → Supabase Auth → Send SMS hook → Africa's Talking sandbox.
10. Confirmed where the OTP actually surfaces in sandbox mode: never a real
    phone. Either the [AT Simulator](https://simulator.africastalking.com:1517/)
    (register the test number as a virtual device) or the AT dashboard's
    **SMS** tab (message log with full body — faster, no setup).

### 7. Published to GitHub

Pushed to `https://github.com/Vinald/supabase_auth_test`, added a repo
description + topics, and replaced the default `create-next-app` README with
one describing the actual four flows and their status. Added
`.env.local.example` (had to add `!.env*.example` to `.gitignore`, since the
blanket `.env*` rule was swallowing it too).

### 8. Google OAuth — documented, not yet completed

Code side is already built (`/test/google`, `signInWithOAuth`, and
`src/app/auth/callback/route.ts` for the code exchange). What's outstanding
is entirely dashboard work in two consoles (Google Cloud + Supabase) that
only the account owner can do — see Flow 4 below for the exact steps.

## Stack notes that matter for porting this elsewhere

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`**. If the target app is
  on an older Next.js version, rename back and check whether it still needs
  the old convention.
- **Supabase's client-safe key is now called the "publishable key"**, not
  "anon key," on newer projects (format `sb_publishable_...`). Older
  Supabase projects may still only show "anon key" — same purpose, same
  slot, different label.

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

Full narrative in step 6 above. Summary of what's needed to reproduce this
in a new project:

1. Get the sandbox API key from **inside the Sandbox app specifically**
   (account.africastalking.com/apps/sandbox → Settings → API Key) — not the
   live app's key. Wait ~15–20s after generating/rotating before using it.
2. `supabase login` (needs a real interactive terminal).
3. `supabase init` (once per project directory).
4. `supabase link --project-ref <project-ref>`
5. `supabase secrets set AFRICASTALKING_API_KEY=<sandbox key>`
6. `supabase functions deploy send-sms-hook --no-verify-jwt`
7. Dashboard → **Authentication → Sign In / Providers → Phone** → enable.
8. Dashboard → **Authentication → Auth Hooks → Send SMS hook** → enable,
   HTTPS, paste `https://<project-ref>.supabase.co/functions/v1/send-sms-hook`.
   Copy the generated `v1,whsec_...` secret.
9. `supabase secrets set SEND_SMS_HOOK_SECRET=<that v1,whsec_... value>`

**To go from sandbox to production**: swap the Edge Function's endpoint to
`https://api.africastalking.com/version1/messaging`, use the live app's own
API key and username (not `sandbox`), and re-run steps 5–9 with production
values.

**Debugging tip**: to test the Edge Function in isolation (bypassing
Supabase Auth's generic error wrapper, which hides the function's actual
error message), sign a test payload yourself and POST it directly: build
`{user: {phone}, sms: {otp}}`, sign with
`HMAC-SHA256(base64decode(secret_after_stripping_"v1,whsec_"), "{msg_id}.{timestamp}.{payload}")`,
send as `webhook-signature: v1,<base64 sig>` plus `webhook-id` /
`webhook-timestamp` headers.

## Flow 4 — Google (social login)

Code is built; dashboard config is the only remaining piece, entirely manual
(two separate consoles, both requiring account owner login):

1. **Google Cloud Console** → APIs & Services → OAuth consent screen
   (External, fill in app name/support email) → APIs & Services →
   Credentials → Create Credentials → OAuth client ID (Web application).
   Authorized redirect URI:
   `https://mbzzmxcpzsplredehryj.supabase.co/auth/v1/callback` (Supabase's
   own callback — different from this app's `/auth/callback` route). Copy
   the Client ID and Client Secret.
2. **Supabase dashboard** → Authentication → Sign In / Providers → Google →
   enable, paste Client ID + Client Secret.
3. **Supabase dashboard** → Authentication → URL Configuration → Redirect
   URLs → add `http://localhost:3000/auth/callback` (and the production URL
   later). Without this, Supabase finishes the Google handshake but refuses
   to redirect back to the app.

## Porting checklist for a new project

1. Copy `src/utils/supabase/*`, `src/proxy.ts`, `src/components/UserStatus.tsx`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
   the new project.
3. For phone OTP: copy `supabase/functions/send-sms-hook`, then repeat the
   Dashboard/CLI steps above against the new project ref (own secrets, own
   hook URL, own hook secret — none of these transfer between projects).
4. For Google: configure OAuth credentials fresh per project (redirect URIs
   are project-specific).
