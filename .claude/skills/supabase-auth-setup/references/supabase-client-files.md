# Supabase SSR client helpers (Next.js App Router)

Verified working against Next.js 16 + `@supabase/ssr`. Re-check against
current Supabase docs if it's been more than a few months — this pattern has
changed across Supabase versions before (e.g. the proxy/middleware split,
the anon→publishable key rename).

## `src/utils/supabase/client.ts` (browser client)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

## `src/utils/supabase/server.ts` (Server Components / Route Handlers)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — fine if proxy refreshes sessions.
          }
        },
      },
    },
  );
}
```

## `src/utils/supabase/proxy.ts` (session refresh logic)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    // Skip refresh instead of crashing every request when env vars are unset.
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() — a mistake
  // here can randomly log users out (session refresh relies on it).
  await supabase.auth.getClaims();

  return supabaseResponse;
}
```

## Entrypoint — `src/proxy.ts` (Next.js 16+) or `src/middleware.ts` (older)

Next.js 16 renamed the file/export from `middleware` to `proxy`. Check the
target project's Next.js version before picking one.

```typescript
// src/proxy.ts (Next.js 16+)
import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

For Next.js <16, same body but the file is `src/middleware.ts` and the
exported function is named `middleware` instead of `proxy`.

## Standard pattern for each auth test/feature page

```typescript
"use client";
// ...
const [supabase] = useState(() => {
  try {
    return createClient();
  } catch {
    return null; // renders a "not configured" state instead of crashing
  }
});
// guard every handler: if (!supabase) { show a config-needed message; return; }
```
