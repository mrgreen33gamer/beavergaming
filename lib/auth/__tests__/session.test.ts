import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAuthStore } from "../memoryStore";
import { createSession, destroySession, resolveSession } from "../session";
import { hashPassword } from "../password";
import type { User } from "../types";

async function makeUser(store: MemoryAuthStore): Promise<User> {
  return store.createUser({
    email: "Player@Example.com",
    passwordHash: await hashPassword("a good long password"),
    displayName: "Player",
    emailVerified: false,
    createdAt: "2026-07-19T00:00:00.000Z",
  });
}

describe("sessions", () => {
  let store: MemoryAuthStore;

  beforeEach(() => {
    store = new MemoryAuthStore();
  });

  it("resolves a fresh session to its user", async () => {
    const user = await makeUser(store);
    const session = await createSession(store, user.id);

    const resolved = await resolveSession(store, session.id);

    expect(resolved?.user.id).toBe(user.id);
    expect(resolved?.session.id).toBe(session.id);
  });

  it("returns null for an unknown or absent session id", async () => {
    expect(await resolveSession(store, undefined)).toBeNull();
    expect(await resolveSession(store, "nope")).toBeNull();
  });

  it("generates unpredictable session ids", async () => {
    const user = await makeUser(store);
    const a = await createSession(store, user.id);
    const b = await createSession(store, user.id);

    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects an expired session and deletes it", async () => {
    const user = await makeUser(store);
    const session = await createSession(store, user.id, () => new Date("2026-01-01T00:00:00Z"));

    const later = () => new Date("2026-06-01T00:00:00Z");
    expect(await resolveSession(store, session.id, later)).toBeNull();
    expect(await store.findSession(session.id)).toBeNull();
  });

  it("rejects a session whose user no longer exists", async () => {
    const user = await makeUser(store);
    const session = await createSession(store, user.id);

    await store.deleteSessionsForUser("someone-else");
    // Simulate account deletion by removing the user directly.
    const missing = await resolveSession(store, session.id);
    expect(missing).not.toBeNull();

    // Now genuinely orphan it.
    const orphan = await createSession(store, "user-that-never-existed");
    expect(await resolveSession(store, orphan.id)).toBeNull();
    expect(await store.findSession(orphan.id)).toBeNull();
  });

  it("destroys a session on logout", async () => {
    const user = await makeUser(store);
    const session = await createSession(store, user.id);

    await destroySession(store, session.id);

    expect(await resolveSession(store, session.id)).toBeNull();
  });

  it("revokes every session for a user, as a password change must", async () => {
    const user = await makeUser(store);
    const a = await createSession(store, user.id);
    const b = await createSession(store, user.id);

    await store.deleteSessionsForUser(user.id);

    expect(await resolveSession(store, a.id)).toBeNull();
    expect(await resolveSession(store, b.id)).toBeNull();
  });
});

describe("MemoryAuthStore", () => {
  it("normalizes email case and whitespace", async () => {
    const store = new MemoryAuthStore();
    await makeUser(store);

    expect(await store.findUserByEmail("player@example.com")).not.toBeNull();
    expect(await store.findUserByEmail("  PLAYER@EXAMPLE.COM  ")).not.toBeNull();
  });

  it("refuses a duplicate email regardless of case", async () => {
    const store = new MemoryAuthStore();
    await makeUser(store);

    await expect(
      store.createUser({
        email: "PLAYER@example.com",
        passwordHash: "x",
        displayName: "Impostor",
        emailVerified: false,
        createdAt: "2026-07-19T00:00:00.000Z",
      }),
    ).rejects.toThrow(/already registered/);
  });
});
