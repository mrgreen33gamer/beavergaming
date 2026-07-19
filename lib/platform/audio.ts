"use client";

import { useEffect, useState } from "react";

const KEY = "bg:muted";

let muted = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
const subscribers = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  if (next === muted) return; // don't wake subscribers for a no-op
  muted = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, next ? "1" : "0");
  }
  for (const cb of subscribers) cb(next);
}

/** Returns an unsubscribe function. */
export function subscribeMute(cb: (muted: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [value, setValue] = useState(muted);
  useEffect(() => subscribeMute(setValue), []);
  return [value, setMuted];
}
