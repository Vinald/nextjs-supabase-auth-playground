"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import UserStatus from "@/components/UserStatus";

export default function PhoneOtpTestPage() {
  const supabase = createClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      setMessage(`Error sending code: ${error.message}`);
      return;
    }
    setCodeSent(true);
    setMessage("Code sent by SMS.");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    if (error) {
      setMessage(`Verify error: ${error.message}`);
      return;
    }
    setUser(data.user);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <Link href="/test" className="text-sm opacity-70 hover:underline">
        ← back to test index
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Phone OTP (SMS)</h1>

      <div className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950">
        Phone OTP requires an SMS provider (Twilio, MessageBird, or Vonage)
        configured in the Supabase dashboard under Authentication → Providers
        → Phone. This will not send real SMS until that&apos;s set up.
      </div>

      {!user && !codeSent && (
        <form onSubmit={handleSendCode} className="space-y-3">
          <input
            type="tel"
            placeholder="+2567XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Send code
          </button>
        </form>
      )}

      {!user && codeSent && (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Verify
          </button>
        </form>
      )}

      {message && <p className="mt-3 text-sm">{message}</p>}

      {user && <UserStatus user={user} onSignedOut={() => setUser(null)} />}
    </main>
  );
}
