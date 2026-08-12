"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import UserStatus from "@/components/UserStatus";

export default function EmailPasswordTestPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(`Sign up error: ${error.message}`);
      return;
    }
    setUser(data.user);
    setMessage(
      data.session
        ? "Signed up and logged in."
        : "Signed up. Check your email to confirm, if confirmations are enabled.",
    );
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(`Sign in error: ${error.message}`);
      return;
    }
    setUser(data.user);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <Link href="/test" className="text-sm opacity-70 hover:underline">
        ← back to test index
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Email + password</h1>

      {!user && (
        <form className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSignUp}
              className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Sign up
            </button>
            <button
              onClick={handleSignIn}
              className="rounded border border-black/20 px-3 py-2 text-sm font-medium dark:border-white/20"
            >
              Sign in
            </button>
          </div>
        </form>
      )}

      {message && <p className="mt-3 text-sm">{message}</p>}

      {user && <UserStatus user={user} onSignedOut={() => setUser(null)} />}
    </main>
  );
}
