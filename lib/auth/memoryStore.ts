import { randomUUID } from "node:crypto";
import {
  DuplicateEmailError,
  type AuthStore,
  type AuthToken,
  type Session,
  type User,
} from "./types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * In-memory AuthStore for tests and for local development without a database.
 * Everything is lost on restart, which is correct for both uses.
 */
export class MemoryAuthStore implements AuthStore {
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private tokens = new Map<string, AuthToken>();

  async findUserByEmail(email: string): Promise<User | null> {
    const wanted = normalizeEmail(email);
    for (const u of this.users.values()) {
      if (u.email === wanted) return { ...u };
    }
    return null;
  }

  async findUserById(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async createUser(user: Omit<User, "id">): Promise<User> {
    const email = normalizeEmail(user.email);
    if (await this.findUserByEmail(email)) throw new DuplicateEmailError();
    const created: User = { ...user, email, id: randomUUID() };
    this.users.set(created.id, created);
    return { ...created };
  }

  async updateUser(id: string, patch: Partial<Omit<User, "id">>): Promise<void> {
    const existing = this.users.get(id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    if (patch.email) next.email = normalizeEmail(patch.email);
    this.users.set(id, next);
  }

  async createSession(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async findSession(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    return s ? { ...s } : null;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    for (const [id, s] of this.sessions) {
      if (s.userId === userId) this.sessions.delete(id);
    }
  }

  async createToken(token: AuthToken): Promise<void> {
    this.tokens.set(token.id, { ...token });
  }

  async findToken(id: string): Promise<AuthToken | null> {
    const t = this.tokens.get(id);
    return t ? { ...t } : null;
  }

  async markTokenUsed(id: string): Promise<void> {
    const t = this.tokens.get(id);
    if (t) this.tokens.set(id, { ...t, usedAt: new Date().toISOString() });
  }
}
