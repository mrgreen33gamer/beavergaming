import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAuthStore } from "../memoryStore";
import { checkToken, consumeToken, issueToken } from "../tokens";

describe("auth tokens", () => {
  let store: MemoryAuthStore;
  const now = () => new Date("2026-07-19T12:00:00.000Z");

  beforeEach(() => {
    store = new MemoryAuthStore();
  });

  it("accepts a freshly issued token", async () => {
    const token = await issueToken(store, "user-1", "verify", now);
    const result = await checkToken(store, token.id, "verify", now);

    expect(result.ok).toBe(true);
  });

  it("rejects an unknown token", async () => {
    const result = await checkToken(store, "nope", "verify", now);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a reset token presented as a verification token", async () => {
    const token = await issueToken(store, "user-1", "reset", now);
    const result = await checkToken(store, token.id, "verify", now);

    expect(result).toEqual({ ok: false, reason: "wrong_type" });
  });

  it("rejects an expired token", async () => {
    const token = await issueToken(store, "user-1", "reset", now);
    const muchLater = () => new Date("2026-07-20T12:00:00.000Z");

    expect(await checkToken(store, token.id, "reset", muchLater)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token that has already been used", async () => {
    const token = await issueToken(store, "user-1", "reset", now);
    await consumeToken(store, token.id);

    expect(await checkToken(store, token.id, "reset", now)).toEqual({
      ok: false,
      reason: "used",
    });
  });

  it("gives reset tokens a much shorter life than verification tokens", async () => {
    const verify = await issueToken(store, "user-1", "verify", now);
    const reset = await issueToken(store, "user-1", "reset", now);

    expect(new Date(reset.expiresAt).getTime()).toBeLessThan(
      new Date(verify.expiresAt).getTime(),
    );
  });

  it("issues unpredictable, unique token ids", async () => {
    const a = await issueToken(store, "user-1", "verify", now);
    const b = await issueToken(store, "user-1", "verify", now);

    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(32);
  });
});
