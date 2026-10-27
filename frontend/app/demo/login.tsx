import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { burnCpu, useBugs } from "@/src/bug-config";
import { BigButton, DemoHeader } from "@/src/components/ui";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const styles = useStyles();
  const { isBroken } = useBugs();
  const { width, height } = useWindowDimensions();
  // Broken rotation: the form remounts on orientation change and loses its state.
  const formKey = isBroken("rotation") ? (width > height ? "land" : "port") : "stable";
  return (
    <View style={styles.root} testID="login-screen">
      <DemoHeader title="Sign in" onBack={() => router.back()} />
      <LoginForm key={formKey} />
    </View>
  );
}

function LoginForm() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isBroken } = useBugs();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState("");
  const taps = useRef(0);

  const brokenForms = isBroken("forms");
  const brokenButtons = isBroken("buttons");

  const submit = async () => {
    if (brokenButtons) {
      taps.current += 1;
      if (taps.current % 2 === 1) return; // every other tap is swallowed
    }
    if (isBroken("slow")) burnCpu(2500); // UI freezes

    if (brokenForms) {
      // No validation at all; a password with a symbol silently does nothing.
      if (/[^a-zA-Z0-9]/.test(password)) return;
    } else {
      const next: typeof errors = {};
      if (!email.trim()) next.email = "Email is required";
      else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
      if (!password) next.password = "Password is required";
      else if (password.length < 8) next.password = "Password must be at least 8 characters";
      setErrors(next);
      if (next.email || next.password) return;
    }

    setNetError("");
    setLoading(true);
    try {
      await api.reset();
      router.replace("/demo/notes");
    } catch {
      setNetError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={styles.brand}>NOTED.</Text>
      <Text style={styles.lead}>Sign in to your notes & tasks.</Text>

      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        testID="login-email-input"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        placeholder="you@example.com"
        placeholderTextColor={colors.muted}
        keyboardType={brokenForms ? "default" : "email-address"}
        autoCapitalize={brokenForms ? "sentences" : "none"}
        autoCorrect={brokenForms}
        style={[styles.input, errors.email && styles.inputError]}
      />
      {errors.email ? (
        <Text style={styles.error} testID="login-email-error">
          {errors.email}
        </Text>
      ) : null}

      <Text style={styles.label}>PASSWORD</Text>
      <TextInput
        testID="login-password-input"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
        }}
        placeholder="At least 8 characters"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={[styles.input, errors.password && styles.inputError]}
      />
      {errors.password ? (
        <Text style={styles.error} testID="login-password-error">
          {errors.password}
        </Text>
      ) : null}

      {netError ? (
        <Text style={styles.netError} testID="login-network-error">
          {netError}
        </Text>
      ) : null}

      <View style={styles.btnWrap}>
        {brokenButtons ? (
          // Looks like a full button, but only the label itself is tappable.
          <View style={styles.fakeBtn}>
            <Pressable testID="login-submit-button" onPress={submit}>
              <Text style={styles.fakeBtnText}>LOGIN</Text>
            </Pressable>
          </View>
        ) : (
          <BigButton testID="login-submit-button" label="LOGIN" loading={loading} onPress={submit} />
        )}
      </View>
      <Text style={styles.foot}>Any email & password work in this demo.</Text>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { padding: 16, paddingTop: 32 },
  brand: { fontFamily: fonts.display, fontSize: 48, fontWeight: "700", color: c.onSurface, letterSpacing: -2 },
  lead: { fontFamily: fonts.mono, fontSize: 14, color: c.onSurface, marginBottom: 32 },
  label: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.onSurface, marginBottom: 8, marginTop: 16 },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: c.borderStrong,
    paddingHorizontal: 12,
    fontFamily: fonts.mono,
    fontSize: 16,
    color: c.onSurface,
    backgroundColor: c.surface,
  },
  inputError: { borderColor: c.error, backgroundColor: c.surfaceSecondary },
  error: { fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: c.error, marginTop: 6 },
  netError: { fontFamily: fonts.mono, fontSize: 12, color: c.onError, backgroundColor: c.error, padding: 12, marginTop: 16 },
  btnWrap: { marginTop: 32 },
  fakeBtn: { height: 56, alignItems: "center", justifyContent: "center", backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.borderStrong },
  fakeBtnText: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", letterSpacing: 2, color: c.onBrandPrimary },
  foot: { fontFamily: fonts.mono, fontSize: 12, color: c.muted, marginTop: 16, textAlign: "center" },
}));
