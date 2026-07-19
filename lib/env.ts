/**
 * Reads an environment variable, trimmed.
 *
 * This exists because of a real incident. A .env file written with CRLF line
 * endings yields values with a trailing "\r" — and MongoDB treats
 * "beavergaming" and "beavergaming\r" as two entirely different databases.
 * The economy adapter happened to call .trim(); the auth store did not, so
 * accounts and the token ledger silently landed in separate databases.
 *
 * Every env read should go through here rather than relying on each call site
 * to remember.
 */
export function envStr(name: string, fallback = ""): string {
  const raw = process.env[name];
  return (raw === undefined || raw === null ? fallback : raw).trim();
}

/** True when the variable is set to a non-empty value after trimming. */
export function hasEnv(name: string): boolean {
  return envStr(name).length > 0;
}
