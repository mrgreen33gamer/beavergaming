import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QualityProvider, useQuality } from "../QualityContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <QualityProvider initialTier="high">{children}</QualityProvider>;
}

describe("QualityContext", () => {
  it("exposes the initial tier's settings", () => {
    const { result } = renderHook(() => useQuality(), { wrapper });
    expect(result.current.settings.tier).toBe("high");
    expect(result.current.settings.shadowMapSize).toBe(2048);
  });

  it("swaps settings when the tier changes", () => {
    const { result } = renderHook(() => useQuality(), { wrapper });
    act(() => result.current.setTier("low"));
    expect(result.current.settings.tier).toBe("low");
    expect(result.current.settings.shadowMapSize).toBe(0);
  });
});
