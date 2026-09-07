import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  blankStock,
  fmtMoney,
  quoteOrderLine,
  today,
  type Blank,
  type OrderStatus,
  type Product,
} from "@embroidery/ledger";
import type { OrdersStackParamList } from "../nav";
import { Button, Card, DateInput, Field, Input, MoneyInput, Row, Segmented, isIsoDate } from "../components/ui";
import {
  allBlanks,
  allCustomers,
  allDesigns,
  allLines,
  allOrders,
  allProducts,
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
const blankLine = (): Line => ({
  key: String(++keySeq),
  description: "",
  qty: 1,
  unitPrice: 0,
  unitCost: 0,
  stitches: null,
  blankId: null,
  productId: null,
});

type Picker = { key: string; kind: "product" | "blank" | "design" } | null;

export function OrderEditScreen() {
  const nav = useNavigation<NativeStackNavigationProp<OrdersStackParamList>>();
  const { params } = useRoute<RouteProp<OrdersStackParamList, "OrderEdit">>();
  const existing = React.useMemo(() => (params.orderId ? getOrder(params.orderId) : null), [params.orderId]);
  const customers = React.useMemo(() => allCustomers(), []);
  const designs = React.useMemo(() => allDesigns(), []);
  const products = React.useMemo(() => allProducts(), []);
  const blanks = React.useMemo(() => allBlanks(), []);
  const pricing = React.useMemo(() => getPricing(), []);
  const stock = React.useMemo(() => {
    const orders = allOrders();
    const lines = allLines();
    return new Map(blanks.map((b) => [b.id, blankStock(b, orders, lines)]));
  }, [blanks]);

  const [customerName, setCustomerName] = React.useState(existing?.order.customerName ?? "");
  const [status, setStatus] = React.useState<OrderStatus>(existing?.order.status ?? "confirmed");
  const [orderedOn, setOrderedOn] = React.useState(existing?.order.orderedOn ?? today());
  const [dueOn, setDueOn] = React.useState(existing?.order.dueOn ?? "");
  const [notes, setNotes] = React.useState(existing?.order.notes ?? "");
  const [lines, setLines] = React.useState<Line[]>(
    existing && existing.lines.length > 0
      ? existing.lines.map((l) => ({
          key: String(++keySeq),
          description: l.description,
          qty: l.qty,
          unitPrice: l.unitPrice,
          unitCost: l.unitCost,
          stitches: l.stitches,
          blankId: l.blankId,
          productId: l.productId,
        }))
      : [blankLine()],
  );
  const [picker, setPicker] = React.useState<Picker>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    nav.setOptions({ title: existing ? "Edit order" : "New order" });
  }, [nav, existing]);

  const suggestions = React.useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (q.length < 1) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 4);
  }, [customerName, customers]);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cost = lines.reduce((s, l) => s + l.unitCost * l.qty, 0);

  function closePicker() {
    setPicker(null);
    setQuery("");
  }

  function applyProduct(key: string, p: Product) {
    const line = lines.find((l) => l.key === key);
    const label = p.option ? `${p.name} · ${p.option}` : p.name;
    update(key, {
      description: line?.description.trim() ? line.description : label,
      unitPrice: p.price,
      productId: p.id,
    });
    closePicker();
  }

  function applyBlank(key: string, b: Blank) {
    const line = lines.find((l) => l.key === key);
    const label = b.style ? `${b.type} (${b.style})` : b.type;
    update(key, {
      blankId: b.id,
      unitCost: b.unitCost,
      description: line?.description.trim() ? line.description : label,
    });
    closePicker();
  }

  function applyDesign(key: string, d: Design) {
    const line = lines.find((l) => l.key === key);
    const unitCost = line?.unitCost || d.defaultCost || 0;
    const unitPrice =
      line?.unitPrice ||
      d.defaultPrice ||
      quoteOrderLine({ stitches: d.stitches, qty: 1, garmentCost: unitCost, needsDigitizing: false }, pricing).unitPrice;
    update(key, {
      description: line?.description.trim() ? `${line.description} / ${d.name}` : d.name,
      stitches: d.stitches || null,
      unitCost,
      unitPrice,
    });
    touchDesign(d.id);
    closePicker();
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

  const q = query.trim().toLowerCase();
  const pickerTitle = picker?.kind === "product" ? "Pick from the price list" : picker?.kind === "blank" ? "Pick a blank" : "Pick a design";

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
            <Segmented value={status} options={ORDER_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))} onChange={setStatus} />
          </Field>
          <Row style={{ gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Ordered"><DateInput value={orderedOn} onChange={setOrderedOn} /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Due (optional)"><DateInput value={dueOn} onChange={setDueOn} /></Field>
            </View>
          </Row>
        </Card>

        <Text style={[font.h2, { marginBottom: space.sm }]}>Items</Text>
        {lines.map((l, i) => {
          const blank = l.blankId ? blanks.find((b) => b.id === l.blankId) : undefined;
          const st = blank ? stock.get(blank.id) : undefined;
          return (
            <Card key={l.key}>
              <Row style={{ marginBottom: space.sm }}>
                <Text style={font.small}>ITEM {i + 1}</Text>
                {lines.length > 1 && (
                  <Pressable onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Text style={{ color: colors.bad }}>Remove</Text>
                  </Pressable>
                )}
              </Row>
              <Row style={{ gap: space.sm, marginBottom: space.sm, justifyContent: "flex-start" }}>
                {products.length > 0 && <Button title="Price list" kind="secondary" onPress={() => setPicker({ key: l.key, kind: "product" })} />}
                {blanks.length > 0 && <Button title={blank ? `Blank: ${blank.style || blank.type}` : "Blank"} kind="secondary" onPress={() => setPicker({ key: l.key, kind: "blank" })} />}
                {designs.length > 0 && <Button title="Design" kind="secondary" onPress={() => setPicker({ key: l.key, kind: "design" })} />}
              </Row>
              <Input
                value={l.description}
                onChangeText={(t) => update(l.key, { description: t })}
                placeholder="e.g. Wreath sash · Linen / Cotton / Brown B"
                style={{ marginBottom: space.sm }}
              />
              <Row style={{ gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label="Qty">
                    <Input value={String(l.qty)} keyboardType="number-pad" onChangeText={(t) => update(l.key, { qty: Math.max(0, parseInt(t, 10) || 0) })} />
                  </Field>
                </View>
                <View style={{ flex: 2 }}>
                  <Field label="Price each"><MoneyInput cents={l.unitPrice} onChange={(c) => update(l.key, { unitPrice: c })} /></Field>
                </View>
                <View style={{ flex: 2 }}>
                  <Field label="Cost each"><MoneyInput cents={l.unitCost} onChange={(c) => update(l.key, { unitCost: c })} /></Field>
                </View>
              </Row>
              {blank && st && (
                <Row style={{ marginBottom: space.sm }}>
                  <Text style={font.small}>
                    Uses {blank.type}{blank.style ? ` · ${blank.style}` : ""} · {st.remaining} left
                  </Text>
                  <Pressable onPress={() => update(l.key, { blankId: null })}><Text style={[font.small, { color: colors.accent }]}>unlink</Text></Pressable>
                </Row>
              )}
              <Text style={[font.small, { textAlign: "right" }]}>
                line {fmtMoney(l.unitPrice * l.qty)} · margin {fmtMoney((l.unitPrice - l.unitCost) * l.qty)}
                {l.stitches ? ` · ${l.stitches.toLocaleString()} st` : ""}
              </Text>
            </Card>
          );
        })}
        <Button title="＋ Add another item" kind="ghost" onPress={() => setLines((ls) => [...ls, blankLine()])} />

        <Card style={{ marginTop: space.md }}>
          <Field label="Notes">
            <Input value={notes} onChangeText={setNotes} placeholder="Font, thread color, pickup or delivery…" multiline style={{ minHeight: 70 }} />
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

      <Modal visible={picker !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePicker}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg }}>
          <Row style={{ marginBottom: space.md }}>
            <Text style={font.title}>{pickerTitle}</Text>
            <Pressable onPress={closePicker}><Text style={{ color: colors.accent, fontWeight: "600", fontSize: 16 }}>Close</Text></Pressable>
          </Row>
          <Input value={query} onChangeText={setQuery} placeholder="Search…" autoFocus style={{ marginBottom: space.md }} />
          <ScrollView keyboardShouldPersistTaps="handled">
            {picker?.kind === "product" &&
              products
                .filter((p) => !q || `${p.name} ${p.option}`.toLowerCase().includes(q))
                .map((p) => (
                  <Pressable key={p.id} onPress={() => applyProduct(picker.key, p)} style={s.pickRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={font.body}>{p.name}</Text>
                      <Text style={font.small}>{p.option || "standard"}{p.qty > 1 ? ` · ${p.qty} pieces` : ""}</Text>
                    </View>
                    <Text style={font.money}>{fmtMoney(p.price)}</Text>
                  </Pressable>
                ))}
            {picker?.kind === "blank" &&
              blanks
                .filter((b) => !q || `${b.type} ${b.style}`.toLowerCase().includes(q))
                .map((b) => {
                  const st = stock.get(b.id);
                  return (
                    <Pressable key={b.id} onPress={() => applyBlank(picker.key, b)} style={s.pickRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={font.body}>{b.type}{b.style ? ` · ${b.style}` : ""}</Text>
                        <Text style={font.small}>{fmtMoney(b.unitCost)} each{b.purchasedOn ? ` · bought ${b.purchasedOn}` : ""}</Text>
                      </View>
                      <Text style={[font.money, { color: (st?.remaining ?? 0) <= 0 ? colors.bad : colors.text }]}>{st?.remaining ?? 0} left</Text>
                    </Pressable>
                  );
                })}
            {picker?.kind === "design" &&
              designs
                .filter((d) => !q || d.name.toLowerCase().includes(q))
                .map((d) => (
                  <Pressable key={d.id} onPress={() => applyDesign(picker.key, d)} style={s.pickRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={font.body}>{d.name}</Text>
                      <Text style={font.small}>{d.stitches ? `${d.stitches.toLocaleString()} st` : ""}{d.notes ? ` · ${d.notes}` : ""}</Text>
                    </View>
                    <Text style={font.money}>{d.defaultPrice ? fmtMoney(d.defaultPrice) : ""}</Text>
                  </Pressable>
                ))}
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
  pickRow: {
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
