import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Guards the client/server boundary.
 *
 * This project's Vercel build has already been broken twice by the same
 * mistake: a "use client" module reaching, through some chain of imports, a
 * module that pulls in the mongodb driver. The driver imports Node built-ins
 * (dns, net, tls, child_process) that do not exist in a browser, so the
 * bundler fails with a wall of "Module not found" errors that name the driver
 * rather than the import that dragged it in.
 *
 * Rather than trusting review to catch it, this walks the real import graph
 * from every "use client" entry point and fails with the exact chain.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const SEARCH_DIRS = ["app", "lib"];

/** Modules that must never end up in a browser bundle. */
const SERVER_ONLY = [
  "lib/auth/server",
  "lib/auth/mongoStore",
  "lib/email",
  "lib/platform/server/getServerEconomy",
  "lib/platform/storage/mongo",
  "lib/platform/storage/selectServer",
];

function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const rel = path.join(dir, entry);
    const abs = path.join(ROOT, rel);
    if (statSync(abs).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

function importsOf(relFile: string): string[] {
  const src = readFileSync(path.join(ROOT, relFile), "utf8");
  const specs: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) specs.push(m[1]);
  return specs;
}

/** Resolves an import specifier to a repo-relative module path, or null. */
function resolve(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = path.join(path.dirname(fromFile), spec);
  else return null; // package import

  base = base.split(path.sep).join("/").replace(/\.tsx?$/, "");
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(path.join(ROOT, cand))) return cand;
  }
  return null;
}

function isClientEntry(relFile: string): boolean {
  const head = readFileSync(path.join(ROOT, relFile), "utf8").slice(0, 200);
  return /^\s*["']use client["']/m.test(head);
}

function normalize(relFile: string): string {
  return relFile.split(path.sep).join("/").replace(/\.tsx?$/, "");
}

/** Depth-first search for a server-only module, returning the import chain. */
function findServerLeak(entry: string): string[] | null {
  const seen = new Set<string>();

  function visit(file: string, chain: string[]): string[] | null {
    const key = normalize(file);
    if (seen.has(key)) return null;
    seen.add(key);

    if (SERVER_ONLY.includes(key)) return [...chain, key];

    for (const spec of importsOf(file)) {
      const next = resolve(spec, file);
      if (!next) continue;
      const found = visit(next, [...chain, key]);
      if (found) return found;
    }
    return null;
  }

  return visit(entry, []);
}

describe("client bundle boundary", () => {
  const files = SEARCH_DIRS.flatMap((d) => walk(d));
  const clientEntries = files.filter(isClientEntry);

  it("finds client entry points to check", () => {
    expect(clientEntries.length).toBeGreaterThan(0);
  });

  it.each(clientEntries)("%s does not reach a server-only module", (entry) => {
    const leak = findServerLeak(entry);
    expect(
      leak,
      leak
        ? `"use client" module reaches a server-only module:\n  ${leak.join("\n    → ")}\n` +
          `This pulls the mongodb driver into the browser bundle and fails the build.`
        : undefined,
    ).toBeNull();
  });
});
