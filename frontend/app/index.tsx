import Feather from "@react-native-vector-icons/feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BUG_KEYS, type BugKey, type Mode, useBugs } from "@/src/bug-config";
import { fonts, makeStyles } from "@/src/theme";

const GOOD_IMG =
  "https://images.unsplash.com/photo-1605106702842-01a887a31122?crop=entropy&cs=srgb&fm=jpg&q=70&w=900";
const BAD_IMG =
  "https://images.unsplash.com/photo-1700605920874-f621a75c6c17?crop=entropy&cs=srgb&fm=jpg&q=70&w=900";

// Scrim stays dark in any theme so white text over photos is always readable.
const SCRIM = ["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"] as const;
const ON_PHOTO = "#FFFFFF";

export default function ModeSelect() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { setMode, setBugList } = useBugs();
  const params = useLocalSearchParams<{ mode?: string; bugs?: string }>();
  const launched = useRef(false);

  // Launch link for automated test systems, e.g. /?mode=broken&bugs=offline,timezone (or bugs=all)
  useEffect(() => {
    if (launched.current || (params.mode !== "good" && params.mode !== "broken")) return;
    launched.current = true;
    setMode(params.mode);
    if (params.mode === "broken") {
      const raw = (params.bugs ?? "").split(",").map((s) => s.trim());
      setBugList(raw.includes("all") ? BUG_KEYS : (raw.filter((k) => BUG_KEYS.includes(k as BugKey)) as BugKey[]));
    } else {
      setBugList([]);
    }
    router.push("/demo/login");
  }, [params.mode, params.bugs, setMode, setBugList]);

  const choose = (m: Mode) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setMode(m);
    router.push(m === "good" ? "/demo/login" : "/bugs");
  };

  return (
    <View style={styles.root} testID="mode-select-screen">
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.kicker}>{"// QA PLAYGROUND"}</Text>
        <Text style={styles.title}>PICK A BUILD</Text>
        <Text style={styles.sub}>Same notes app. Two versions. Choose which one ships.</Text>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={styles.half}>
        <Pressable testID="choose-good-mode" style={styles.fill} onPress={() => choose("good")}>
          <Image source={{ uri: GOOD_IMG }} style={styles.img} contentFit="cover" transition={300} />
          <LinearGradient colors={SCRIM} style={styles.scrim} />
          <View style={styles.label}>
            <View style={[styles.tag, styles.tagGood]}>
              <Text style={styles.tagText}>STABLE</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.big}>GOOD APP</Text>
              <Feather name="arrow-right" size={32} color={ON_PHOTO} />
            </View>
            <Text style={styles.desc}>Everything works as it should.</Text>
          </View>
        </Pressable>
      </Animated.View>

      <View style={styles.divider} />

      <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.half}>
        <Pressable testID="choose-broken-mode" style={styles.fill} onPress={() => choose("broken")}>
          <Image source={{ uri: BAD_IMG }} style={styles.img} contentFit="cover" transition={300} />
          <LinearGradient colors={SCRIM} style={styles.scrim} />
          <View style={[styles.label, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.tag, styles.tagBad]}>
              <Text style={styles.tagTextLight}>FAULTY</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.big}>BROKEN APP</Text>
              <Feather name="arrow-right" size={32} color={ON_PHOTO} />
            </View>
            <Text style={styles.desc}>You pick which features fail.</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong },
  kicker: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: "700", color: c.onSurface, letterSpacing: -1 },
  sub: { fontFamily: fonts.mono, fontSize: 13, color: c.onSurface, marginTop: 4 },
  half: { flex: 1, overflow: "hidden" },
  fill: { flex: 1, justifyContent: "flex-end" },
  img: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" },
  label: { padding: 16, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  big: { fontFamily: fonts.display, fontSize: 40, fontWeight: "700", color: ON_PHOTO, letterSpacing: -1 },
  desc: { fontFamily: fonts.mono, fontSize: 13, color: ON_PHOTO },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: c.borderStrong },
  tagGood: { backgroundColor: c.success },
  tagBad: { backgroundColor: c.error },
  tagText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSuccess },
  tagTextLight: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onError },
  divider: { height: 2, backgroundColor: c.borderStrong },
}));
