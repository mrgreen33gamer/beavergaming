"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthForm from "@/app/components/AuthForm";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

export default function RegisterForm() {
  const router = useRouter();

  return (
    <AuthForm
      title="CREATE ACCOUNT"
      intro="Optional — accounts keep your tokens and scores across devices. Any tokens you've already earned come with you."
      endpoint="/api/auth/register"
      submitLabel="CREATE ACCOUNT"
      fields={[
        {
          name: "displayName",
          label: "Display name",
          type: "text",
          autoComplete: "nickname",
          required: false,
          hint: "Optional — defaults to your email name.",
        },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          hint: `At least ${MIN_PASSWORD_LENGTH} characters.`,
        },
      ]}
      onSuccess={() => {
        router.push("/account");
        router.refresh();
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </>
      }
    />
  );
}
