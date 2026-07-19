import { describe, it, expect } from "vitest";
import { selectAdapter } from "@/lib/platform/storage";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { MongoAdapter } from "@/lib/platform/storage/mongo";

describe("selectAdapter", () => {
  it("uses localStorage when MONGODB_URI is absent", () => {
    expect(selectAdapter({})).toBeInstanceOf(LocalStorageAdapter);
  });

  it("uses localStorage when MONGODB_URI is empty", () => {
    expect(selectAdapter({ MONGODB_URI: "" })).toBeInstanceOf(LocalStorageAdapter);
  });

  it("uses Mongo when MONGODB_URI is set", () => {
    expect(selectAdapter({ MONGODB_URI: "mongodb+srv://x" })).toBeInstanceOf(MongoAdapter);
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
