---
name: supabase-auth-setup
description: Set up or debug Supabase Auth in a Next.js App Router project — email/password, email OTP, phone OTP via a custom SMS provider (e.g. Africa's Talking), and Google OAuth. Trigger when the user asks to add/wire/fix Supabase authentication, phone OTP / SMS login, a Supabase "Send SMS" Auth Hook, or hits errors like phone_provider_disabled, "Unexpected status code returned from hook", or Next.js middleware/proxy confusion with Supabase.
---

# Supabase Auth setup (Next.js App Router)

Distilled from a working build-and-debug session: `github.com/Vinald/supabase_auth_test`
(full chronological writeup in that repo's `AUTH_SETUP.md`). Use this as a
runbook, not just reference — the troubleshooting table exists because every
row was actually hit once.

## Before writing any code

Check the Next.js version in the target project's `package.json`. **Next.js
16 renamed `middleware.ts` → `proxy.ts`** (exported function `middleware` →
`proxy`, same file location — root or `src/`). Using `middleware.ts` on
Next 16 throws a deprecation error. Don't assume the older name; check.

Also don't assume the Supabase env var name. Newer Supabase projects call
the client-safe key the **"publishable key"** (`sb_publishable_...`), not
"anon key" — check what the project's dashboard (Settings → API) actually
shows before naming the env var, since older projects still say "anon key."
Same slot either way, different label.

## Step 1 — Client helpers

Copy from `references/supabase-client-files.md`: `client.ts` (browser),
`server.ts` (Server Components/Route Handlers), and the proxy pair
(`utils/supabase/proxy.ts` + root `proxy.ts` or `middleware.ts` depending on
Next.js version, per above). These come from Supabase's current official
Next.js SSR example — re-verify against
`https://supabase.com/docs/guides/auth/server-side/nextjs` or the
`supabase/supabase` repo's `examples/auth/nextjs-full` if it's been a while,
since this pattern has changed across Supabase versions before.

**Make pages tolerate missing env vars.** If `.env.local` might be empty
during setup (e.g. user hasn't pasted real credentials yet), guard
`createClient()` calls in try/catch and skip session refresh in the proxy
when the URL/key env vars are unset — otherwise every route 500s until
config is complete, which makes it impossible to verify anything else works
in the meantime.

## Step 2 — Email + password, Email OTP

No special dashboard config needed beyond having a Supabase project — works
once the URL/key env vars are set. `supabase.auth.signUp` /
`signInWithPassword` / `signInWithOtp({ email })` /
`verifyOtp({ email, token, type: "email" })`.

## Step 3 — Phone OTP via a custom SMS provider (e.g. Africa's Talking)

Supabase's built-in phone providers are Twilio, Twilio Verify, MessageBird,
Vonage, TextLocal only. Anything else (Africa's Talking, etc.) goes through
the **Send SMS Auth Hook** — a webhook that fully replaces the built-in
provider path. Best hosted as a Supabase Edge Function in the same project.

Copy `references/send-sms-hook.ts` as a starting point — swap the
`sendSms()` internals for whatever provider's REST API is actually in use;
keep the Standard Webhooks verification and the response contract
(`{}`/200 on success, `{error:{http_code,message}}` on failure) as-is, since
that's Supabase's hook contract, not provider-specific.

Deploy chain:
```
supabase login          # needs a real interactive terminal — fails non-TTY
supabase init            # once per project directory
supabase link --project-ref <ref>
supabase secrets set <PROVIDER_API_KEY>=<value>
supabase functions deploy send-sms-hook --no-verify-jwt   # flag is required — hook auth is the signature, not a JWT
```
Then in the dashboard: **Authentication → Sign In / Providers → Phone**
(enable) and **Authentication → Auth Hooks → Send SMS hook** (enable, HTTPS,
paste the deployed function URL — generates a `v1,whsec_...` secret, set
that too via `supabase secrets set SEND_SMS_HOOK_SECRET=...`).

If a provider's sandbox/test mode is involved, don't deliver to real
phones — check `references/troubleshooting.md` for how to find where
sandbox messages actually land, and the two-credential trap that costs the
most debugging time.

## Step 4 — Google (or other OAuth) social login

Code side: `supabase.auth.signInWithOAuth({ provider, options: { redirectTo }
})` plus a Route Handler at (e.g.) `/auth/callback` that calls
`exchangeCodeForSession(code)`. Two *separate* callback URLs matter — don't
conflate them:
- The OAuth provider's redirect URI setting → Supabase's own callback:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- Supabase dashboard's Authentication → URL Configuration → Redirect URLs
  allow-list → the app's own callback route (e.g.
  `http://localhost:3000/auth/callback`). Skip this and Supabase finishes
  the provider handshake but refuses the final redirect back to the app.

This step is unavoidably manual — provider console + Supabase dashboard,
both requiring the account owner's login. Don't attempt to do it "for" the
user; give exact steps and URLs instead.

## Debugging technique worth reusing

Supabase Auth's REST error responses **do not forward the hook's own error
body** — `{"error_code":"unexpected_failure","msg":"Unexpected status code
returned from hook: 500"}` is all you get, regardless of what the function
actually returned. To see the real error, sign a test payload yourself and
POST it directly to the deployed function URL, bypassing Supabase Auth:

```python
import base64, hmac, hashlib, json, time, uuid, urllib.request

secret_b64 = hook_secret.replace("v1,whsec_", "")
secret_bytes = base64.b64decode(secret_b64)
payload = json.dumps({"user": {"id": "...", "phone": "+..."}, "sms": {"otp": "123456"}})
msg_id = f"msg_{uuid.uuid4().hex}"
timestamp = str(int(time.time()))
signature = base64.b64encode(
    hmac.new(secret_bytes, f"{msg_id}.{timestamp}.{payload}".encode(), hashlib.sha256).digest()
).decode()
headers = {
    "Content-Type": "application/json",
    "webhook-id": msg_id,
    "webhook-timestamp": timestamp,
    "webhook-signature": f"v1,{signature}",
}
# POST payload + headers to https://<ref>.supabase.co/functions/v1/<function-name>
```

This isolates "is the function broken" from "is Supabase Auth calling it
correctly" — worth doing before assuming the bug is in Supabase config when
a hook-based flow fails.

See `references/troubleshooting.md` for the specific errors this session
hit and their root causes.
