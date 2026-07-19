"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type State = "checking" | "ok" | "failed";

export default function VerifyStatus({ token }: { token: string }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!active) return;
        if (res.ok) {
          setState("ok");
        } else {
          setState("failed");
          setMessage(data.error ?? "That link didn't work.");
        }
      } catch {
        if (active) {
          setState("failed");
          setMessage("Couldn't reach the server. Try the link again.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const copy: Record<State, { title: string; body: string; color: string }> = {
    checking: { title: "CONFIRMING…", body: "One moment.", color: "var(--muted)" },
    ok: {
      title: "EMAIL CONFIRMED",
      body: "Your account is all set. Your tokens follow you across devices now.",
      color: "var(--crt-green)",
    },
    failed: { title: "LINK DIDN'T WORK", body: message, color: "var(--danger)" },
  };

  const { title, body, color } = copy[state];

  return (
    <div className="max-w-md mx-auto w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8">
      <h1 className="t-display-lg mb-3" style={{ color }} aria-live="polite">
        {title}
      </h1>
      <p className="t-body text-[var(--muted)]">{body}</p>
      <p className="t-body mt-6 flex gap-4">
        <Link href="/account" className="text-[var(--accent)] hover:underline">
          Your account
        </Link>
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--accent)]">
          Back to games
        </Link>
      </p>
    </div>
  );
}
