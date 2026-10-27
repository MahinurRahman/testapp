import Feather from "@react-native-vector-icons/feather";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBugs } from "@/src/bug-config";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export function ModeBadge() {
  const styles = useStyles();
  const { mode, activeCount } = useBugs();
  const good = mode === "good";
  return (
    <Pressable
      testID="mode-badge"
      accessibilityRole="button"
      onPress={() => router.dismissTo("/")}
      style={({ pressed }) => [styles.badge, good ? styles.badgeGood : styles.badgeBad, pressed && styles.pressed]}
    >
      <View style={[styles.dot, good ? styles.dotGood : styles.dotBad]} />
      <Text style={styles.badgeText}>{good ? "GOOD" : `BROKEN ×${activeCount}`}</Text>
    </Pressable>
  );
}

export function DemoHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable testID="header-back-button" onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
      ) : null}
      <Text style={styles.headerTitle} numberOfLines={1} testID="header-title">
        {title}
      </Text>
      {right}
      <ModeBadge />
    </View>
  );
}

export function BigButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  variant = "dark",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  variant?: "dark" | "light";
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const dark = variant === "dark";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        dark ? styles.bigDark : styles.bigLight,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressedBig,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={dark ? colors.onBrandPrimary : colors.onSurface} />
      ) : (
        <Text style={[styles.bigText, !dark && styles.bigTextLight]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: c.borderStrong,
    paddingHorizontal: 10,
    height: 36,
  },
  badgeGood: { backgroundColor: c.surface },
  badgeBad: { backgroundColor: c.warning },
  dot: { width: 10, height: 10 },
  dotGood: { backgroundColor: c.success },
  dotBad: { backgroundColor: c.error },
  badgeText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSurface },
  pressed: { opacity: 0.6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface, textTransform: "uppercase" },
  big: { height: 56, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.borderStrong },
  bigDark: { backgroundColor: c.brandPrimary },
  bigLight: { backgroundColor: c.surface },
  disabled: { opacity: 0.4 },
  pressedBig: { transform: [{ translateY: 2 }], opacity: 0.85 },
  bigText: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", letterSpacing: 2, color: c.onBrandPrimary },
  bigTextLight: { color: c.onSurface },
}));
