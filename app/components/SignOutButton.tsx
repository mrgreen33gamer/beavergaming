"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="pixel-edge t-display-sm rounded-lg bg-[var(--surface-2)] px-6 py-3 text-[var(--foreground)] disabled:opacity-60"
    >
      {pending ? "…" : "SIGN OUT"}
    </button>
  );
}
