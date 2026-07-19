import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

export { MIN_PASSWORD_LENGTH, validatePassword } from "./passwordPolicy";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt from Node's standard library, not argon2 via a native addon.
 *
 * argon2id is the stronger modern default, but every JS binding ships a
 * platform-specific binary, which is exactly the class of dependency that
 * broke this project's Vercel build once already (the mongodb driver pulling
 * Node built-ins into the client bundle). scrypt is memory-hard, in the
 * standard library, and needs no build step — the right trade for a free
 * games site holding no payment data.
 */
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * N=32768, r=8 costs 128 * N * r = 32 MiB per hash, which is exactly Node's
 * default maxmem and therefore throws. maxmem is raised to 64 MiB to leave
 * headroom. The cost parameters are written into every stored hash so these
 * values can be raised later without invalidating existing passwords.
 */
const PARAMS: Required<Pick<ScryptOptions, "N" | "r" | "p" | "maxmem">> = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

/** Returns "scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

/**
 * Constant-time verification against the parameters recorded in the stored
 * hash, so hashes written under older settings keep verifying. Returns false
 * rather than throwing on a malformed value, so one corrupt row cannot 500
 * the login route.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N <= 1 || r <= 0 || p <= 0) return false;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;

  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;

  try {
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, {
      N,
      r,
      p,
      // Derived from the stored parameters so old hashes with different costs
      // still verify, with a floor for the current default.
      maxmem: Math.max(PARAMS.maxmem, 256 * N * r),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
