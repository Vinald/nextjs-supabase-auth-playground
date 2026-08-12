"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientNoThrow } from "@/utils/supabase/status-check";

export default function StatusPage() {
  const [urlSet, setUrlSet] = useState(false);
  const [keySet, setKeySet] = useState(false);
  const [clientOk, setClientOk] = useState<boolean | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    setUrlSet(Boolean(url));
    setKeySet(Boolean(key));

    const result = createClientNoThrow();
    setClientOk(result.ok);
    if (!result.ok) setClientError(result.error);
  }, []);

  const checklist = [
    {
      label: "Email confirmations / templates",
      path: "Authentication → Email Templates",
      note: "Customize the confirmation and magic link emails if you want branded copy. Works out of the box with Supabase's default templates.",
    },
    {
      label: "Africa's Talking Send SMS hook (Phone OTP)",
      path: "Authentication → Hooks → Send SMS hook",
      note: "Deploy supabase/functions/send-sms-hook (supabase functions deploy send-sms-hook --no-verify-jwt), set its AFRICASTALKING_API_KEY and SEND_SMS_HOOK_SECRET secrets, then point this hook at the deployed function URL. Sandbox codes land in the Africa's Talking Simulator, not a real phone.",
    },
    {
      label: "Google OAuth credentials",
      path: "Authentication → Providers → Google",
      note: "Requires a Google Cloud OAuth client ID/secret pasted in here, plus the Supabase callback URL added to the Google Cloud console.",
    },
  ];

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/test" className="text-sm opacity-70 hover:underline">
        ← back to test index
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Status</h1>

      <section className="mb-6 space-y-2">
        <StatusRow label="NEXT_PUBLIC_SUPABASE_URL set" ok={urlSet} />
        <StatusRow label="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY set" ok={keySet} />
        <StatusRow
          label="Supabase client can be created"
          ok={clientOk}
          detail={clientError ?? undefined}
        />
      </section>

      <h2 className="mb-2 text-lg font-semibold">
        Manual setup checklist (dashboard config, not code)
      </h2>
      <ul className="space-y-3">
        {checklist.map((item) => (
          <li
            key={item.label}
            className="rounded-lg border border-black/10 p-3 dark:border-white/15"
          >
            <div className="font-medium">{item.label}</div>
            <div className="font-mono text-xs opacity-70">{item.path}</div>
            <div className="mt-1 text-sm opacity-80">{item.note}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean | null;
  detail?: string;
}) {
  const icon = ok === null ? "…" : ok ? "✅" : "❌";
  return (
    <div className="flex items-start gap-2 text-sm">
      <span>{icon}</span>
      <div>
        <span>{label}</span>
        {detail && (
          <div className="font-mono text-xs text-red-600">{detail}</div>
        )}
      </div>
    </div>
  );
}
