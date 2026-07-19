/**
 * Email markup builders. Deliberately free of "server-only" and of any I/O:
 * these are pure string functions, which keeps them unit-testable and lets
 * the sending module stay the only server-bound piece.
 */

export function escapeHtml(value: string): string {
  return String(value).replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/* ==========================================================================
   Templates
   ==========================================================================

   Email clients are not browsers. Outlook renders through Word, which ignores
   padding on anchors, discards border-radius, and mishandles div-based
   layout — which is why a styled <a> button degrades to bare underlined text
   there. Everything below is therefore table-based with inline styles only:
   the lowest common denominator that renders consistently from Gmail through
   Outlook 2016.
   ========================================================================== */

const BG = "#1a0e0a";
const SURFACE = "#2a1810";
const BORDER = "#4a2e1f";
const TEXT = "#f5e8d0";
const MUTED = "#b8a088";
const ACCENT = "#ff6b1a";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * Hidden inbox preview line. Without one, clients pull in the first visible
 * words — which would be the brand name, repeated on every email.
 */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BG};opacity:0">${escapeHtml(text)}</div>`;
}

/**
 * Bulletproof button. The table cell carries the background colour so Outlook
 * still paints it, and a VML rounded rectangle supplies the corner radius
 * Outlook would otherwise drop. Every other client renders the anchor and
 * skips the VML entirely.
 */
function button(href: string, label: string): string {
  const h = escapeHtml(href);
  const l = escapeHtml(label);
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0">
  <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:6px">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h}" style="height:46px;v-text-anchor:middle;width:280px;" arcsize="13%" stroke="f" fillcolor="${ACCENT}">
      <w:anchorlock/><center style="color:${BG};font-family:${FONT};font-size:15px;font-weight:bold;letter-spacing:.04em">${l}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${h}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:bold;letter-spacing:.04em;color:${BG};text-decoration:none;border-radius:6px">${l}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;
}

/** Plain-text fallback link, for clients that strip or distrust the button. */
function fallbackLink(url: string): string {
  return `<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">Or paste this link into your browser:</p>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;word-break:break-all"><a href="${escapeHtml(url)}" style="color:${ACCENT};text-decoration:underline">${escapeHtml(url)}</a></p>`;
}

/** `html` is trusted markup assembled here — never raw user input. */
function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED}">${html}</p>`;
}

function layout(title: string, preview: string, body: string): string {
  return `${preheader(preview)}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG};margin:0;padding:0">
  <tr><td align="center" style="padding:32px 16px">

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background-color:${SURFACE};border:1px solid ${BORDER};border-radius:8px">

      <tr><td style="padding:28px 32px 0">
        <p style="margin:0;font-family:${FONT};font-size:18px;font-weight:bold;letter-spacing:.06em;color:${ACCENT}">&#129451; BEAVER GAMING</p>
      </td></tr>

      <tr><td style="padding:20px 32px 0">
        <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:bold;color:${TEXT}">${escapeHtml(title)}</h1>
        ${body}
      </td></tr>

      <tr><td style="padding:8px 32px 28px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="border-top:1px solid ${BORDER};padding-top:16px">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED}">If you didn't expect this email you can safely ignore it &mdash; no action will be taken.</p>
          </td></tr>
        </table>
      </td></tr>

    </table>

    <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;color:${MUTED}">Beaver Gaming &middot; free games, instant play</p>

  </td></tr>
</table>`;
}

export interface EmailContent {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function verifyEmailTemplate(name: string, url: string): EmailContent {
  return {
    to: "",
    subject: "Confirm your Beaver Gaming account",
    html: layout(
      `Welcome, ${name}`,
      "Confirm your email address to finish setting up your account.",
      paragraph(
        "Confirm your email address to finish setting up your account. Your tokens and scores are already saved &mdash; this just ties them to you.",
      ) +
        button(url, "CONFIRM EMAIL") +
        fallbackLink(url),
    ),
    text: `Welcome, ${name}.\n\nConfirm your email address to finish setting up your Beaver Gaming account:\n${url}\n\nIf you didn't expect this email, ignore it.`,
  };
}

export function resetEmailTemplate(name: string, url: string): EmailContent {
  return {
    to: "",
    subject: "Reset your Beaver Gaming password",
    html: layout(
      "Password reset",
      "Choose a new password. This link expires in one hour.",
      paragraph(
        `Hi ${escapeHtml(name)} &mdash; use the button below to choose a new password. It expires in <strong style="color:${TEXT}">one hour</strong> and works only once.`,
      ) +
        button(url, "CHOOSE A NEW PASSWORD") +
        fallbackLink(url),
    ),
    text: `Hi ${name},\n\nUse this link to choose a new Beaver Gaming password. It expires in one hour and works only once:\n${url}\n\nIf you didn't request this, ignore it — your password is unchanged.`,
  };
}
