import Link from "next/link";

const flows = [
  {
    href: "/test/email-password",
    title: "Email + password",
    description: "Classic sign up / sign in with an email and password.",
  },
  {
    href: "/test/email-otp",
    title: "Email OTP",
    description: "Request a 6-digit code by email, no password required.",
  },
  {
    href: "/test/phone-otp",
    title: "Phone OTP (SMS)",
    description:
      "Request a 6-digit code by SMS to a phone number, then verify it.",
  },
  {
    href: "/test/google",
    title: "Google (social login)",
    description: "Sign in with a Google account via OAuth.",
  },
  {
    href: "/test/status",
    title: "Status",
    description: "Check env vars, client setup, and what's left to configure.",
  },
];

export default function TestIndexPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Supabase Auth test flows</h1>
      <p className="mb-6 text-sm opacity-70">
        Pick a flow below to try it end to end.
      </p>
      <ul className="space-y-3">
        {flows.map((flow) => (
          <li key={flow.href}>
            <Link
              href={flow.href}
              className="block rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
            >
              <div className="font-semibold">{flow.title}</div>
              <div className="text-sm opacity-70">{flow.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
