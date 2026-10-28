import Feather from "@react-native-vector-icons/feather";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Note, OfflineError } from "@/src/api";
import { burnCpu, leakedHeap, leakedListeners, sleep, useBugs } from "@/src/bug-config";
import { DemoHeader } from "@/src/components/ui";
import { type PendingNote, applyOutbox, useOffline } from "@/src/offline";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { formatTime } from "@/src/time";

type Filter = "all" | "notes" | "tasks" | "open" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "notes", label: "NOTES" },
  { key: "tasks", label: "TASKS" },
  { key: "open", label: "OPEN" },
  { key: "done", label: "DONE" },
];

export default function NotesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isBroken } = useBugs();
  const slow = isBroken("slow");
  const brokenButtons = isBroken("buttons");
  const brokenOffline = isBroken("offline");
  const leaky = isBroken("memory");
  const overflow = isBroken("layout");
  const wrongTz = isBroken("timezone");
  const { isOffline, outbox, enqueue, syncVersion, cacheNotes, getCachedNotes } = useOffline();
  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;

  const [notes, setNotes] = useState<PendingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const toggleTaps = useRef<Record<string, number>>({});
  const navigating = useRef(false);

  const load = useCallback(async () => {
    setError("");
    try {
      if (slow) await sleep(2500);
      const list = await api.list();
      if (!brokenOffline) cacheNotes(list);
      const shown = applyOutbox(list, outboxRef.current);
      if (leaky) setNotes((prev) => [...prev, ...shown]);
      else setNotes(shown);
    } catch (e) {
      if (e instanceof OfflineError) {
        // Good: show cached notes + queued changes. Broken: everything disappears.
        setNotes(brokenOffline ? [] : await getCachedNotes());
      } else {
        setError("Could not load notes.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slow, brokenOffline, leaky, cacheNotes, getCachedNotes]);

  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
      if (leaky) {
        // Never removed: every visit adds another listener + buffer.
        leakedListeners.push((list) => setNotes((prev) => [...prev, ...list]));
        leakedHeap.push(new Array(250000).fill(Math.random()));
      }
      load();
    }, [load, leaky]),
  );

  useEffect(() => {
    if (syncVersion > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncVersion]);

  const firstNet = useRef(true);
  useEffect(() => {
    if (firstNet.current) {
      firstNet.current = false;
      return;
    }
    if (!isOffline && outboxRef.current.length > 0) return; // sync will trigger the reload
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  // Broken "slow": heavy work keeps running in the background.
  useEffect(() => {
    if (!slow) return;
    const id = setInterval(() => burnCpu(180), 400);
    return () => clearInterval(id);
  }, [slow]);

  const toggleDone = async (n: Note) => {
    if (brokenButtons) {
      toggleTaps.current[n.id] = (toggleTaps.current[n.id] ?? 0) + 1;
      if (toggleTaps.current[n.id] % 2 === 1) return; // tap ignored
    }
    setNotes((list) => list.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)));
    try {
      await api.update(n.id, { done: !n.done });
    } catch (e) {
      if (e instanceof OfflineError && !brokenOffline) enqueue({ kind: "update", id: n.id, data: { done: !n.done } });
      else if (!(e instanceof OfflineError)) load();
    }
  };

  const remove = async (n: Note) => {
    let target = n;
    if (brokenButtons) {
      // Deletes the neighbouring item instead of the one tapped.
      const idx = notes.findIndex((x) => x.id === n.id);
      target = notes[(idx + 1) % notes.length];
    }
    setNotes((list) => list.filter((x) => x.id !== target.id));
    try {
      await api.remove(target.id);
    } catch (e) {
      if (e instanceof OfflineError && !brokenOffline) enqueue({ kind: "delete", id: target.id });
      else if (!(e instanceof OfflineError)) load();
    }
  };

  const open = (id?: string) => {
    if (!brokenButtons) {
      if (navigating.current) return;
      navigating.current = true;
    }
    router.push(id ? { pathname: "/demo/editor", params: { id } } : "/demo/editor");
  };

  const visible = notes.filter((n) => {
    if (filter === "notes") return !n.is_task;
    if (filter === "tasks") return n.is_task;
    if (filter === "open") return n.is_task && !n.done;
    if (filter === "done") return n.is_task && n.done;
    return true;
  });

  const renderRow = (n: PendingNote, i: number) => (
    <NoteRow
      key={leaky ? `${n.id}-${i}` : n.id}
      note={n}
      heavy={slow}
      overflow={overflow}
      wrongTz={wrongTz}
      onToggle={toggleDone}
      onOpen={open}
      onDelete={remove}
    />
  );
  const listPad = overflow ? 0 : insets.bottom + 96;

  const empty = (
    <View style={styles.empty} testID="notes-empty">
      <Feather name="inbox" size={48} color={colors.onSurface} />
      <Text style={styles.emptyText}>NO NOTES FOUND</Text>
    </View>
  );

  let body;
  if (loading && !slow) {
    body = (
      <View testID="notes-skeleton">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={styles.skelBox} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skelLine, { width: "60%" }]} />
              <View style={[styles.skelLine, { width: "85%" }]} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.errorBox} testID="notes-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable testID="notes-retry-button" onPress={load} style={styles.retry}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  } else if (slow) {
    // Broken "slow": no virtualization, every row does heavy work on render.
    body = (
      <ScrollView testID="notes-list" contentContainerStyle={{ paddingBottom: listPad }}>
        {visible.length === 0 && !loading ? empty : visible.map(renderRow)}
      </ScrollView>
    );
  } else {
    body = (
      <FlatList
        testID="notes-list"
        data={visible}
        keyExtractor={(n, i) => (leaky ? `${n.id}-${i}` : n.id)}
        renderItem={({ item, index }) => renderRow(item, index)}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: listPad }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.onSurface}
          />
        }
      />
    );
  }

  return (
    <View style={styles.root} testID="notes-screen">
      <DemoHeader title="My Notes" />
      {isOffline && !brokenOffline ? (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Feather name="wifi-off" size={14} color={colors.onWarning} />
          <Text style={styles.offlineText}>
            OFFLINE · {outbox.length} CHANGE{outbox.length === 1 ? "" : "S"} WILL SYNC
          </Text>
        </View>
      ) : null}
      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-chip-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.listWrap}>{body}</View>

      <Pressable
        testID="new-note-fab"
        accessibilityRole="button"
        onPress={() => open()}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 16 }, pressed && styles.fabPressed]}
      >
        <Feather name="plus" size={20} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>NEW NOTE</Text>
      </Pressable>
    </View>
  );
}

