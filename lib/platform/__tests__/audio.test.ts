import { describe, it, expect, beforeEach, vi } from "vitest";
import { isMuted, setMuted, subscribeMute } from "@/lib/platform/audio";

describe("audio mute bus", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
  });

  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false);
  });

  it("reflects a mute change", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it("persists mute across a reload", () => {
    setMuted(true);
    expect(localStorage.getItem("bg:muted")).toBe("1");
  });

  it("notifies subscribers", () => {
    const seen: boolean[] = [];
    subscribeMute((m) => seen.push(m));
    setMuted(true);
    setMuted(false);
    expect(seen).toEqual([true, false]);
  });

  it("stops notifying after unsubscribe", () => {
    const cb = vi.fn();
    const off = subscribeMute(cb);
    off();
    setMuted(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not notify when the value is unchanged", () => {
    const cb = vi.fn();
    subscribeMute(cb);
    setMuted(false);
    expect(cb).not.toHaveBeenCalled();
  });
});
