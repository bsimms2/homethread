import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { blankStock, fmtMoney, today, type Blank } from "@embroidery/ledger";
import { Button, Card, Empty, Field, Input, MoneyInput, Row, DateInput, Segmented, isIsoDate } from "../components/ui";
import { allBlanks, deleteBlank, saveBlank, saveExpense } from "../db/repo";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

/**
 * Blank inventory: what she has bought to stitch on, what each cost, and how
 * many are left. "Used" is derived from order lines that point at the blank,
 * so it stays right without her counting. Returns and discards are logged
 * against the pack and reduce what's left.
 */
type Reason = "returned" | "damaged" | "gifted" | "other";
const REASON_LABEL: Record<Reason, string> = { returned: "Returned", damaged: "Damaged / discarded", gifted: "Gift / sample", other: "Other" };

export function BlanksScreen() {
  const L = useLedger();
  const blanks = allBlanks();

  // --- add / edit a pack
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Blank | null>(null);
  const [type, setType] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [purchasedOn, setPurchasedOn] = React.useState(today());
  const [qty, setQty] = React.useState("1");
  const [totalCost, setTotalCost] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [alsoExpense, setAlsoExpense] = React.useState(true);

  // --- return / discard
  const [removing, setRemoving] = React.useState<Blank | null>(null);
  const [removeQty, setRemoveQty] = React.useState("1");
  const [reason, setReason] = React.useState<Reason>("returned");
  const [reasonNote, setReasonNote] = React.useState("");
  const [refund, setRefund] = React.useState(0);

  function startNew() {
    setEditing(null);
    setType(""); setStyle(""); setVendor("Amazon"); setPurchasedOn(today());
    setQty("1"); setTotalCost(0); setNotes(""); setAlsoExpense(true);
    setRemoving(null);
    setOpen(true);
  }
  function startEdit(b: Blank) {
    setEditing(b);
    setType(b.type); setStyle(b.style); setVendor(b.vendor); setPurchasedOn(b.purchasedOn ?? "");
    setQty(String(b.qty)); setTotalCost(b.totalCost); setNotes(b.notes); setAlsoExpense(false);
    setRemoving(null);
    setOpen(true);
  }
  function save() {
    const q = parseInt(qty, 10) || 0;
    if (!type.trim()) return Alert.alert("Type", "What is it? Wreath sash, hand towel…");
    if (q <= 0) return Alert.alert("Quantity", "How many came in the pack?");
    if (purchasedOn && !isIsoDate(purchasedOn)) return Alert.alert("Date", "Use YYYY-MM-DD or leave blank.");
    saveBlank({
      ...(editing ? { id: editing.id, adjust: editing.adjust } : { adjust: 0 }),
      type, style, vendor,
      purchasedOn: purchasedOn || null,
      qty: q,
      totalCost,
      unitCost: Math.round(totalCost / q),
      notes,
    });
    if (!editing && alsoExpense && totalCost > 0) {
      saveExpense({
        vendor: vendor.trim() || "Blanks",
        spentOn: purchasedOn || today(),
        amount: totalCost,
        tax: 0,
        categoryId: "cat-blanks",
        note: `Blanks: ${q} ${type.trim()}${style.trim() ? ` ${style.trim()}` : ""}`,
        receiptImagePath: null,
        extractionJson: null,
        isStartup: false,
      });
    }
    setOpen(false);
    L.reload();
  }

  function startRemove(b: Blank) {
    setOpen(false);
    setRemoving(b);
    setRemoveQty("1");
    setReason("returned");
    setReasonNote("");
    setRefund(0);
  }
  function applyRemove() {
    if (!removing) return;
    const n = parseInt(removeQty, 10) || 0;
    if (n <= 0) return Alert.alert("How many?", "Enter the number of blanks going out.");
    const line = `${today()}: ${REASON_LABEL[reason].toLowerCase()} ${n}${reasonNote.trim() ? ` (${reasonNote.trim()})` : ""}`;
    saveBlank({
      ...removing,
      adjust: removing.adjust - n,
      notes: removing.notes ? `${removing.notes}\n${line}` : line,
    });
    if (reason === "returned" && refund > 0) {
      saveExpense({
        vendor: removing.vendor || "Refund",
        spentOn: today(),
        amount: -refund,
        tax: 0,
        categoryId: "cat-blanks",
        note: `Refund: returned ${n} ${removing.type}${removing.style ? ` ${removing.style}` : ""}`,
        receiptImagePath: null,
        extractionJson: null,
        isStartup: false,
      });
    }
    setRemoving(null);
    L.reload();
  }

  const totalValue = blanks.reduce((s, b) => s + blankStock(b, L.orders, L.lines).valueRemaining, 0);

  return (
    <FlatList
      data={blanks}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}
      ListHeaderComponent={
        removing ? (
          <Card>
            <Text style={[font.h2, { marginBottom: 4 }]}>Return or discard</Text>
            <Text style={[font.dim, { marginBottom: space.md }]}>
              {removing.type}{removing.style ? ` · ${removing.style}` : ""} · {blankStock(removing, L.orders, L.lines).remaining} left now
            </Text>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="How many"><Input value={removeQty} onChangeText={setRemoveQty} keyboardType="number-pad" /></Field>
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Why">
                  <Segmented
                    value={reason}
                    options={(Object.keys(REASON_LABEL) as Reason[]).map((r) => ({ value: r, label: REASON_LABEL[r] }))}
                    onChange={setReason}
                  />
                </Field>
              </View>
            </Row>
            {reason === "returned" && (
              <Field label="Refund received (optional)" hint="Logged as money back under Blanks & garments.">
                <MoneyInput cents={refund} onChange={setRefund} />
              </Field>
            )}
            <Field label="Note"><Input value={reasonNote} onChangeText={setReasonNote} placeholder="wrong color, torn, sent to Mom…" /></Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setRemoving(null)} style={{ flex: 1 }} />
              <Button title="Take out of stock" kind="danger" onPress={applyRemove} style={{ flex: 2 }} />
            </Row>
          </Card>
        ) : open ? (
          <Card>
            <Text style={[font.h2, { marginBottom: space.sm }]}>{editing ? "Edit pack" : "New blanks purchase"}</Text>
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
            </Row>
            <Text style={[font.small, { marginBottom: space.sm }]}>
              Each: {fmtMoney((parseInt(qty, 10) || 0) > 0 ? Math.round(totalCost / (parseInt(qty, 10) || 1)) : 0)}
            </Text>
            {!editing && (
              <Field label="Also record the expense?" hint="Adds a Blanks & garments expense for the total so you don't enter it twice.">
                <Segmented value={alsoExpense ? "yes" : "no"} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No, already entered" }]} onChange={(v) => setAlsoExpense(v === "yes")} />
              </Field>
            )}
            <Field label="Notes"><Input value={notes} onChangeText={setNotes} multiline style={{ minHeight: 50 }} /></Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              {editing && <Button title="Return / discard" kind="secondary" onPress={() => startRemove(editing)} style={{ flex: 1 }} />}
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
            </Row>
          </Card>
        ) : (
          <View style={{ marginBottom: space.md }}>
            <Button title="＋ Bought more blanks" onPress={startNew} />
            <Text style={[font.small, { marginTop: space.sm }]}>
              {blanks.length > 0 ? `On hand at cost: ${fmtMoney(totalValue)} · tap a pack to edit or return · press and hold to delete` : ""}
            </Text>
          </View>
        )
      }
      ListEmptyComponent={open || removing ? null : <Empty title="No blanks yet" hint="Add each pack she buys. Orders that use a blank count it down automatically." />}
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
                {b.adjust !== 0 ? ` · ${b.adjust > 0 ? "+" : ""}${b.adjust} adj` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[font.money, { color: low ? colors.bad : st.remaining <= 5 ? colors.warn : colors.good }]}>{st.remaining} left</Text>
              <Pressable onPress={() => startRemove(b)} hitSlop={8}>
                <Text style={[font.small, { color: colors.accent }]}>return / discard</Text>
              </Pressable>
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
