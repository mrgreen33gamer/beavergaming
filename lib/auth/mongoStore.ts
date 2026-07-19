import "server-only";

import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import { envStr } from "@/lib/env";
import { normalizeEmail } from "./memoryStore";
import {
  DuplicateEmailError,
  type AuthStore,
  type AuthToken,
  type Session,
  type User,
} from "./types";

type UserDoc = Omit<User, "id"> & { _id: string };
type SessionDoc = Omit<Session, "id"> & { _id: string; expires: Date };
type TokenDoc = Omit<AuthToken, "id"> & { _id: string; expires: Date };

/**
 * MongoDB-backed AuthStore.
 *
 * The client is cached at module scope because serverless invocations reuse a
 * warm process, and reconnecting per request would exhaust the Atlas
 * connection pool under any real traffic.
 */
export class MongoAuthStore implements AuthStore {
  private static clientPromise: Promise<MongoClient> | null = null;
  private dbPromise: Promise<Db> | null = null;
  private indexesReady: Promise<void> | null = null;

  private readonly uri: string;
  private readonly dbName: string;

  constructor(uri?: string, dbName?: string) {
    // Trimmed without exception: a CRLF-terminated .env value silently
    // resolves to a *different* database, which is how accounts and the
    // token ledger once ended up in separate places.
    this.uri = (uri ?? envStr("MONGODB_URI")).trim();
    this.dbName = (dbName ?? envStr("MONGODB_DB", "beavergaming")).trim() || "beavergaming";
    if (!this.uri) throw new Error("MongoAuthStore requires MONGODB_URI");
  }

  private async db(): Promise<Db> {
    if (!this.dbPromise) {
      MongoAuthStore.clientPromise ??= new MongoClient(this.uri).connect();
      this.dbPromise = MongoAuthStore.clientPromise.then((c) => c.db(this.dbName));
    }
    return this.dbPromise;
  }

  /**
   * Created on first use rather than in a migration step. The unique index on
   * email is the actual guard against duplicate accounts — the read-then-write
   * check in createUser races under concurrency and cannot be relied on alone.
   */
  private async ready(): Promise<Db> {
    const db = await this.db();
    this.indexesReady ??= (async () => {
      await Promise.all([
        db.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true }),
        db.collection<SessionDoc>("sessions").createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
        db.collection<SessionDoc>("sessions").createIndex({ userId: 1 }),
        db.collection<TokenDoc>("authTokens").createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
      ]);
    })();
    await this.indexesReady;
    return db;
  }

  private async users(): Promise<Collection<UserDoc>> {
    return (await this.ready()).collection<UserDoc>("users");
  }
  private async sessions(): Promise<Collection<SessionDoc>> {
    return (await this.ready()).collection<SessionDoc>("sessions");
  }
  private async tokens(): Promise<Collection<TokenDoc>> {
    return (await this.ready()).collection<TokenDoc>("authTokens");
  }

  private static toUser(doc: UserDoc): User {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const doc = await (await this.users()).findOne({ email: normalizeEmail(email) });
    return doc ? MongoAuthStore.toUser(doc) : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const doc = await (await this.users()).findOne({ _id: id });
    return doc ? MongoAuthStore.toUser(doc) : null;
  }

  async createUser(user: Omit<User, "id">): Promise<User> {
    const doc: UserDoc = { ...user, email: normalizeEmail(user.email), _id: randomUUID() };
    try {
      await (await this.users()).insertOne(doc);
    } catch (err) {
      // 11000 is the unique-index violation, i.e. the email is taken.
      if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
      throw err;
    }
    return MongoAuthStore.toUser(doc);
  }

  async updateUser(id: string, patch: Partial<Omit<User, "id">>): Promise<void> {
    const next = { ...patch };
    if (next.email) next.email = normalizeEmail(next.email);
    if (Object.keys(next).length === 0) return;
    await (await this.users()).updateOne({ _id: id }, { $set: next });
  }

  async addXp(userId: string, amount: number): Promise<number> {
    if (amount <= 0) return (await this.findUserById(userId))?.xp ?? 0;
    // $inc so concurrent grants from two tabs cannot lose each other.
    const res = await (await this.users()).findOneAndUpdate(
      { _id: userId },
      { $inc: { xp: amount } },
      { returnDocument: "after" },
    );
    return res?.xp ?? 0;
  }

  async createSession(session: Session): Promise<void> {
    const { id, ...rest } = session;
    await (await this.sessions()).insertOne({
      ...rest,
      _id: id,
      // Duplicate of expiresAt as a Date, because the TTL index needs a BSON
      // date and the domain type carries an ISO string.
      expires: new Date(session.expiresAt),
    });
  }

  async findSession(id: string): Promise<Session | null> {
    const doc = await (await this.sessions()).findOne({ _id: id });
    if (!doc) return null;
    // Built explicitly rather than by spreading, so the TTL-index `expires`
    // field stays out of the domain object.
    return {
      id: doc._id,
      userId: doc.userId,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };
  }

  async deleteSession(id: string): Promise<void> {
    await (await this.sessions()).deleteOne({ _id: id });
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await (await this.sessions()).deleteMany({ userId });
  }

  async createToken(token: AuthToken): Promise<void> {
    const { id, ...rest } = token;
    await (await this.tokens()).insertOne({
      ...rest,
      _id: id,
      expires: new Date(token.expiresAt),
    });
  }

  async findToken(id: string): Promise<AuthToken | null> {
    const doc = await (await this.tokens()).findOne({ _id: id });
    if (!doc) return null;
    return {
      id: doc._id,
      userId: doc.userId,
      type: doc.type,
      expiresAt: doc.expiresAt,
      usedAt: doc.usedAt,
    };
  }

  async markTokenUsed(id: string): Promise<void> {
    await (await this.tokens()).updateOne(
      { _id: id },
      { $set: { usedAt: new Date().toISOString() } },
    );
  }
}
