import NetInfo from "@react-native-community/netinfo";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api, type Note, setApiOffline } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type PendingNote = Note & { pending?: boolean };

export type Op =
  | { kind: "create"; tempId: string; data: { title: string; body: string; is_task: boolean } }
  | { kind: "update"; id: string; data: Partial<Pick<Note, "title" | "body" | "is_task" | "done">> }
  | { kind: "delete"; id: string };

const OUTBOX_KEY = "offline_outbox";
const CACHE_KEY = "notes_cache";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await storage.getItem(key, null);
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function applyOutbox(list: Note[], ops: Op[]): PendingNote[] {
  let out: PendingNote[] = [...list];
  for (const op of ops) {
    if (op.kind === "create") {
      const now = new Date().toISOString();
      out = [{ id: op.tempId, done: false, created_at: now, updated_at: now, ...op.data, pending: true }, ...out];
    } else if (op.kind === "update") {
      out = out.map((n) => (n.id === op.id ? { ...n, ...op.data, pending: true } : n));
    } else {
      out = out.filter((n) => n.id !== op.id);
    }
  }
  return out;
}

type Ctx = {
  isOffline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (v: boolean) => void;
  outbox: Op[];
  enqueue: (op: Op) => void;
  syncVersion: number;
  cacheNotes: (list: Note[]) => void;
  getCachedNotes: () => Promise<PendingNote[]>;
  clearOffline: () => void;
};

const OfflineContext = createContext<Ctx | null>(null);

export function OfflineProvider({ children }: PropsWithChildren) {
  const [simulatedOffline, setSim] = useState(false);
  const [netDown, setNetDown] = useState(false);
  const [outbox, setOutbox] = useState<Op[]>([]);
  const [syncVersion, setSyncVersion] = useState(0);
  const outboxRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  const isOffline = simulatedOffline || netDown;
  setApiOffline(isOffline);

  useEffect(() => NetInfo.addEventListener((s) => setNetDown(s.isConnected === false)), []);

  useEffect(() => {
    readJson<Op[]>(OUTBOX_KEY, []).then((ops) => {
      outboxRef.current = ops;
      setOutbox(ops);
    });
  }, []);

  const saveOutbox = (ops: Op[]) => {
    outboxRef.current = ops;
    setOutbox(ops);
    storage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  };

  const enqueue = useCallback((op: Op) => saveOutbox([...outboxRef.current, op]), []);

  const setSimulatedOffline = useCallback((v: boolean) => {
    setApiOffline(v || netDown);
    setSim(v);
  }, [netDown]);

  // Back online: replay queued changes in order.
  useEffect(() => {
    if (isOffline || outbox.length === 0 || flushing.current) return;
    flushing.current = true;
    (async () => {
      const ids: Record<string, string> = {};
      let remaining = [...outboxRef.current];
      try {
        while (remaining.length) {
          const op = remaining[0];
          if (op.kind === "create") {
            const created = await api.create(op.data);
            ids[op.tempId] = created.id;
          } else if (op.kind === "update") {
            await api.update(ids[op.id] ?? op.id, op.data);
          } else if (!op.id.startsWith("local-") || ids[op.id]) {
            await api.remove(ids[op.id] ?? op.id);
          }
          remaining = remaining.slice(1);
          saveOutbox(remaining);
        }
      } catch {
        // stays queued; retried on next reconnect
      } finally {
        flushing.current = false;
        setSyncVersion((v) => v + 1);
      }
    })();
  }, [isOffline, outbox.length]);

  const cacheNotes = useCallback((list: Note[]) => {
    storage.setItem(CACHE_KEY, JSON.stringify(list));
  }, []);
  const getCachedNotes = useCallback(
    async () => applyOutbox(await readJson<Note[]>(CACHE_KEY, []), outboxRef.current),
    [],
  );
  const clearOffline = useCallback(() => {
    saveOutbox([]);
    storage.setItem(CACHE_KEY, JSON.stringify([]));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      isOffline,
      simulatedOffline,
      setSimulatedOffline,
      outbox,
      enqueue,
      syncVersion,
      cacheNotes,
      getCachedNotes,
      clearOffline,
    }),
    [isOffline, simulatedOffline, setSimulatedOffline, outbox, enqueue, syncVersion, cacheNotes, getCachedNotes, clearOffline],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside OfflineProvider");
  return ctx;
}
