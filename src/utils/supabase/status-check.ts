import { createClient } from "@/utils/supabase/client";

export function createClientNoThrow():
  | { ok: true }
  | { ok: false; error: string } {
  try {
    createClient();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
