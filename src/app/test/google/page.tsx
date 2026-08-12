"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import UserStatus from "@/components/UserStatus";

export default function GoogleTestPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  async function handleSignIn() {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/test/google`,
      },
    });
    if (error) {
      setMessage(`Error: ${error.message}`);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <Link href="/test" className="text-sm opacity-70 hover:underline">
        ← back to test index
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Google (social login)</h1>

      <div className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950">
        Requires Google OAuth credentials configured in Supabase dashboard
        under Authentication → Providers → Google.
      </div>

      {!user && (
        <button
          onClick={handleSignIn}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Sign in with Google
        </button>
      )}

      {message && <p className="mt-3 text-sm">{message}</p>}

      {user && <UserStatus user={user} onSignedOut={() => setUser(null)} />}
    </main>
  );
}
