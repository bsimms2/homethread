import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useFocusEffect } from "@react-navigation/native";
import { fmtMoney, quoteOrderLine } from "@embroidery/ledger";
import { Button, Card, Empty, Field, Input, MoneyInput, Row } from "../components/ui";
import { allDesigns, deleteDesign, saveDesign, type Design } from "../db/repo";
import { getPricing } from "../domain/settings";
import { colors, font, space } from "../theme";

/**
 * Her design library. One row per digitized design: the name she calls it,
 * its stitch count (from Ink/Stitch or the machine), and what she usually
 * charges and pays for it. Picking one on an order line fills those in.
 */
export function DesignsScreen() {
  const [designs, setDesigns] = React.useState<Design[]>([]);
  const reload = React.useCallback(() => setDesigns(allDesigns()), []);
  useFocusEffect(reload);
  const pricing = React.useMemo(() => getPricing(), []);

  const [editing, setEditing] = React.useState<Design | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [stitches, setStitches] = React.useState("");
  const [price, setPrice] = React.useState(0);
  const [cost, setCost] = React.useState(0);
  const [notes, setNotes] = React.useState("");

  function startNew() {
    setEditing(null);
    setName("");
    setStitches("");
    setPrice(0);
    setCost(0);
    setNotes("");
    setOpen(true);
  }
  function startEdit(d: Design) {
    setEditing(d);
    setName(d.name);
    setStitches(d.stitches ? String(d.stitches) : "");
    setPrice(d.defaultPrice);
    setCost(d.defaultCost);
    setNotes(d.notes);
    setOpen(true);
  }
  function suggestPrice() {
    const st = parseInt(stitches, 10) || 0;
    const q = quoteOrderLine({ stitches: st, qty: 1, garmentCost: cost, needsDigitizing: false }, pricing);
    setPrice(q.unitPrice);
  }
  function save() {
    if (!name.trim()) return Alert.alert("Name", "Give the design a name.");
    saveDesign({
      ...(editing ? { id: editing.id } : {}),
      name,
      stitches: parseInt(stitches, 10) || 0,
      defaultPrice: price,
      defaultCost: cost,
      notes,
    });
    setOpen(false);
    reload();
  }

  return (
    <FlatList
      data={designs}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}
      ListHeaderComponent={
        open ? (
          <Card>
            <Text style={[font.h2, { marginBottom: space.sm }]}>{editing ? "Edit design" : "New design"}</Text>
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="e.g. Mallard, Wood duck, Monogram script" autoCapitalize="words" />
            </Field>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Stitches" hint="Ink/Stitch shows it in the simulator.">
                  <Input value={stitches} onChangeText={setStitches} keyboardType="number-pad" placeholder="8200" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Usual blank cost">
                  <MoneyInput cents={cost} onChange={setCost} />
                </Field>
              </View>
            </Row>
            <Row style={{ gap: space.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <Field label="Usual price">
                  <MoneyInput cents={price} onChange={setPrice} />
                </Field>
              </View>
              <View style={{ marginBottom: space.md }}>
                <Button title="Suggest" kind="secondary" onPress={suggestPrice} />
              </View>
            </Row>
            <Field label="Notes">
              <Input value={notes} onChangeText={setNotes} placeholder="Thread colors, hoop, stabilizer…" multiline style={{ minHeight: 60 }} />
            </Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button title="Save design" onPress={save} style={{ flex: 2 }} />
            </Row>
          </Card>
        ) : (
          <View style={{ marginBottom: space.md }}>
            <Button title="＋ New design" onPress={startNew} />
            {designs.length > 0 && (
              <Text style={[font.small, { marginTop: space.sm }]}>Tap to edit · press and hold to delete</Text>
            )}
          </View>
        )
      }
      ListEmptyComponent={
        open ? null : <Empty title="No designs yet" hint="Add the ones she stitches most. On an order, tap Design to pick one and the stitch count and price fill in." />
      }
      renderItem={({ item: d }) => (
        <Pressable
          onPress={() => startEdit(d)}
          onLongPress={() =>
            Alert.alert(`Delete ${d.name}?`, "Orders that used it are unchanged.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { deleteDesign(d.id); reload(); } },
            ])
          }
          style={s.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={font.body}>{d.name}</Text>
            <Text style={font.small}>
              {d.stitches ? `${d.stitches.toLocaleString()} st` : "no stitch count"}
              {d.defaultCost ? ` · blank ${fmtMoney(d.defaultCost)}` : ""}
            </Text>
          </View>
          <Text style={font.money}>{d.defaultPrice ? fmtMoney(d.defaultPrice) : "—"}</Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: space.md,
    borderRadius: 12,
    marginBottom: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
