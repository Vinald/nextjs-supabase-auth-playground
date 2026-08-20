import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-regenerate AGENTS.md/CLAUDE.md on `next dev` — the relevant
  // Next 16 notes live in .claude/skills/supabase-auth-setup/SKILL.md instead.
  agentRules: false,
};

export default nextConfig;
