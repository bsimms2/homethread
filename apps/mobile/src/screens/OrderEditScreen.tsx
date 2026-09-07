import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  fmtMoney,
  quoteOrderLine,
  today,
  type OrderStatus,
} from "@embroidery/ledger";
import type { OrdersStackParamList } from "../nav";
import { Button, Card, DateInput, Field, Input, MoneyInput, Row, Segmented, isIsoDate } from "../components/ui";
import {
  allCustomers,
  allDesigns,
  customerByName,
  getOrder,
  saveCustomer,
  saveOrder,
  touchDesign,
  type Design,
  type OrderDraft,
} from "../db/repo";
import { getPricing } from "../domain/settings";
import { colors, font, space } from "../theme";

type Line = OrderDraft["lines"][number] & { key: string };
let keySeq = 0;
const blankLine = (): Line => ({ key: String(++keySeq), description: "", qty: 1, unitPrice: 0, unitCost: 0, stitches: null });

export function OrderEditScreen() {
  const nav = useNavigation<NativeStackNavigationProp<OrdersStackParamList>>();
  const { params } = useRoute<RouteProp<OrdersStackParamList, "OrderEdit">>();
  const existing = React.useMemo(() => (params.orderId ? getOrder(params.orderId) : null), [params.orderId]);
  const customers = React.useMemo(() => allCustomers(), []);
  const designs = React.useMemo(() => allDesigns(), []);
  const pricing = React.useMemo(() => getPricing(), []);

  const [customerName, setCustomerName] = React.useState(existing?.order.customerName ?? "");
  const [status, setStatus] = React.useState<OrderStatus>(existing?.order.status ?? "confirmed");
  const [orderedOn, setOrderedOn] = React.useState(existing?.order.orderedOn ?? today());
  const [dueOn, setDueOn] = React.useState(existing?.order.dueOn ?? "");
  const [notes, setNotes] = React.useState(existing?.order.notes ?? "");
  const [lines, setLines] = React.useState<Line[]>(
    existing && existing.lines.length > 0
      ? existing.lines.map((l) => ({ key: String(++keySeq), description: l.description, qty: l.qty, unitPrice: l.unitPrice, unitCost: l.unitCost, stitches: l.stitches }))
      : [blankLine()],
  );
  /** Which line the design picker is open for; null = closed. */
  const [pickingFor, setPickingFor] = React.useState<string | null>(null);
  const [designQuery, setDesignQuery] = React.useState("");

  React.useEffect(() => {
    nav.setOptions({ title: existing ? "Edit order" : "New order" });
  }, [nav, existing]);

  const suggestions = React.useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (q.length < 1) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 4);
  }, [customerName, customers]);

  const shownDesigns = React.useMemo(() => {
    const q = designQuery.trim().toLowerCase();
    return q ? designs.filter((d) => d.name.toLowerCase().includes(q)) : designs;
  }, [designQuery, designs]);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cost = lines.reduce((s, l) => s + l.unitCost * l.qty, 0);

  function applyQuote(l: Line) {
    const q = quoteOrderLine(
      { stitches: l.stitches ?? 0, qty: l.qty, garmentCost: l.unitCost, needsDigitizing: false },
      pricing,
    );
    update(l.key, { unitPrice: q.unitPrice });
  }

  /** Fill a line from a saved design. Her usual price wins; otherwise quote from the stitch count. */
  function applyDesign(key: string, d: Design) {
    const line = lines.find((l) => l.key === key);
    const unitCost = d.defaultCost || line?.unitCost || 0;
    const unitPrice =
      d.defaultPrice ||
      quoteOrderLine({ stitches: d.stitches, qty: 1, garmentCost: unitCost, needsDigitizing: false }, pricing).unitPrice;
    update(key, {
      description: line?.description.trim() ? line.description : d.name,
      stitches: d.stitches || null,
      unitCost,
      unitPrice,
    });
    touchDesign(d.id);
    setPickingFor(null);
    setDesignQuery("");
  }

  function save() {
    if (!isIsoDate(orderedOn)) return Alert.alert("Order date", "Use YYYY-MM-DD.");
    if (dueOn && !isIsoDate(dueOn)) return Alert.alert("Due date", "Use YYYY-MM-DD, or leave it blank.");
    const kept = lines.filter((l) => l.description.trim() !== "" || l.unitPrice !== 0);
    if (kept.length === 0) return Alert.alert("Nothing on the order", "Add at least one line.");

    const name = customerName.trim();
    let customerId = existing?.order.customerId ?? null;
    if (name) {
      const found = customerByName(name);
      customerId = found ? found.id : saveCustomer({ name, contact: "", notes: "" });
    }
    const id = saveOrder({
      ...(existing ? { id: existing.order.id } : {}),
      customerId,
      customerName: name,
      status,
      orderedOn,
      dueOn: dueOn || null,
      notes,
      lines: kept.map(({ key: _k, ...l }) => ({ ...l, description: l.description.trim(), qty: Math.max(1, l.qty) })),
    });
    if (existing) nav.goBack();
    else nav.replace("OrderDetail", { orderId: id });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Customer">
            <Input value={customerName} onChangeText={setCustomerName} placeholder="Who is it for?" autoCapitalize="words" />
            {suggestions.length > 0 && (
              <View style={s.suggest}>
                {suggestions.map((c) => (
                  <Pressable key={c.id} onPress={() => setCustomerName(c.name)} style={s.suggestRow}>
                    <Text style={font.body}>{c.name}</Text>
                    {c.contact ? <Text style={font.small}>{c.contact}</Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </Field>
          <Field label="Status">
            <Segmented
              value={status}
              options={ORDER_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))}
              onChange={setStatus}
            />
          </Field>
          <Row style={{ gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Ordered">
                <DateInput value={orderedOn} onChange={setOrderedOn} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Due (optional)">
                <DateInput value={dueOn} onChange={setDueOn} />
              </Field>
            </View>
          </Row>
        </Card>

        <Text style={[font.h2, { marginBottom: space.sm }]}>Items</Text>
        {lines.map((l, i) => (
          <Card key={l.key}>
            <Row style={{ marginBottom: space.sm }}>
              <Text style={font.small}>ITEM {i + 1}</Text>
              <Row style={{ gap: space.lg }}>
                {designs.length > 0 && (
                  <Pressable onPress={() => setPickingFor(l.key)}>
                    <Text style={{ color: colors.accent, fontWeight: "600" }}>Design…</Text>
                  </Pressable>
                )}
                {lines.length > 1 && (
                  <Pressable onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Text style={{ color: colors.bad }}>Remove</Text>
                  </Pressable>
                )}
              </Row>
            </Row>
            <Input
              value={l.description}
              onChangeText={(t) => update(l.key, { description: t })}
              placeholder="e.g. Monogrammed towel, navy, 'Sarah'"
              style={{ marginBottom: space.sm }}
            />
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Qty">
                  <Input
                    value={String(l.qty)}
                    keyboardType="number-pad"
                    onChangeText={(t) => update(l.key, { qty: Math.max(0, parseInt(t, 10) || 0) })}
                  />
                </Field>
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Price each">
                  <MoneyInput cents={l.unitPrice} onChange={(c) => update(l.key, { unitPrice: c })} />
                </Field>
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Cost each">
                  <MoneyInput cents={l.unitCost} onChange={(c) => update(l.key, { unitCost: c })} />
                </Field>
              </View>
            </Row>
            <Row style={{ gap: space.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 2 }}>
                <Field label="Stitches (optional)" hint="From the design file. Used for the quote.">
                  <Input
                    value={l.stitches === null ? "" : String(l.stitches)}
                    keyboardType="number-pad"
                    placeholder="e.g. 8200"
                    onChangeText={(t) => update(l.key, { stitches: t.trim() === "" ? null : parseInt(t, 10) || 0 })}
                  />
                </Field>
              </View>
              <View style={{ flex: 1, marginBottom: space.md + 18 }}>
                <Button title="Quote" kind="secondary" onPress={() => applyQuote(l)} disabled={!l.stitches && !l.unitCost} />
              </View>
            </Row>
            <Text style={[font.small, { textAlign: "right" }]}>
              line {fmtMoney(l.unitPrice * l.qty)} · margin {fmtMoney((l.unitPrice - l.unitCost) * l.qty)}
            </Text>
          </Card>
        ))}
        <Button title="＋ Add another item" kind="ghost" onPress={() => setLines((ls) => [...ls, blankLine()])} />
        {designs.length === 0 && (
          <Text style={[font.small, { textAlign: "center", marginTop: space.sm }]}>
            Tip: add her designs under Orders → Designs and they'll fill in stitch count and price here.
          </Text>
        )}

        <Card style={{ marginTop: space.md }}>
          <Field label="Notes">
            <Input value={notes} onChangeText={setNotes} placeholder="Thread colors, font, where to deliver…" multiline style={{ minHeight: 70 }} />
          </Field>
          <Row>
            <Text style={font.dim}>Total {fmtMoney(total)}</Text>
            <Text style={font.dim}>Margin {fmtMoney(total - cost)}</Text>
          </Row>
        </Card>
      </ScrollView>
      <View style={s.footer}>
        <Button title={existing ? "Save changes" : "Save order"} onPress={save} />
      </View>

      <Modal visible={pickingFor !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickingFor(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg }}>
          <Row style={{ marginBottom: space.md }}>
            <Text style={font.title}>Pick a design</Text>
            <Pressable onPress={() => { setPickingFor(null); setDesignQuery(""); }}>
              <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 16 }}>Close</Text>
            </Pressable>
          </Row>
          <Input value={designQuery} onChangeText={setDesignQuery} placeholder="Search…" autoFocus style={{ marginBottom: space.md }} />
          <ScrollView keyboardShouldPersistTaps="handled">
            {shownDesigns.map((d) => (
              <Pressable key={d.id} onPress={() => pickingFor && applyDesign(pickingFor, d)} style={s.designRow}>
                <View style={{ flex: 1 }}>
                  <Text style={font.body}>{d.name}</Text>
                  <Text style={font.small}>
                    {d.stitches ? `${d.stitches.toLocaleString()} st` : "no stitch count"}
                    {d.notes ? ` · ${d.notes}` : ""}
                  </Text>
                </View>
                <Text style={font.money}>{d.defaultPrice ? fmtMoney(d.defaultPrice) : ""}</Text>
              </Pressable>
            ))}
            {shownDesigns.length === 0 && <Text style={[font.dim, { textAlign: "center", marginTop: space.xl }]}>No match.</Text>}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  suggest: { backgroundColor: colors.cardAlt, borderRadius: 8, marginTop: 4 },
  suggestRow: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footer: { padding: space.lg, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  designRow: {
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
