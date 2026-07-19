"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";

export interface AuthField {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

/**
 * Shared shell for every auth form. Keeping submit/error/pending handling in
 * one place is what stops five near-identical forms drifting apart.
 */
export default function AuthForm({
  title,
  intro,
  fields,
  submitLabel,
  endpoint,
  onSuccess,
  footer,
  hiddenValues,
}: {
  title: string;
  intro?: string;
  fields: AuthField[];
  submitLabel: string;
  endpoint: string;
  onSuccess: (data: Record<string, unknown>) => void;
  footer?: ReactNode;
  /** Extra values posted alongside the fields, e.g. a token from the URL. */
  hiddenValues?: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      ...hiddenValues,
      ...Object.fromEntries(fields.map((f) => [f.name, String(form.get(f.name) ?? "")])),
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        setError((data.error as string) ?? "Something went wrong. Try again.");
        setPending(false);
        return;
      }
      onSuccess(data);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8">
        <h1 className="t-display-lg text-[var(--accent)] mb-3">{title}</h1>
        {intro && <p className="t-body text-[var(--muted)] mb-6">{intro}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-2">
              <span className="t-label text-[var(--foreground)]">{f.label}</span>
              <input
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                required={f.required ?? true}
                className="t-body rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              />
              {f.hint && <span className="t-caption text-[var(--muted)]">{f.hint}</span>}
            </label>
          ))}

          {error && (
            <p role="alert" className="t-body text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="pixel-edge t-display-sm rounded-lg bg-[var(--accent)] px-6 py-3 text-[var(--background)] disabled:opacity-60"
          >
            {pending ? "…" : submitLabel}
          </button>
        </form>
      </div>

      {footer && <div className="t-body text-[var(--muted)] mt-6 text-center">{footer}</div>}

      <p className="t-caption text-[var(--muted)] mt-8 text-center">
        <Link href="/" className="hover:text-[var(--accent)]">
          ← back to games
        </Link>{" "}
        · you can keep playing without an account
      </p>
    </div>
  );
}
