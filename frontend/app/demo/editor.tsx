import Feather from "@react-native-vector-icons/feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type Note } from "@/src/api";
import { burnCpu, sleep, useBugs } from "@/src/bug-config";
import { BigButton, DemoHeader } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function EditorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isBroken } = useBugs();
  const { width, height } = useWindowDimensions();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .get(id)
      .then(setNote)
      .catch(() => setError("Could not load this note."))
      .finally(() => setLoading(false));
  }, [id]);

  // Broken "crash": opening a completed task blows up the render.
  if (isBroken("crash") && note?.done) {
    throw new Error("TypeError: Cannot read properties of undefined (reading 'completedAt')");
  }

  const formKey = isBroken("rotation") ? (width > height ? "land" : "port") : "stable";

  return (
    <View style={styles.root} testID="editor-screen">
      <DemoHeader title={id ? "Edit note" : "New note"} onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.onSurface} testID="editor-loading" />
        </View>
      ) : error ? (
        <Text style={styles.error} testID="editor-load-error">
          {error}
        </Text>
      ) : (
        <EditorForm key={formKey} note={note} />
      )}
    </View>
  );
}

function EditorForm({ note }: { note: Note | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isBroken } = useBugs();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [isTask, setIsTask] = useState(note?.is_task ?? false);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [crashed, setCrashed] = useState(false);
  const wentBack = useRef(false);

  const slow = isBroken("slow");
  const brokenButtons = isBroken("buttons");

  if (crashed) {
    throw new Error("NullPointerException: note.meta.revision is null");
  }

  const onType = (setter: (v: string) => void) => (v: string) => {
    if (slow) burnCpu(120); // every keystroke stalls
    setter(v);
  };

  const save = async () => {
    if (!isBroken("forms")) {
      if (!title.trim()) {
        setTitleError("Title is required");
        return;
      }
      if (title.trim().length > 80) {
        setTitleError("Title must be 80 characters or less");
        return;
      }
    }
    if (isBroken("crash") && note) {
      setCrashed(true);
      return;
    }
    setSaveError("");
    if (!brokenButtons) setSaving(true);
    try {
      await sleep(700);
      const data = isBroken("forms")
        ? { title, body, is_task: isTask }
        : { title: title.trim(), body: body.trim(), is_task: isTask };
      if (note) await api.update(note.id, data);
      else await api.create(data);
      if (!wentBack.current) {
        wentBack.current = true;
        router.back();
      }
    } catch {
      setSaveError("Save failed. Try again.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        bottomOffset={96}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Pressable
          testID="editor-task-toggle"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isTask }}
          onPress={() => setIsTask((v) => !v)}
          style={styles.taskToggle}
        >
          <View style={[styles.check, isTask && styles.checkOn]}>
            {isTask ? <Feather name="check" size={16} color={colors.onBrandPrimary} /> : null}
          </View>
          <Text style={styles.taskLabel}>THIS IS A TASK</Text>
        </Pressable>

        <TextInput
          testID="editor-title-input"
          value={title}
          onChangeText={onType((v) => {
            setTitle(v);
            if (titleError) setTitleError("");
          })}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          style={[styles.title, titleError && styles.titleError]}
        />
        {titleError ? (
          <Text style={styles.fieldError} testID="editor-title-error">
            {titleError}
          </Text>
        ) : null}
        <TextInput
          testID="editor-body-input"
          value={body}
          onChangeText={onType(setBody)}
          placeholder="Start writing…"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          style={styles.body}
        />
        {saveError ? (
          <Text style={styles.error} testID="editor-save-error">
            {saveError}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <BigButton testID="editor-save-button" label="SAVE" loading={saving} onPress={save} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 24 },
  taskToggle: { flexDirection: "row", alignItems: "center", gap: 12, height: 44, marginBottom: 8 },
  check: { width: 26, height: 26, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.brandPrimary },
  taskLabel: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSurface },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    color: c.onSurface,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
  },
  titleError: { borderBottomColor: c.error },
  fieldError: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.error, marginTop: 6 },
  body: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 22, color: c.onSurface, minHeight: 240, marginTop: 16 },
  error: { fontFamily: fonts.mono, fontSize: 13, color: c.onError, backgroundColor: c.error, padding: 12, margin: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
}));
