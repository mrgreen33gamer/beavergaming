import { describe, it, expect } from "vitest";
import { LocalStorageAdapter } from "@/lib/platform/storage/localStorage";
import { runAdapterContractTests } from "./adapterContract";

runAdapterContractTests("LocalStorageAdapter", () => new LocalStorageAdapter());

describe("LocalStorageAdapter specifics", () => {
  it("survives corrupt JSON by returning null", async () => {
    localStorage.setItem("bg:save:broken", "{not json");
    const adapter = new LocalStorageAdapter();
    expect(await adapter.get("save", "broken")).toBeNull();
  });

  it("namespaces keys under bg:", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.set("save", "k", 1);
    expect(localStorage.getItem("bg:save:k")).toBe("1");
  });
});
