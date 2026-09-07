import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { blankStock, fmtMoney, today, type Blank } from "@embroidery/ledger";
import { Button, Card, Empty, Field, Input, MoneyInput, Row, DateInput, isIsoDate } from "../components/ui";
import { allBlanks, deleteBlank, saveBlank } from "../db/repo";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

/**
 * Blank inventory: what she has bought to stitch on, what each cost, and how
 * many are left. "Used" is derived from order lines that point at the blank,
 * so it stays right without her counting.
 */
export function BlanksScreen() {
  const L = useLedger();
  const blanks = allBlanks();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Blank | null>(null);
  const [type, setType] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [purchasedOn, setPurchasedOn] = React.useState(today());
  const [qty, setQty] = React.useState("1");
  const [totalCost, setTotalCost] = React.useState(0);
  const [adjust, setAdjust] = React.useState("0");
  const [notes, setNotes] = React.useState("");

  function startNew() {
    setEditing(null);
    setType(""); setStyle(""); setVendor("Amazon"); setPurchasedOn(today());
    setQty("1"); setTotalCost(0); setAdjust("0"); setNotes("");
    setOpen(true);
  }
  function startEdit(b: Blank) {
    setEditing(b);
    setType(b.type); setStyle(b.style); setVendor(b.vendor); setPurchasedOn(b.purchasedOn ?? "");
    setQty(String(b.qty)); setTotalCost(b.totalCost); setAdjust(String(b.adjust)); setNotes(b.notes);
    setOpen(true);
  }
  function save() {
    const q = parseInt(qty, 10) || 0;
    if (!type.trim()) return Alert.alert("Type", "What is it? Wreath sash, hand towel…");
    if (q <= 0) return Alert.alert("Quantity", "How many came in the pack?");
    if (purchasedOn && !isIsoDate(purchasedOn)) return Alert.alert("Date", "Use YYYY-MM-DD or leave blank.");
    saveBlank({
      ...(editing ? { id: editing.id } : {}),
      type, style, vendor,
      purchasedOn: purchasedOn || null,
      qty: q,
      totalCost,
      unitCost: Math.round(totalCost / q),
      adjust: parseInt(adjust, 10) || 0,
      notes,
    });
    setOpen(false);
    L.reload();
  }

  const totalValue = blanks.reduce((s, b) => s + blankStock(b, L.orders, L.lines).valueRemaining, 0);

  return (
    <FlatList
      data={blanks}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}
      ListHeaderComponent={
        open ? (
          <Card>
            <Text style={[font.h2, { marginBottom: space.sm }]}>{editing ? "Edit blanks" : "New blanks purchase"}</Text>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Type"><Input value={type} onChangeText={setType} placeholder="Wreath Sash" autoCapitalize="words" /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Style / color"><Input value={style} onChangeText={setStyle} placeholder="Linen" autoCapitalize="words" /></Field>
              </View>
            </Row>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Vendor"><Input value={vendor} onChangeText={setVendor} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Purchased"><DateInput value={purchasedOn} onChange={setPurchasedOn} /></Field>
              </View>
            </Row>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Qty in pack"><Input value={qty} onChangeText={setQty} keyboardType="number-pad" /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Total paid"><MoneyInput cents={totalCost} onChange={setTotalCost} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Adjust" hint="e.g. -1 damaged"><Input value={adjust} onChangeText={setAdjust} keyboardType="numbers-and-punctuation" /></Field>
              </View>
            </Row>
            <Text style={[font.small, { marginBottom: space.sm }]}>
              Each: {fmtMoney((parseInt(qty, 10) || 0) > 0 ? Math.round(totalCost / (parseInt(qty, 10) || 1)) : 0)}
            </Text>
            <Field label="Notes"><Input value={notes} onChangeText={setNotes} /></Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} style={{ flex: 2 }} />
            </Row>
          </Card>
        ) : (
          <View style={{ marginBottom: space.md }}>
            <Button title="＋ Bought more blanks" onPress={startNew} />
            <Text style={[font.small, { marginTop: space.sm }]}>
              {blanks.length > 0 ? `On hand at cost: ${fmtMoney(totalValue)} · tap to edit · press and hold to delete` : ""}
            </Text>
          </View>
        )
      }
      ListEmptyComponent={open ? null : <Empty title="No blanks yet" hint="Add each pack she buys. Orders that use a blank count it down automatically." />}
      renderItem={({ item: b }) => {
        const st = blankStock(b, L.orders, L.lines);
        const low = st.remaining <= 2;
        return (
          <Pressable
            onPress={() => startEdit(b)}
            onLongPress={() =>
              Alert.alert(`Delete ${b.type} ${b.style}?`, "Order lines that used it keep their cost but lose the link.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => { deleteBlank(b.id); L.reload(); } },
              ])
            }
            style={s.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={font.body}>{b.type}{b.style ? ` · ${b.style}` : ""}</Text>
              <Text style={font.small}>
                {b.qty} bought{b.purchasedOn ? ` ${b.purchasedOn}` : ""} · {fmtMoney(b.unitCost)} each · {st.used} used
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[font.money, { color: low ? colors.bad : st.remaining <= 5 ? colors.warn : colors.good }]}>{st.remaining} left</Text>
              <Text style={font.small}>{fmtMoney(st.valueRemaining)}</Text>
            </View>
          </Pressable>
        );
      }}
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
