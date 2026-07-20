import { describe, it, expect } from "vitest";
import { detectTier, settingsFor, QUALITY } from "../quality";

describe("quality tier detection", () => {
  it("flags software / integrated renderers as low", () => {
    expect(detectTier({ renderer: "SwiftShader", maxTextureSize: 4096 })).toBe("low");
    expect(detectTier({ renderer: "Intel(R) UHD Graphics 620", maxTextureSize: 8192 })).toBe("low");
    expect(detectTier({ renderer: "llvmpipe (LLVM 12)", maxTextureSize: 8192 })).toBe("low");
  });

  it("treats a small max texture size as low regardless of name", () => {
    expect(detectTier({ renderer: "GeForce RTX 4090", maxTextureSize: 2048 })).toBe("low");
  });

  it("flags mobile GPUs as med", () => {
    expect(detectTier({ renderer: "Mali-G78", maxTextureSize: 8192 })).toBe("med");
    expect(detectTier({ renderer: "Adreno (TM) 640", maxTextureSize: 8192 })).toBe("med");
    expect(detectTier({ renderer: "Apple M2", maxTextureSize: 16384 })).toBe("med");
  });

  it("flags discrete desktop GPUs as high", () => {
    expect(detectTier({ renderer: "NVIDIA GeForce RTX 3070", maxTextureSize: 16384 })).toBe("high");
    expect(detectTier({ renderer: "AMD Radeon RX 6800", maxTextureSize: 16384 })).toBe("high");
  });

  it("settings scale monotonically with tier", () => {
    expect(QUALITY.low.shadowMapSize).toBe(0);
    expect(QUALITY.med.shadowMapSize).toBe(1024);
    expect(QUALITY.high.shadowMapSize).toBe(2048);
    expect(QUALITY.high.maxPixelRatio).toBeGreaterThan(QUALITY.low.maxPixelRatio);
    expect(settingsFor("med").tier).toBe("med");
  });
});
