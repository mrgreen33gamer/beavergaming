import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("Correct horse battery", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same password here");
    const b = await hashPassword("same password here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password here", a)).toBe(true);
    expect(await verifyPassword("same password here", b)).toBe(true);
  });

  it("records its cost parameters so they can be raised later", async () => {
    const stored = await hashPassword("parameters recorded");
    const [scheme, n, r, p] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBeGreaterThan(1);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it("verifies a hash written with different cost parameters", async () => {
    // Simulates an old hash from before the cost was raised.
    const { randomBytes, scryptSync } = await import("node:crypto");
    const salt = randomBytes(16);
    const legacy = scryptSync("legacy password", salt, 64, { N: 1024, r: 8, p: 1 });
    const stored = `scrypt$1024$8$1$${salt.toString("hex")}$${legacy.toString("hex")}`;
    expect(await verifyPassword("legacy password", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("returns false rather than throwing on a malformed stored hash", async () => {
    for (const bad of [
      "",
      "notahash",
      "scrypt$1$2$3",
      "scrypt$32768$8$1$nothex$nothex",
      "bcrypt$32768$8$1$aabb$ccdd",
      "scrypt$0$8$1$aabb$ccdd",
    ]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });
});

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
  });

  it("accepts a password at the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("rejects absurdly long passwords, which are a DoS lever on a slow KDF", () => {
    expect(validatePassword("a".repeat(201))).toMatch(/at most/);
  });
});
