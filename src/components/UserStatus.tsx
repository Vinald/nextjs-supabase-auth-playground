"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

export default function UserStatus({
  user,
  onSignedOut,
}: {
  user: User;
  onSignedOut: () => void;
}) {
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    onSignedOut();
  }

  return (
    <div className="mt-6 rounded-lg border border-green-600 bg-green-50 p-4 text-sm dark:bg-green-950">
      <p className="mb-2 font-semibold text-green-700 dark:text-green-400">
        Signed in
      </p>
      <dl className="space-y-1">
        <div className="flex gap-2">
          <dt className="font-mono text-xs opacity-70">id</dt>
          <dd className="font-mono text-xs">{user.id}</dd>
        </div>
        {user.email && (
          <div className="flex gap-2">
            <dt className="font-mono text-xs opacity-70">email</dt>
            <dd className="font-mono text-xs">{user.email}</dd>
          </div>
        )}
        {user.phone && (
          <div className="flex gap-2">
            <dt className="font-mono text-xs opacity-70">phone</dt>
            <dd className="font-mono text-xs">{user.phone}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="font-mono text-xs opacity-70">created_at</dt>
          <dd className="font-mono text-xs">{user.created_at}</dd>
        </div>
      </dl>
      <button
        onClick={handleSignOut}
        className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        Sign out
      </button>
    </div>
  );
}
