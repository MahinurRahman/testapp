import Feather from "@react-native-vector-icons/feather";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BUGS, useBugs } from "@/src/bug-config";
import { BigButton } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function BugPicker() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { bugs, toggleBug, setAllBugs, activeCount } = useBugs();
  const allOn = activeCount === BUGS.length;

  const toggle = (k: (typeof BUGS)[number]["key"]) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    toggleBug(k);
  };

  return (
    <View style={styles.root} testID="bug-picker-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="bugs-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headText}>
          <Text style={styles.kicker}>{"// BROKEN BUILD"}</Text>
          <Text style={styles.title}>CHOOSE FAILURES</Text>
        </View>
      </View>

      <View style={styles.counterRow}>
        <Text style={styles.counter} testID="active-bug-count">
          {activeCount}/{BUGS.length} ACTIVE
        </Text>
        <Pressable testID="toggle-all-bugs" onPress={() => setAllBugs(!allOn)} style={styles.allBtn}>
          <Text style={styles.allText}>{allOn ? "CLEAR ALL" : "BREAK ALL"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        {BUGS.map((b, i) => {
          const on = bugs[b.key];
          return (
            <Animated.View key={b.key} entering={FadeInRight.delay(i * 60).duration(300)}>
              <Pressable
                testID={`bug-toggle-${b.key}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(b.key)}
                style={[styles.row, on && styles.rowOn]}
              >
                <View style={[styles.icon, on && styles.iconOn]}>
                  <Feather name={b.icon as any} size={20} color={on ? colors.onError : colors.onSurface} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.code}>{b.code}</Text>
                  <Text style={styles.bugTitle}>{b.title}</Text>
                  <Text style={styles.desc}>{b.desc}</Text>
                </View>
                <View style={[styles.switch, on && styles.switchOn]}>
                  <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {activeCount === 0 ? (
          <Text style={styles.hint} testID="no-bugs-hint">
            Select at least one failure to start.
          </Text>
        ) : null}
        <BigButton
          testID="start-demo-button"
          label="START DEMO →"
          disabled={activeCount === 0}
          onPress={() => router.push("/demo/login")}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
  },
  back: { width: 44, height: 44, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1 },
  kicker: { fontFamily: fonts.mono, fontSize: 12, color: c.error },
  title: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: c.surfaceInverse,
  },
  counter: { fontFamily: fonts.mono, fontSize: 14, fontWeight: "700", color: c.onSurfaceInverse },
  allBtn: { height: 44, paddingHorizontal: 12, justifyContent: "center", borderWidth: 2, borderColor: c.onSurfaceInverse },
  allText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSurfaceInverse },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  rowOn: { backgroundColor: c.surfaceSecondary },
  icon: { width: 44, height: 44, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  iconOn: { backgroundColor: c.error },
  rowText: { flex: 1, gap: 2 },
  code: { fontFamily: fonts.mono, fontSize: 12, color: c.muted },
  bugTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  desc: { fontFamily: fonts.mono, fontSize: 12, color: c.onSurface },
  switch: { width: 52, height: 28, borderWidth: 2, borderColor: c.borderStrong, padding: 2, backgroundColor: c.surface },
  switchOn: { backgroundColor: c.error },
  knob: { width: 20, height: 20, backgroundColor: c.brandPrimary },
  knobOff: { alignSelf: "flex-start" },
  knobOn: { alignSelf: "flex-end", backgroundColor: c.surface },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: c.borderStrong, gap: 8, backgroundColor: c.surface },
  hint: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, textAlign: "center" },
}));
