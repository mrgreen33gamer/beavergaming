"use client";

import { useState } from "react";
import Link from "next/link";
import AuthForm from "@/app/components/AuthForm";

export default function ForgotForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="max-w-md mx-auto w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8">
        <h1 className="t-display-lg text-[var(--accent)] mb-3">CHECK YOUR EMAIL</h1>
        <p className="t-body text-[var(--muted)]">
          If that email has an account, a reset link is on its way. The link
          works once and expires in an hour.
        </p>
        <p className="t-body mt-6">
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            ← back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <AuthForm
      title="RESET PASSWORD"
      intro="Enter your email and we'll send you a link to choose a new password."
      endpoint="/api/auth/request-reset"
      submitLabel="SEND RESET LINK"
      fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      onSuccess={() => setSent(true)}
    />
  );
}