const NoteRow = memo(function NoteRow({
  note,
  heavy,
  overflow,
  wrongTz,
  onToggle,
  onOpen,
  onDelete,
}: {
  note: PendingNote;
  heavy: boolean;
  overflow: boolean;
  wrongTz: boolean;
  onToggle: (n: Note) => void;
  onOpen: (id: string) => void;
  onDelete: (n: Note) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (heavy) burnCpu(40);
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.row} testID={`note-row-${note.id}`}>
      {note.is_task ? (
        <Pressable
          testID={`note-checkbox-${note.id}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: note.done }}
          hitSlop={8}
          onPress={() => onToggle(note)}
          style={[styles.check, note.done && styles.checkOn]}
        >
          {note.done ? <Feather name="check" size={18} color={colors.onBrandPrimary} /> : null}
        </Pressable>
      ) : (
        <View style={styles.noteIcon}>
          <Feather name="file-text" size={18} color={colors.onSurface} />
        </View>
      )}
      <Pressable
        testID={`note-open-${note.id}`}
        style={[styles.rowBody, overflow && styles.rowBodyOverflow]}
        onPress={() => onOpen(note.id)}
      >
        <Text style={[styles.rowTitle, note.done && styles.rowTitleDone]} numberOfLines={overflow ? undefined : 1}>
          {note.title || "(untitled)"}
        </Text>
        {note.body ? (
          <Text style={styles.rowSub} numberOfLines={overflow ? undefined : 1}>
            {note.body}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.rowTime} testID={`note-time-${note.id}`}>
            {formatTime(note.created_at, wrongTz)}
          </Text>
          {note.pending ? (
            <Text style={styles.pending} testID={`note-pending-${note.id}`}>
              PENDING SYNC
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable testID={`note-delete-${note.id}`} hitSlop={8} onPress={() => onDelete(note)} style={styles.del}>
        <Feather name="trash-2" size={18} color={colors.onSurface} />
      </Pressable>
    </Animated.View>
  );
});

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  chipRow: { height: 56, borderBottomWidth: 2, borderBottomColor: c.borderStrong, justifyContent: "center" },
  chipContent: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: c.brandPrimary },
  chipText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSurface },
  chipTextActive: { color: c.onBrandPrimary },
  listWrap: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 72,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  check: { width: 28, height: 28, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.brandPrimary },
  noteIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, paddingVertical: 14, gap: 2 },
  rowTitle: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  rowTitleDone: { textDecorationLine: "line-through", color: c.muted },
  rowSub: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
  rowBodyOverflow: { flexGrow: 0, flexShrink: 0, flexBasis: 520, width: 520 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  rowTime: { fontFamily: fonts.mono, fontSize: 11, color: c.onSurface },
  pending: { fontFamily: fonts.mono, fontSize: 10, fontWeight: "700", color: c.onWarning, backgroundColor: c.warning, paddingHorizontal: 4 },
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 36, backgroundColor: c.warning, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  offlineText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onWarning },
  del: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 64, gap: 12 },
  emptyText: { fontFamily: fonts.mono, fontSize: 14, fontWeight: "700", color: c.onSurface },
  skeletonRow: { flexDirection: "row", gap: 12, padding: 16, borderBottomWidth: 2, borderBottomColor: c.border, alignItems: "center" },
  skelBox: { width: 28, height: 28, backgroundColor: c.surfaceTertiary },
  skelLine: { height: 12, backgroundColor: c.surfaceTertiary },
  errorBox: { margin: 16, padding: 16, backgroundColor: c.error, gap: 12 },
  errorText: { fontFamily: fonts.mono, fontSize: 14, color: c.onError },
  retry: { alignSelf: "flex-start", borderWidth: 2, borderColor: c.onError, paddingHorizontal: 12, height: 36, justifyContent: "center" },
  retryText: { fontFamily: fonts.mono, fontWeight: "700", color: c.onError },
  fab: {
    position: "absolute",
    right: 16,
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    borderWidth: 2,
    borderColor: c.borderStrong,
  },
  fabPressed: { transform: [{ translateY: 2 }] },
  fabText: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onBrandPrimary, letterSpacing: 1 },
}));
