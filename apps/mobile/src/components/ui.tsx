import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { centsToInput, fmtMoney, parseMoney, type Cents } from "@embroidery/ledger";
import { colors, font, radius, space } from "../theme";

// ---------------------------------------------------------------------------
// Layout

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={s.divider} />;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Text style={font.h2}>{title}</Text>
      {hint ? <Text style={[font.dim, { marginTop: space.sm, textAlign: "center" }]}>{hint}</Text> : null}
    </View>
  );
}

export function Stat({ label, cents, tone }: { label: string; cents: Cents; tone?: "good" | "bad" | "auto" }) {
  const t = tone === "auto" ? (cents < 0 ? "bad" : "good") : tone;
  const color = t === "good" ? colors.good : t === "bad" ? colors.bad : colors.text;
  return (
    <View style={s.stat}>
      <Text style={font.small}>{label}</Text>
      <Text style={[font.big, { color, fontSize: 22 }]}>{fmtMoney(cents, { cents: false })}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    kind === "primary" ? colors.accent : kind === "danger" ? colors.badSoft : kind === "secondary" ? colors.cardAlt : "transparent";
  const fg = kind === "primary" ? "#fff" : kind === "danger" ? colors.bad : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

/** Horizontal pill chooser. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: colors.accent }]}
          >
            <Text style={[s.segText, on && { color: "#fff" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inputs

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={[font.small, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textDim} {...props} style={[s.input, props.style]} />;
}

/**
 * A money box that edits as text ("12.50") and reports cents. Keeps its own
 * text so a half-typed "12." doesn't get reformatted out from under her.
 */
export function MoneyInput({
  cents,
  onChange,
  placeholder = "0.00",
  style,
}: {
  cents: Cents;
  onChange: (c: Cents) => void;
  placeholder?: string;
  style?: TextInputProps["style"];
}) {
  const [text, setText] = React.useState(centsToInput(cents));
  const last = React.useRef(cents);
  React.useEffect(() => {
    if (cents !== last.current) {
      last.current = cents;
      setText(centsToInput(cents));
    }
  }, [cents]);
  return (
    <TextInput
      value={text}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      onChangeText={(t) => {
        setText(t);
        const c = parseMoney(t);
        last.current = c ?? 0;
        onChange(c ?? 0);
      }}
      onBlur={() => setText(centsToInput(last.current))}
      style={[s.input, s.money, style]}
    />
  );
}

/** Date typed as YYYY-MM-DD. A native picker is a nicety for later; this never loses data. */
export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.textDim}
      keyboardType="numbers-and-punctuation"
      autoCapitalize="none"
      style={s.input}
    />
  );
}

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.sm },
  empty: { alignItems: "center", padding: space.xl, marginTop: space.xl },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.md, alignItems: "center", justifyContent: "center", minHeight: 46 },
  btnText: { fontSize: 16, fontWeight: "600" },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segItem: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.cardAlt },
  segText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  label: { ...font.small, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  money: { fontVariant: ["tabular-nums"], textAlign: "right" },
});
