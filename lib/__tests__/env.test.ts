import { afterEach, describe, expect, it } from "vitest";
import { envStr, hasEnv } from "../env";

const KEY = "BG_TEST_ENV_VAR";

afterEach(() => {
  delete process.env[KEY];
});

describe("envStr", () => {
  /**
   * The regression this guards: a .env written with CRLF endings produced
   * MONGODB_DB="beavergaming\r", and MongoDB treats that as a different
   * database from "beavergaming". Accounts and the token ledger ended up in
   * two separate databases because one call site trimmed and another did not.
   */
  it("strips a trailing carriage return from a CRLF .env file", () => {
    process.env[KEY] = "beavergaming\r";
    expect(envStr(KEY)).toBe("beavergaming");
  });

  it("strips surrounding whitespace and newlines", () => {
    process.env[KEY] = "  value \n";
    expect(envStr(KEY)).toBe("value");
  });

  it("returns the fallback when unset", () => {
    expect(envStr(KEY, "fallback")).toBe("fallback");
  });

  it("trims the fallback too", () => {
    expect(envStr(KEY, " fallback\r")).toBe("fallback");
  });

  it("returns an empty string when unset with no fallback", () => {
    expect(envStr(KEY)).toBe("");
  });

  it("treats a whitespace-only value as empty", () => {
    process.env[KEY] = "   \r\n";
    expect(envStr(KEY)).toBe("");
    expect(hasEnv(KEY)).toBe(false);
  });

  it("reports a real value as present", () => {
    process.env[KEY] = "beavergaming\r";
    expect(hasEnv(KEY)).toBe(true);
  });
});
