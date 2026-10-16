"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type SiteMode = "home" | "projects";

interface ModeContextValue {
  mode: SiteMode;
  revealed: boolean;
  setMode: (mode: SiteMode) => void;
  setRevealed: (revealed: boolean) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "home",
  revealed: false,
  setMode: () => {},
  setRevealed: () => {},
});

export function useMode() {
  return useContext(ModeContext);
}

export interface ModeProviderProps {
  initialMode?: SiteMode;
  children: React.ReactNode;
}

export function ModeProvider({
  initialMode = "home",
  children,
}: Readonly<ModeProviderProps>) {
  const [mode, setModeState] = useState<SiteMode>(initialMode);
  const [revealed, setRevealedState] = useState(false);
  const modeRef = useRef<SiteMode>(initialMode);
  const revealedRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const lock = useRef(false);

  // Every mode switch plays the cinematic whip-pan, exactly like Stitch's setMode
  const setMode = useCallback((next: SiteMode) => {
    if (modeRef.current === next || lock.current) return;
    lock.current = true;
    modeRef.current = next;
    revealedRef.current = false;
    setRevealedState(false);
    setModeState(next);
    if (next === "projects") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    const root = document.documentElement;
    root.classList.add("is-transitioning");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      root.classList.remove("is-transitioning");
      lock.current = false;
    }, 700);
  }, []);

  const setRevealed = useCallback((next: boolean) => {
    if (revealedRef.current === next) return;
    revealedRef.current = next;
    setRevealedState(next);
  }, []);

  return (
    <ModeContext.Provider value={{ mode, revealed, setMode, setRevealed }}>
      {children}
    </ModeContext.Provider>
  );
}
