"use client";

import { useEffect, useRef } from "react";
import { SETTLE } from "../config";

/**
 * Watches a live speed ref while `active`, and fires `onSettled` exactly once
 * when everything comes to rest (speed < restSpeed held for restHoldMs) or the
 * maxCrashMs hard cap trips — so a jittering body can never hang the run.
 * Lifted verbatim from the old inline effect in index.tsx.
 */
export function useSettle(
  active: boolean,
  speedRef: React.RefObject<number>,
  onSettled: () => void,
): void {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    firedRef.current = false;
    const started = Date.now();
    let restSince: number | null = null;
    const finish = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      clearInterval(iv);
      onSettled();
    };
    const checkRest = () => {
      const now = Date.now();
      if ((speedRef.current ?? 0) < SETTLE.restSpeed) {
        restSince ??= now;
        if (now - restSince >= SETTLE.restHoldMs) finish();
      } else {
        restSince = null;
      }
      if (now - started >= SETTLE.maxCrashMs) finish();
    };
    const iv = setInterval(checkRest, 150);
    checkRest();
    return () => clearInterval(iv);
    // onSettled is stable (useCallback in the caller); active is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
