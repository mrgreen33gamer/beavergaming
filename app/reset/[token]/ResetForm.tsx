"use client";

import { useState } from "react";
import Link from "next/link";
import AuthForm from "@/app/components/AuthForm";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

export default function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="max-w-md mx-auto w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8">
        <h1 className="t-display-lg text-[var(--crt-green)] mb-3">PASSWORD CHANGED</h1>
        <p className="t-body text-[var(--muted)]">
          You&apos;ve been signed out everywhere else. Sign in with your new password.
        </p>
        <p className="t-body mt-6">
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <AuthForm
      title="NEW PASSWORD"
      intro="Choose a new password for your account."
      endpoint="/api/auth/reset"
      submitLabel="SET PASSWORD"
      fields={[
        {
          name: "password",
          label: "New password",
          type: "password",
          autoComplete: "new-password",
          hint: `At least ${MIN_PASSWORD_LENGTH} characters.`,
        },
      ]}
      // The token comes from the URL, not from user input.
      hiddenValues={{ token }}
      onSuccess={() => setDone(true)}
    />
  );
}
