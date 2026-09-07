import React from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fmtMoney, today } from "@embroidery/ledger";
import type { ExpensesStackParamList } from "../nav";
import { Button, Card, DateInput, Field, Input, MoneyInput, Row, Segmented, isIsoDate } from "../components/ui";
import { allCategories, deleteExpense, getExpense, saveExpense } from "../db/repo";
import { captureReceipt, extractReceipt, persistReceiptImage, receiptImageUrl, type CapturedImage } from "../domain/receipt";
import { leaveTo } from "../domain/navUtil";
import { colors, font, space } from "../theme";

type Phase = "idle" | "capturing" | "reading" | "ready";

export function ExpenseEditScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ExpensesStackParamList>>();
  const { params } = useRoute<RouteProp<ExpensesStackParamList, "ExpenseEdit">>();
  const existing = React.useMemo(() => (params.expenseId ? getExpense(params.expenseId) : null), [params.expenseId]);
  const categories = React.useMemo(() => allCategories(), []);

  const [phase, setPhase] = React.useState<Phase>(params.capture ? "capturing" : "ready");
  const [saving, setSaving] = React.useState(false);
  const [image, setImage] = React.useState<CapturedImage | null>(null);
  const [imagePath, setImagePath] = React.useState<string | null>(existing?.receiptImagePath ?? null);
  const [extractionJson, setExtractionJson] = React.useState<string | null>(existing?.extractionJson ?? null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const [vendor, setVendor] = React.useState(existing?.vendor ?? "");
  const [spentOn, setSpentOn] = React.useState(existing?.spentOn ?? today());
  const [amount, setAmount] = React.useState(existing?.amount ?? 0);
  const [tax, setTax] = React.useState(existing?.tax ?? 0);
  const [categoryId, setCategoryId] = React.useState<string | null>(existing?.categoryId ?? null);
  const [note, setNote] = React.useState(existing?.note ?? "");

  React.useEffect(() => {
    nav.setOptions({ title: existing ? "Edit expense" : "New expense" });
  }, [nav, existing]);

  const runCapture = React.useCallback(
    async (source: "camera" | "library") => {
      setPhase("capturing");
      try {
        const img = await captureReceipt(source);
        if (!img) {
          if (!existing && !vendor && amount === 0) leaveTo(nav, "ExpensesList");
          else setPhase("ready");
          return;
        }
        setImage(img);
        setPhase("reading");
        const { draft, rawJson } = await extractReceipt(img, categories.map((c) => c.name));
        setVendor(draft.vendor);
        setSpentOn(draft.spentOn);
        setAmount(draft.amount);
        setTax(draft.tax);
        setCategoryId(categories.find((c) => c.name === draft.categoryName)?.id ?? null);
        if (draft.items.length > 0) {
          setNote(draft.items.map((i) => `${i.description} ${fmtMoney(i.amount)}`).join("\n"));
        }
        setWarning(draft.warning);
        setExtractionJson(rawJson);
      } catch (e) {
        Alert.alert("Couldn't read it", e instanceof Error ? e.message : String(e));
      } finally {
        setPhase("ready");
      }
    },
    [amount, categories, existing, nav, vendor],
  );

  const started = React.useRef(false);
  React.useEffect(() => {
    if (params.capture && !started.current) {
      started.current = true;
      void runCapture(params.capture);
    }
  }, [params.capture, runCapture]);

  async function save() {
    if (saving) return;
    if (amount <= 0) return Alert.alert("Amount", "Enter what was paid.");
    if (!isIsoDate(spentOn)) return Alert.alert("Date", "Use YYYY-MM-DD.");
    setSaving(true);
    try {
      let path = imagePath;
      if (image && !path) path = await persistReceiptImage(image);
      saveExpense({
        ...(existing ? { id: existing.id } : {}),
        vendor: vendor.trim(),
        spentOn,
        amount,
        tax,
        categoryId,
        note,
        receiptImagePath: path,
        extractionJson,
      });
      leaveTo(nav, "ExpensesList");
    } catch (e) {
      setSaving(false);
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert("Delete this expense?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteExpense(existing.id); leaveTo(nav, "ExpensesList"); } },
    ]);
  }

  // A fresh capture previews from its data URI; a stored receipt needs a signed URL.
  const [storedUrl, setStoredUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    void receiptImageUrl(imagePath).then((u) => { if (live) setStoredUrl(u); });
    return () => { live = false; };
  }, [imagePath]);
  const preview = image?.uri ?? storedUrl;

  if (phase === "capturing" || phase === "reading") {
    return (
      <View style={s.center}>
        {preview && phase === "reading" ? <Image source={{ uri: preview }} style={s.thumb} resizeMode="cover" /> : null}
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: space.lg }} />
        <Text style={[font.dim, { marginTop: space.md }]}>{phase === "reading" ? "Reading the receipt…" : "Opening camera…"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {warning && (
          <View style={s.warn}>
            <Text style={{ color: colors.warn }}>⚠ {warning}</Text>
          </View>
        )}
        {preview ? (
          <Image source={{ uri: preview }} style={s.hero} resizeMode="contain" />
        ) : (
          <Row style={{ gap: space.sm, marginBottom: space.md }}>
            <Button title="📷 Camera" kind="secondary" onPress={() => void runCapture("camera")} style={{ flex: 1 }} />
            <Button title="Photos" kind="secondary" onPress={() => void runCapture("library")} style={{ flex: 1 }} />
          </Row>
        )}
        <Card>
          <Field label="Vendor">
            <Input value={vendor} onChangeText={setVendor} placeholder="Hobby Lobby, Amazon, Joann…" autoCapitalize="words" />
          </Field>
          <Row style={{ gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Total paid">
                <MoneyInput cents={amount} onChange={setAmount} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Of which tax">
                <MoneyInput cents={tax} onChange={setTax} />
              </Field>
            </View>
          </Row>
          <Field label="Date">
            <DateInput value={spentOn} onChange={setSpentOn} />
          </Field>
          <Field label="Category">
            <Segmented
              value={categoryId ?? ""}
              options={[...categories.map((c) => ({ value: c.id, label: c.name })), { value: "", label: "None" }]}
              onChange={(v) => setCategoryId(v === "" ? null : v)}
            />
          </Field>
          <Field label="Note / items">
            <Input value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} placeholder="What it was for" />
          </Field>
        </Card>
        {existing && <Button title="Delete expense" kind="danger" onPress={confirmDelete} />}
      </ScrollView>
      <View style={s.footer}>
        <Button title="Save expense" onPress={() => void save()} busy={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  thumb: { width: 160, height: 220, borderRadius: 12, opacity: 0.7 },
  hero: { width: "100%", height: 220, borderRadius: 12, marginBottom: space.md, backgroundColor: colors.cardAlt },
  warn: { backgroundColor: colors.warnSoft, padding: space.md, borderRadius: 10, marginBottom: space.md },
  footer: { padding: space.lg, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
