import "server-only";

export { escapeHtml, verifyEmailTemplate, resetEmailTemplate } from "./emailTemplates";
export type { EmailContent } from "./emailTemplates";

const ENDPOINT = "https://api.smtp2go.com/v3/email/send";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "failed" };

/**
 * Sends through SMTP2GO, matching the pattern already in use on the Scott
 * Applications site — a plain fetch, no SDK, no extra dependency.
 *
 * A missing API key is a skip, not an error: registration must still succeed
 * on a deploy where email is not configured, exactly as the careers route
 * behaves. Callers therefore must not treat a false result as a failed
 * signup.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.SMTP2GO_API_KEY?.trim();
  const sender = process.env.FROM_EMAIL?.trim();

  if (!apiKey || !sender) {
    console.warn("[email] skipped — SMTP2GO_API_KEY or FROM_EMAIL not set");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: [input.to],
        sender,
        subject: input.subject,
        html_body: input.html,
        text_body: input.text,
      }),
    });

    if (!res.ok) {
      console.error("[email] SMTP2GO error:", (await res.text()).slice(0, 400));
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw:", (err as Error).message);
    return { sent: false, reason: "failed" };
  }
}

/** Absolute base URL for links in emails, without a trailing slash. */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
