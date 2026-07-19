import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCartridge } from "@/lib/platform/useCartridge";
import { CARTRIDGE_HOST_METHODS } from "@/lib/platform/cartridge";

describe("useCartridge", () => {
  beforeEach(() => localStorage.clear());

  it("exposes only the allowed host surface", () => {
    const { result } = renderHook(() => useCartridge("pong"));
    const keys = Object.keys(result.current.host).sort();
    expect(keys).toEqual([...CARTRIDGE_HOST_METHODS].sort());
  });

  it("exposes no token-minting method", () => {
    const { result } = renderHook(() => useCartridge("pong"));
    expect(result.current.host).not.toHaveProperty("awardTokens");
    expect(result.current.host).not.toHaveProperty("appendLedger");
  });

  it("records a high score through reportScore", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      result.current.host.reportScore(500);
    });
    await waitFor(() => expect(result.current.highScore).toBe(500));
  });

  it("awards B-Tokens for a reported score", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      result.current.host.reportScore(1000); // 0.01/pt = 10
    });
    await waitFor(() => expect(result.current.balance).toBe(10));
    expect(result.current.lastAward).toBe(10);
  });

  it("awards B-Tokens for a known event", async () => {
    const { result } = renderHook(() => useCartridge("lights-out"));
    await act(async () => {
      result.current.host.reportEvent("level_cleared");
    });
    await waitFor(() => expect(result.current.balance).toBe(5));
  });

  it("awards nothing for an unknown event", async () => {
    const { result } = renderHook(() => useCartridge("lights-out"));
    await act(async () => {
      result.current.host.reportEvent("free_money");
    });
    await waitFor(() => expect(result.current.lastAward).toBe(0));
    expect(result.current.balance).toBe(0);
  });

  it("round-trips game state", async () => {
    const { result } = renderHook(() => useCartridge("pong"));
    await act(async () => {
      await result.current.host.saveState("k", { v: 1 });
    });
    const loaded = await result.current.host.loadState<{ v: number }>("k");
    expect(loaded).toEqual({ v: 1 });
  });

  it("loads the existing high score on mount", async () => {
    localStorage.setItem("asteroids-highscore", "4200");
    const { result } = renderHook(() => useCartridge("asteroids"));
    await waitFor(() => expect(result.current.highScore).toBe(4200));
  });
});
