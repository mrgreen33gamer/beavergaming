"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthForm from "@/app/components/AuthForm";

export default function LoginForm() {
  const router = useRouter();

  return (
    <AuthForm
      title="SIGN IN"
      endpoint="/api/auth/login"
      submitLabel="SIGN IN"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      onSuccess={() => {
        router.push("/account");
        router.refresh();
      }}
      footer={
        <>
          <p>
            No account?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Create one
            </Link>
          </p>
          <p className="mt-2">
            <Link href="/forgot" className="hover:text-[var(--accent)]">
              Forgot your password?
            </Link>
          </p>
        </>
      }
    />
  );
}
