import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { storage } from "@/src/utils/storage";

const CONFIG_KEY = "build_config";

export type Mode = "good" | "broken";
export type BugKey =
  | "forms"
  | "buttons"
  | "crash"
  | "rotation"
  | "slow"
  | "offline"
  | "layout"
  | "memory"
  | "timezone";

export const BUGS: { key: BugKey; code: string; title: string; desc: string; icon: string }[] = [
  { key: "forms", code: "BUG-01", title: "Broken form checks", desc: "Sign-in and note forms accept bad input or fail silently.", icon: "edit-3" },
  { key: "buttons", code: "BUG-02", title: "Buttons that misbehave", desc: "Taps get ignored, hit wrong items, or fire twice.", icon: "mouse-pointer" },
  { key: "crash", code: "BUG-03", title: "App crashes", desc: "Certain actions throw and take the whole app down.", icon: "alert-octagon" },
  { key: "rotation", code: "BUG-04", title: "Rotation loses data", desc: "Turning the phone wipes whatever you typed.", icon: "rotate-cw" },
  { key: "slow", code: "BUG-05", title: "Slow & battery-heavy", desc: "Laggy list, frozen taps and heavy background work.", icon: "battery-charging" },
  { key: "offline", code: "BUG-06", title: "Offline data loss", desc: "Changes made without connection silently vanish.", icon: "wifi-off" },
  { key: "layout", code: "BUG-07", title: "Layout overflow", desc: "Text and buttons spill off screen or get covered.", icon: "maximize" },
  { key: "memory", code: "BUG-08", title: "Memory leak", desc: "Listeners pile up; list duplicates on every return.", icon: "layers" },
  { key: "timezone", code: "BUG-09", title: "Wrong timezone", desc: "Times shown in a hardcoded zone, not the device's.", icon: "clock" },
];

export const BUG_KEYS = BUGS.map((b) => b.key);

type Ctx = {
  mode: Mode;
  bugs: Record<BugKey, boolean>;
  setMode: (m: Mode) => void;
  toggleBug: (k: BugKey) => void;
  setAllBugs: (on: boolean) => void;
  setBugList: (keys: BugKey[]) => void;
  isBroken: (k: BugKey) => boolean;
  activeCount: number;
};

const fromList = (keys: BugKey[]) =>
  Object.fromEntries(BUGS.map((b) => [b.key, keys.includes(b.key)])) as Record<BugKey, boolean>;
const none = fromList([]);

const BugContext = createContext<Ctx | null>(null);

export function BugProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<Mode>("good");
  const [bugs, setBugs] = useState(none);
  const hydrated = useRef(false);

  // Keep the chosen build across reloads so a test run mid-journey stays on the same config.
  useEffect(() => {
    storage.getItem(CONFIG_KEY, null).then((raw) => {
      if (!hydrated.current && typeof raw === "string") {
        try {
          const saved = JSON.parse(raw) as { mode: Mode; bugs: BugKey[] };
          setMode(saved.mode);
          setBugs(fromList(saved.bugs));
        } catch {}
      }
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const on = BUG_KEYS.filter((k) => bugs[k]);
    storage.setItem(CONFIG_KEY, JSON.stringify({ mode, bugs: on }));
  }, [mode, bugs]);

  const toggleBug = useCallback((k: BugKey) => setBugs((b) => ({ ...b, [k]: !b[k] })), []);
  const setAllBugs = useCallback((on: boolean) => setBugs(fromList(on ? BUG_KEYS : [])), []);
  const setBugList = useCallback((keys: BugKey[]) => {
    hydrated.current = true; // explicit choice (e.g. launch link) wins over the saved config
    setBugs(fromList(keys));
  }, []);
  const chooseMode = useCallback((m: Mode) => {
    hydrated.current = true;
    setMode(m);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      mode,
      bugs,
      setMode: chooseMode,
      toggleBug,
      setAllBugs,
      setBugList,
      isBroken: (k) => mode === "broken" && bugs[k],
      activeCount: mode === "broken" ? Object.values(bugs).filter(Boolean).length : 0,
    }),
    [mode, bugs, chooseMode, toggleBug, setAllBugs, setBugList],
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

// Broken "memory": listeners and buffers that are never released.
export const leakedListeners: ((list: any[]) => void)[] = [];
export const leakedHeap: number[][] = [];

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
