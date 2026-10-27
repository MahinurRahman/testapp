import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";

export type Mode = "good" | "broken";
export type BugKey = "forms" | "buttons" | "crash" | "rotation" | "slow";

export const BUGS: { key: BugKey; code: string; title: string; desc: string; icon: string }[] = [
  { key: "forms", code: "BUG-01", title: "Broken form checks", desc: "Sign-in and note forms accept bad input or fail silently.", icon: "edit-3" },
  { key: "buttons", code: "BUG-02", title: "Buttons that misbehave", desc: "Taps get ignored, hit wrong items, or fire twice.", icon: "mouse-pointer" },
  { key: "crash", code: "BUG-03", title: "App crashes", desc: "Certain actions throw and take the whole app down.", icon: "alert-octagon" },
  { key: "rotation", code: "BUG-04", title: "Rotation loses data", desc: "Turning the phone wipes whatever you typed.", icon: "rotate-cw" },
  { key: "slow", code: "BUG-05", title: "Slow & battery-heavy", desc: "Laggy list, frozen taps and heavy background work.", icon: "battery-charging" },
];

type Ctx = {
  mode: Mode;
  bugs: Record<BugKey, boolean>;
  setMode: (m: Mode) => void;
  toggleBug: (k: BugKey) => void;
  setAllBugs: (on: boolean) => void;
  isBroken: (k: BugKey) => boolean;
  activeCount: number;
};

const none: Record<BugKey, boolean> = { forms: false, buttons: false, crash: false, rotation: false, slow: false };

const BugContext = createContext<Ctx | null>(null);

export function BugProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<Mode>("good");
  const [bugs, setBugs] = useState(none);

  const toggleBug = useCallback((k: BugKey) => setBugs((b) => ({ ...b, [k]: !b[k] })), []);
  const setAllBugs = useCallback(
    (on: boolean) => setBugs({ forms: on, buttons: on, crash: on, rotation: on, slow: on }),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      mode,
      bugs,
      setMode,
      toggleBug,
      setAllBugs,
      isBroken: (k) => mode === "broken" && bugs[k],
      activeCount: mode === "broken" ? Object.values(bugs).filter(Boolean).length : 0,
    }),
    [mode, bugs, toggleBug, setAllBugs],
  );

  return <BugContext.Provider value={value}>{children}</BugContext.Provider>;
}

export function useBugs() {
  const ctx = useContext(BugContext);
  if (!ctx) throw new Error("useBugs must be used inside BugProvider");
  return ctx;
}

// Synchronously blocks the JS thread — used only by the "slow" bug.
export function burnCpu(ms: number) {
  const end = Date.now() + ms;
  let x = 0;
  while (Date.now() < end) x += Math.sqrt(Math.random());
  return x;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
