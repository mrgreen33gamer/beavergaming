import { describe, expect, it } from "vitest";
import { resetEmailTemplate, verifyEmailTemplate } from "../emailTemplates";

const URL = "https://beavergaming.vercel.app/verify/abc123";

describe("email templates", () => {
  const templates = [
    ["verify", verifyEmailTemplate("Player", URL)],
    ["reset", resetEmailTemplate("Player", URL)],
  ] as const;

  it.each(templates)("%s uses table-based layout, not divs, for structure", (_n, tpl) => {
    // Outlook renders through Word and mishandles div layout.
    expect(tpl.html).toContain('role="presentation"');
    expect(tpl.html).toContain("<table");
  });

  it.each(templates)("%s ships an Outlook-safe button", (_n, tpl) => {
    // The VML rounded rect supplies the radius Outlook drops, and the cell
    // bgcolor keeps the fill when padding on the anchor is ignored.
    expect(tpl.html).toContain("v:roundrect");
    expect(tpl.html).toContain('bgcolor="#ff6b1a"');
    expect(tpl.html).toContain("<![endif]-->");
  });

  it.each(templates)("%s includes hidden preheader text", (_n, tpl) => {
    expect(tpl.html).toContain("mso-hide:all");
  });

  it.each(templates)("%s offers a copyable fallback link", (_n, tpl) => {
    expect(tpl.html).toContain("Or paste this link into your browser");
    expect(tpl.html.match(new RegExp(URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))!.length)
      .toBeGreaterThanOrEqual(2); // button + fallback
  });

  it.each(templates)("%s uses only inline styles — no <style> block", (_n, tpl) => {
    expect(tpl.html).not.toMatch(/<style[\s>]/i);
  });

  it.each(templates)("%s has a non-empty plain-text alternative", (_n, tpl) => {
    expect(tpl.text.length).toBeGreaterThan(40);
    expect(tpl.text).toContain(URL);
  });

  it.each(templates)("%s constrains width for mobile clients", (_n, tpl) => {
    expect(tpl.html).toContain("max-width:600px");
  });

  it("escapes a display name that contains markup", () => {
    const evil = '<script>alert(1)</script>';
    const tpl = resetEmailTemplate(evil, URL);
    expect(tpl.html).not.toContain("<script>");
    expect(tpl.html).toContain("&lt;script&gt;");
  });

  it("escapes a display name in the verify subject line body", () => {
    const tpl = verifyEmailTemplate('Bobby "><b>Tables', URL);
    expect(tpl.html).not.toContain('"><b>');
  });

  it("escapes a hostile url rather than breaking out of the href", () => {
    const tpl = verifyEmailTemplate("Player", 'https://x.test/"><script>alert(1)</script>');
    expect(tpl.html).not.toContain("<script>");
  });
});
