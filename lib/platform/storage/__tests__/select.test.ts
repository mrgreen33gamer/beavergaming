import { describe, it, expect } from "vitest";
import { selectAdapter, getStorage, LocalStorageAdapter } from "@/lib/platform/storage";
import { MongoAdapter } from "@/lib/platform/storage/mongo";

describe("selectAdapter (client-safe barrel)", () => {
  it("uses localStorage when MONGODB_URI is absent", () => {
    expect(selectAdapter({})).toBeInstanceOf(LocalStorageAdapter);
  });

  it("uses localStorage when MONGODB_URI is empty", () => {
    expect(selectAdapter({ MONGODB_URI: "" })).toBeInstanceOf(LocalStorageAdapter);
  });

  it("refuses Mongo selection on the client barrel", () => {
    expect(() => selectAdapter({ MONGODB_URI: "mongodb+srv://x" })).toThrow(
      /server-only/i,
    );
  });

  it("getStorage always returns LocalStorageAdapter", () => {
    expect(getStorage()).toBeInstanceOf(LocalStorageAdapter);
  });
});

describe("MongoAdapter", () => {
  it("requires a URI", () => {
    expect(() => new MongoAdapter("")).toThrow(/MONGODB_URI/);
  });

  it("accepts an explicit URI without connecting until used", () => {
    const adapter = new MongoAdapter("mongodb+srv://example.mongodb.net", "beavergaming");
    expect(adapter).toBeInstanceOf(MongoAdapter);
  });
});
