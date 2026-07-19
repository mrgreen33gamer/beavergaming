import "server-only";

const ENDPOINT = "https://api.smtp2go.com/v3/email/send";

export function escapeHtml(value: string): string {
  return String(value).replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

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

function layout(title: string, body: string): string {
  // Inline styles only — email clients strip <style> blocks unpredictably.
  return `<div style="background:#1a0e0a;padding:32px;font-family:Georgia,serif">
  <div style="max-width:520px;margin:0 auto;background:#2a1810;border:1px solid #4a2e1f;border-radius:8px;padding:32px">
    <p style="color:#ff6b1a;font-size:20px;font-weight:bold;margin:0 0 24px">🦫 BEAVER GAMING</p>
    <h1 style="color:#f5e8d0;font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${body}
    <p style="color:#b8a088;font-size:13px;margin:32px 0 0;border-top:1px solid #4a2e1f;padding-top:16px">
      If you didn't expect this email, you can safely ignore it.
    </p>
  </div>
</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#ff6b1a;color:#1a0e0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

export function verifyEmailTemplate(name: string, url: string): SendEmailInput {
  return {
    to: "",
    subject: "Confirm your Beaver Gaming account",
    html: layout(
      `Welcome, ${escapeHtml(name)}`,
      `<p style="color:#b8a088;font-size:15px;line-height:1.6">Confirm your email address to finish setting up your account. Your tokens and scores are already saved.</p>
       ${button(url, "Confirm email")}
       <p style="color:#b8a088;font-size:13px">Or paste this link into your browser:<br><span style="color:#7fd650;word-break:break-all">${escapeHtml(url)}</span></p>`,
    ),
    text: `Welcome, ${name}.\n\nConfirm your email address to finish setting up your Beaver Gaming account:\n${url}\n\nIf you didn't expect this email, ignore it.`,
  };
}

export function resetEmailTemplate(name: string, url: string): SendEmailInput {
  return {
    to: "",
    subject: "Reset your Beaver Gaming password",
    html: layout(
      "Password reset",
      `<p style="color:#b8a088;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)} — use the link below to choose a new password. It expires in one hour and works only once.</p>
       ${button(url, "Choose a new password")}
       <p style="color:#b8a088;font-size:13px">Or paste this link into your browser:<br><span style="color:#7fd650;word-break:break-all">${escapeHtml(url)}</span></p>`,
    ),
    text: `Hi ${name},\n\nUse this link to choose a new Beaver Gaming password. It expires in one hour and works only once:\n${url}\n\nIf you didn't request this, ignore it — your password is unchanged.`,
  };
}
