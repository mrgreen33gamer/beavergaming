# Beaver Gaming — Cleanup, Redesign, and Optional Accounts

**Date:** 2026-07-19
**Status:** Approved design, pending implementation plan

## Context

Beaver Gaming is a Next.js 16 / React 19 browser-games portal with 50 games, a
B-Token economy, and a pluggable `StorageAdapter` persistence layer backed by
MongoDB Atlas in production.

This spec covers three sequenced pieces of work: asset/dead-code cleanup, a
visual redesign, and an optional account system.

### Non-goal: the Vercel deploy error

The reported deploy failure was investigated and is **already fixed**. The
failed build died with:

```
Module not found: Can't resolve 'child_process' / 'dns' / 'fs' / 'net' / 'tls'
Error: Turbopack build failed with 17 errors
```

That was the MongoDB driver being pulled into the client bundle. Commit
`4a696fc` ("fix(build): keep mongodb driver server-only for Vercel client
bundle") resolved it. Verified on 2026-07-19: `next build` passes, the latest
production deployment is Ready and aliased to `beavergaming.vercel.app`, and the
live site returns HTTP 200. **No work required.** The errored deployments remain
visible in the Vercel dashboard permanently, which is what made the project look
broken.

---

## Stage 1 — Cleanup

Zero-behavior-change commit. Build and test output must be identical before and
after.

### Delete: 43 dead re-export shims

`app/games/*.tsx` (PascalCase, e.g. `Pacman.tsx`) are one-line leftovers from the
folder migration:

```ts
export { default } from "./pacman/index";
```

Verified: nothing imports them. The live registry (`app/play/[slug]/gameComponents.ts`)
points at the `app/games/<slug>/index.tsx` folders.

### Delete: unused Next.js boilerplate

`public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` — verified
unreferenced across all `.ts/.tsx/.css/.json/.mjs`.

### Keep: `public/sw.js`

**Do not delete.** It is a narrowly-scoped service worker that caches `/music/*`
for the helicopter game, registered at `app/games/helicopter/index.tsx:110`. It
handles HTTP Range requests for `<audio>`, which is subtle and load-bearing.

### Keep: `public/music/` (7.2 MB)

All referenced by `app/games/helicopter/sound.ts`. Moving to a CDN is a separate
decision, deliberately out of scope.

### Verification

`npx next build` and `npx vitest run` both pass.

---

## Stage 2 — Redesign (refine the retro theme)

The existing warm-arcade identity (orange/phosphor palette, Press Start 2P,
VT323, CRT scanlines) is kept. It suits the product. The problem is execution
consistency, not the aesthetic.

### Root cause: the type scale is inverted

Across the app, headings render **visually smaller** than body copy:

| Element | Classes | Rendered |
|---|---|---|
| Section heading | `font-display text-sm` | Press Start 2P @ 14px |
| Body copy | `font-mono text-xl` | VT323 @ 20px |

Press Start 2P has a very large per-em glyph; VT323 is a compact terminal face.
Raw Tailwind sizes therefore produce the wrong optical hierarchy. This single
issue is the primary driver of the "unprofessional" impression and it is
inherited by every page.

**Fix:** define a semantic type scale in `globals.css` that encodes the per-font
optical correction once — e.g. `.t-display-lg`, `.t-display-md`, `.t-heading`,
`.t-body`, `.t-caption`. Components consume semantic classes only; no component
picks a raw font-size again.

### Component work

- **Hero** — replace the 12rem emoji on a flat gradient with a real composition
  using the featured game's card art.
- **`GameTile`** — uniform treatment. Currently one game has real art and 49
  render a bare emoji glyph. Emoji fallback becomes a deliberate framed,
  CRT-tinted, consistently-sized presentation so it reads as intentional.
- **`Header` / nav / `Footer`** — consistent spacing rhythm, real hover and
  focus states, plus the account entry point (Stage 3).
- **Tagline** — "free games · no logins · instant fun" must change; accounts
  become available. Replacement: "free games · instant play · no downloads".
  Guest play remains real, so the promise survives. Also update the
  `app/layout.tsx` metadata description, which repeats the "no logins" claim.

### Accessibility

- `focus-visible` rings on all interactive elements.
- Contrast audit: `--muted` (#b8a088) on `--surface` (#2a1810) is marginal for
  small text; darken or enlarge.
- Respect `prefers-reduced-motion` for `.flicker`, `.pixel-edge:hover` wiggle,
  and scanline animation.

---

## Stage 2b — Generated card art

### Constraint

The assistant cannot generate images. This stage delivers a **script the user
runs**, not image files produced directly.

### Approach

`scripts/generate-cards.ts`, invoked via `npm run gen:cards`:

1. Read `lib/games.ts`.
2. Build a prompt per game from `title`, `blurb`, and `accent`, plus a shared
   style suffix pinning a single consistent art direction.
3. Call xAI image generation — `POST https://api.x.ai/v1/images/generations`,
   model `grok-imagine-image-quality`, 16:9 to match the tile `aspect-video`.
4. Write into `public/game-cards/`, convert to WebP.
5. Set `cardImage` for every game in `lib/games.ts`. The emoji fallback in
   `GameTile` stays as a safety net.

### Gate: 3-game pilot

Generate **3 games first** and stop for user review. Style drift across 50
independent generations is the main risk; the style suffix gets tuned against
the pilot before the remaining 47 run.

### Cost and weight

- Flat per-image pricing. The exact rate is not assumed here — confirm on the
  xAI billing page before the 50-image run.
- Reference `helicopter.jpg` is 228 KB; 50 equivalents ≈ 11 MB. WebP conversion
  plus `next/image` responsive `sizes` mitigates this.

### Secrets

`XAI_API_KEY` already exists in the user's `scottapplications` env and is
currently unused in code. The script is **local-only** — this key never needs to
reach Vercel.

---

## Stage 3 — Optional accounts

### Principle

Guest play is never gated. No route requires a session. Accounts are an opt-in
upgrade that adds cross-device persistence, and they carry the guest's existing
token balance across.

The architecture already anticipated this (`lib/platform/player.ts`):

> Phase 2 replaces this with the authenticated account id; the ledger is keyed by
> whatever this returns, so the migration is a matter of mapping anon -> account
> once at sign-up.

### Bug this forces us to fix: dual anonymous identity

There are currently two disagreeing anonymous IDs, both used to key the ledger:

| Location | Key | Example |
|---|---|---|
| Browser | `localStorage["bg:playerId"]` | `anon-abc123` |
| Server | cookie `bg_sid` | `anon-xyz789` |

`lib/platform/player.ts` mints one; `lib/platform/server/getServerEconomy.ts`
mints another. A player's client-side and server-side balances therefore accrue
under different IDs. Stage 3 unifies on the **server cookie as source of truth**;
the client reads its ID from the server rather than minting one.

### Data model

New MongoDB collections:

- **`users`** — `_id`, `email` (stored lowercased, unique index), `passwordHash`,
  `displayName`, `emailVerified: boolean`, `createdAt`.
- **`sessions`** — `_id` (opaque token), `userId`, `createdAt`, `expiresAt` with
  a TTL index for automatic expiry.
- **`tokens`** — single-use email-verification and password-reset tokens:
  `_id`, `userId`, `type`, `expiresAt` (TTL index), `usedAt`.

### Auth mechanics

- **Hashing:** `@node-rs/argon2` (prebuilt binaries for linux-x64-gnu, works on
  Vercel serverless). If the native binding proves problematic in the Vercel
  build, fall back to a pure-JS scrypt via Node `crypto`. Decide during
  implementation, verified against a real deploy — not assumed.
- **Sessions:** opaque random token in an `httpOnly`, `secure`, `sameSite=lax`
  cookie. Server-side lookup; no JWT.
- **Security:** no user enumeration on login, register, or reset (uniform
  responses and timing); rate-limited login attempts; minimum password length;
  timing-safe comparison.

### Anon → account merge

On register, and on login from a device carrying an anon balance:

- The ledger is **append-only** and stays that way. History is never rewritten.
- Merge appends an `adjustment` entry crediting the guest balance to the account,
  rather than re-keying past entries.
- The operation is **idempotent** — repeating it must not double-credit.
- This is the highest-risk logic in the stage and is developed test-first.

### Email — SMTP2GO

Reuses the pattern already proven in `scottapplications`
(`src/app/api/careers/apply/route.ts`): a plain `fetch`, no SDK, no new
dependency.

```ts
await fetch('https://api.smtp2go.com/v3/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key, to, sender, subject, html_body, text_body }),
})
```

Extracted to a shared `lib/email.ts`.

- **Verify email** on register (single-use, time-limited token).
- **Password reset** (single-use, time-limited token).
- Emails use inline `html_body` styled to the arcade theme, rather than the
  existing SMTP2GO template IDs, which carry Scott Applications branding.
- **Graceful degradation:** if `SMTP2GO_API_KEY` / `FROM_EMAIL` are unset,
  registration still succeeds and the send is skipped with a console warning —
  matching the existing careers-route behavior.

### Routes

| Route | Purpose |
|---|---|
| `/login` | Sign in |
| `/register` | Create account |
| `/account` | Profile, balance, sign out |
| `/verify/[token]` | Confirm email |
| `/reset/[token]` | Set new password |
| `POST /api/auth/register` | |
| `POST /api/auth/login` | |
| `POST /api/auth/logout` | |
| `POST /api/auth/request-reset` | |
| `POST /api/auth/reset` | |

### Secrets handling

`SMTP2GO_API_KEY`, `FROM_EMAIL`, and `XAI_API_KEY` are added to `.env.example`
as **names only** (no values), and to local `.env.local`. The user adds them to
the Vercel dashboard manually. No secret is committed or pushed.

---

## Testing

Existing Vitest setup. Test-first for:

- Anon → account ledger merge: correctness, idempotency, append-only invariant.
- Session lifecycle: create, validate, expire, logout.
- Password hashing and verification.
- Token single-use and expiry semantics.
- Email module: correct payload shape, and graceful skip when env is absent.

Stage 1 requires no new tests; existing suite must stay green.

---

## Sequencing

1. **Stage 1** — cleanup. Ships independently.
2. **Stage 2** — redesign. Ships independently.
3. **Stage 2b** — art script, **pauses for 3-image pilot review**.
4. **Stage 3** — accounts.

Each stage is a separate reviewable change set.
