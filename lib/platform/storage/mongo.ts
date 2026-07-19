import { MongoClient, type Db } from "mongodb";
import type { LedgerEntry, StorageAdapter } from "./types";

/**
 * Server-side StorageAdapter backed by MongoDB Atlas / self-hosted Mongo.
 * Only constructed when MONGODB_URI is set (never on the browser path —
 * getStorage() always returns LocalStorageAdapter).
 */
export class MongoAdapter implements StorageAdapter {
  private client: MongoClient | null = null;
  private dbPromise: Promise<Db> | null = null;
  private readonly uri: string;
  private readonly dbName: string;

  constructor(uri?: string, dbName?: string) {
    this.uri = (uri ?? process.env.MONGODB_URI ?? "").trim();
    this.dbName = (dbName ?? process.env.MONGODB_DB ?? "beavergaming").trim();
    if (!this.uri) {
      throw new Error("MongoAdapter requires MONGODB_URI");
    }
  }

  private async db(): Promise<Db> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        this.client = new MongoClient(this.uri);
        await this.client.connect();
        return this.client.db(this.dbName);
      })();
    }
    return this.dbPromise;
  }

  async get<T>(scope: string, key: string): Promise<T | null> {
    const col = (await this.db()).collection<{ _id: string; value: T }>("kv");
    const doc = await col.findOne({ _id: `${scope}:${key}` });
    if (!doc) return null;
    return doc.value;
  }

  async set(scope: string, key: string, value: unknown): Promise<void> {
    const col = (await this.db()).collection<{ _id: string; value: unknown; updatedAt: string }>("kv");
    await col.updateOne(
      { _id: `${scope}:${key}` },
      { $set: { value, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
  }

  async appendLedger(entry: LedgerEntry): Promise<void> {
    const col = (await this.db()).collection("ledger");
    await col.insertOne({ ...entry });
  }

  async readLedger(playerId: string): Promise<LedgerEntry[]> {
    const col = (await this.db()).collection("ledger");
    const docs = await col.find({ playerId }).sort({ createdAt: 1 }).toArray();
    return docs.map((d) => ({
      id: String(d.id ?? d._id),
      playerId: String(d.playerId),
      gameId: (d.gameId as string | null) ?? null,
      delta: Number(d.delta),
      reason: d.reason as LedgerEntry["reason"],
      balanceAfter: Number(d.balanceAfter),
      createdAt: String(d.createdAt),
    }));
  }

  /** Optional cleanup for tests / graceful shutdown. */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.dbPromise = null;
    }
  }
}
