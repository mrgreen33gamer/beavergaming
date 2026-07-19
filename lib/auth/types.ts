export interface User {
  id: string;
  /** Always stored lowercased and trimmed. Unique. */
  email: string;
  passwordHash: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface Session {
  /** The opaque token itself, as stored in the cookie. */
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type AuthTokenType = "verify" | "reset";

/** Single-use, time-limited token for email verification or password reset. */
export interface AuthToken {
  id: string;
  userId: string;
  type: AuthTokenType;
  expiresAt: string;
  usedAt: string | null;
}

/**
 * Persistence boundary for accounts, mirroring the StorageAdapter pattern the
 * economy already uses: an in-memory implementation backs the tests, MongoDB
 * backs production, and nothing above this interface knows which is in play.
 */
export interface AuthStore {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  /** Rejects with a DuplicateEmailError if the email is already registered. */
  createUser(user: Omit<User, "id">): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<User, "id">>): Promise<void>;

  createSession(session: Session): Promise<void>;
  findSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;

  createToken(token: AuthToken): Promise<void>;
  findToken(id: string): Promise<AuthToken | null>;
  markTokenUsed(id: string): Promise<void>;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("email already registered");
    this.name = "DuplicateEmailError";
  }
}
