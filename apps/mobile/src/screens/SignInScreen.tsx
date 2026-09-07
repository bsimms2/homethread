import React from "react";
import { Platform, Text, View } from "react-native";
import { supabase } from "../db/supabase";
import { Button, Card, Field, Input } from "../components/ui";
import { colors, font, space } from "../theme";

/** Magic-link sign in. No passwords: she taps the link in the email. */
export function SignInScreen() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: Platform.OS === "web" ? { emailRedirectTo: window.location.origin + window.location.pathname } : {},
      });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: space.xl }}>
      <Text style={[font.title, { textAlign: "center", marginBottom: space.xs }]}>HomeThread</Text>
      <Text style={[font.dim, { textAlign: "center", marginBottom: space.xl }]}>Orders, receipts, and what's left over.</Text>
      <Card>
        {sent ? (
          <>
            <Text style={font.h2}>Check your email</Text>
            <Text style={[font.body, { marginTop: space.sm }]}>
              A sign-in link went to {email.trim()}. Open it on this device and you're in. It's good for an hour.
            </Text>
            <Button title="Use a different email" kind="ghost" onPress={() => setSent(false)} style={{ marginTop: space.md }} />
          </>
        ) : (
          <>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                onSubmitEditing={() => void send()}
              />
            </Field>
            {error && <Text style={{ color: colors.bad, marginBottom: space.sm }}>{error}</Text>}
            <Button title="Email me a sign-in link" onPress={() => void send()} busy={busy} disabled={!email.includes("@")} />
          </>
        )}
      </Card>
    </View>
  );
}
