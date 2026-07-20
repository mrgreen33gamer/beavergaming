"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { settingsFor, type QualitySettings, type QualityTier } from "./quality";

interface QualityCtx {
  settings: QualitySettings;
  setTier: (t: QualityTier) => void;
}

const Ctx = createContext<QualityCtx | null>(null);

export function QualityProvider({
  initialTier = "med",
  children,
}: {
  initialTier?: QualityTier;
  children: React.ReactNode;
}) {
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const value = useMemo<QualityCtx>(
    () => ({ settings: settingsFor(tier), setTier }),
    [tier],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuality(): QualityCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQuality must be used within a QualityProvider");
  return v;
}
