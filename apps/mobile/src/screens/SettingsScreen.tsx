import React from "react";
import { Platform, ScrollView, Share, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { fmtMoney, type PricingRules } from "@embroidery/ledger";
import { Button, Card, Field, Input, MoneyInput, Row } from "../components/ui";
import { allCategories, exportAll, saveCategory } from "../db/repo";
import { supabase } from "../db/supabase";
import { pendingWrites, subscribe, syncError, syncState } from "../db/store";
import { getPricing, setPricing } from "../domain/settings";
import { applyImport, pickImportFile, previewImport } from "../domain/importer";
import { colors, font, space } from "../theme";

export function SettingsScreen() {
  const [rules, setRules] = React.useState<PricingRules>(getPricing);
  const [markup, setMarkup] = React.useState(String(Math.round((rules.garmentMarkup - 1) * 100)));
  const [categories, setCategories] = React.useState(allCategories);
  const [newCat, setNewCat] = React.useState("");
  const [email, setEmail] = React.useState<string>("");
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    return subscribe(bump);
  }, []);

  function savePricing() {
    const pct = parseFloat(markup);
    const next = { ...rules, garmentMarkup: Number.isFinite(pct) ? 1 + pct / 100 : rules.garmentMarkup };
    setRules(next);
    setPricing(next);
    Alert.alert("Pricing saved");
  }

  const [importing, setImporting] = React.useState(false);
  async function importFile() {
    setImporting(true);
    try {
      const file = await pickImportFile();
      if (!file) return;
      const preview = previewImport(file.name, file.text);
      Alert.alert(file.name, preview.summary, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: () => {
            void applyImport(preview)
              .then((msg) => { setCategories(allCategories()); Alert.alert("Done", msg); })
              .catch((e: unknown) => Alert.alert("Import failed", e instanceof Error ? e.message : String(e)));
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Couldn't read that file", e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  async function backup() {
    const json = exportAll();
    const name = `homethread-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else {
      await Share.share({ message: json, title: name });
    }
  }

  const pending = pendingWrites();

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={font.h2}>Signed in</Text>
            <Text style={font.dim}>{email || "…"}</Text>
          </View>
          <Button title="Sign out" kind="ghost" onPress={() => void supabase.auth.signOut()} />
        </Row>
        <Text style={[font.small, { marginTop: space.sm, color: syncState === "error" ? colors.bad : colors.textDim }]}>
          {syncState === "error"
            ? `Couldn't save ${pending} change${pending === 1 ? "" : "s"} yet (${syncError}). Retrying…`
            : pending > 0
              ? `Saving ${pending} change${pending === 1 ? "" : "s"}…`
              : "Everything is saved to the cloud."}
        </Text>
      </Card>

      <Card>
        <Text style={[font.h2, { marginBottom: 4 }]}>Quote defaults</Text>
        <Text style={[font.dim, { marginBottom: space.md }]}>
          The Quote button on an order line uses these. Price = stitches (rounded up to the thousand) × rate, with a per-piece minimum, plus the garment cost marked up.
        </Text>
        <Row style={{ gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Per 1,000 stitches">
              <MoneyInput cents={rules.ratePer1k} onChange={(c) => setRules({ ...rules, ratePer1k: c })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Minimum per piece">
              <MoneyInput cents={rules.minStitchCharge} onChange={(c) => setRules({ ...rules, minStitchCharge: c })} />
            </Field>
          </View>
        </Row>
        <Row style={{ gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Garment markup %">
              <Input value={markup} onChangeText={setMarkup} keyboardType="number-pad" placeholder="50" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Setup fee (new design)">
              <MoneyInput cents={rules.setupFee} onChange={(c) => setRules({ ...rules, setupFee: c })} />
            </Field>
          </View>
        </Row>
        <Text style={[font.small, { marginBottom: space.md }]}>
          Example: 8,200 stitches on a {fmtMoney(600)} blank = {fmtMoney(Math.max(9 * rules.ratePer1k, rules.minStitchCharge) + Math.round(600 * rules.garmentMarkup))}
        </Text>
        <Button title="Save pricing" onPress={savePricing} />
      </Card>

      <Card>
        <Text style={[font.h2, { marginBottom: space.sm }]}>Expense categories</Text>
        {categories.map((c) => (
          <Text key={c.id} style={[font.body, { paddingVertical: 3 }]}>• {c.name}</Text>
        ))}
        <Row style={{ gap: space.sm, marginTop: space.sm }}>
          <Input value={newCat} onChangeText={setNewCat} placeholder="New category" style={{ flex: 1 }} />
          <Button
            title="Add"
            kind="secondary"
            disabled={!newCat.trim()}
            onPress={() => { saveCategory(newCat); setNewCat(""); setCategories(allCategories()); }}
          />
        </Row>
      </Card>

      <Card>
        <Text style={[font.h2, { marginBottom: 4 }]}>Import</Text>
        <Text style={[font.dim, { marginBottom: space.md }]}>
          Bring in history from a spreadsheet: a designs, expenses, or orders CSV (templates are in the project folder), or restore a backup JSON. Importing the same file twice updates rows instead of doubling them.
        </Text>
        <Button title="Import CSV or backup…" kind="secondary" onPress={() => void importFile()} busy={importing} />
      </Card>

      <Card>
        <Text style={[font.h2, { marginBottom: 4 }]}>Backup</Text>
        <Text style={[font.dim, { marginBottom: space.md }]}>
          The database is backed up by Supabase, but a copy of your own never hurts. Receipt photos are not included.
        </Text>
        <Button title="Download backup" kind="secondary" onPress={() => void backup()} />
      </Card>
    </ScrollView>
  );
}
