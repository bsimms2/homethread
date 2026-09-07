import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  STATUS_LABEL,
  fmtMoney,
  fmtPct,
  orderTotals,
  shortDate,
  today,
  type OrderStatus,
  type PaymentMethod,
} from "@embroidery/ledger";
import type { OrdersStackParamList } from "../nav";
import { Button, Card, DateInput, Divider, Field, MoneyInput, Row, Segmented, isIsoDate } from "../components/ui";
import { addPayment, deleteOrder, deletePayment, getOrder, setOrderStatus, type OrderBundle } from "../db/repo";
import { leaveTo } from "../domain/navUtil";
import { colors, font, space } from "../theme";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  quote: "confirmed",
  confirmed: "in_progress",
  in_progress: "done",
  done: "delivered",
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  quote: "Customer said yes",
  confirmed: "Start stitching",
  in_progress: "Mark ready",
  done: "Delivered",
};

export function OrderDetailScreen() {
  const nav = useNavigation<NativeStackNavigationProp<OrdersStackParamList>>();
  const { params } = useRoute<RouteProp<OrdersStackParamList, "OrderDetail">>();
  const [b, setB] = React.useState<OrderBundle | null>(null);
  const reload = React.useCallback(() => setB(getOrder(params.orderId)), [params.orderId]);
  useFocusEffect(reload);

  const [payOpen, setPayOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState<PaymentMethod>("venmo");
  const [receivedOn, setReceivedOn] = React.useState(today());

  if (!b) return <Text style={[font.dim, { padding: space.lg }]}>Order not found.</Text>;
  const { order, lines, payments } = b;
  const t = orderTotals(order, lines, payments);
  const next = NEXT[order.status];

  function advance() {
    if (!next) return;
    setOrderStatus(order.id, next);
    reload();
  }

  function recordPayment() {
    if (amount <= 0) return Alert.alert("Amount", "Enter what she was paid.");
    if (!isIsoDate(receivedOn)) return Alert.alert("Date", "Use YYYY-MM-DD.");
    addPayment({ orderId: order.id, amount, method, receivedOn, note: "" });
    setPayOpen(false);
    setAmount(0);
    reload();
  }

  function confirmDelete() {
    Alert.alert("Delete this order?", "Its items and payments go with it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteOrder(order.id); leaveTo(nav, "OrdersList"); } },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>{order.customerName || "No name"}</Text>
            <Text style={font.dim}>
              {STATUS_LABEL[order.status]} · ordered {shortDate(order.orderedOn)}
              {order.dueOn ? ` · due ${shortDate(order.dueOn)}` : ""}
            </Text>
          </View>
          <Pressable onPress={() => nav.navigate("OrderEdit", { orderId: order.id })}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>Edit</Text>
          </Pressable>
        </Row>
        {order.notes ? <Text style={[font.body, { marginTop: space.sm }]}>{order.notes}</Text> : null}
        {next && (
          <Button title={NEXT_LABEL[order.status] ?? "Next"} onPress={advance} style={{ marginTop: space.md }} />
        )}
      </Card>

      <Card>
        <Text style={[font.h2, { marginBottom: space.sm }]}>Items</Text>
        {lines.map((l) => (
          <Row key={l.id} style={{ paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={font.body}>{l.description || "Item"}</Text>
              <Text style={font.small}>
                {l.qty} × {fmtMoney(l.unitPrice)}
                {l.stitches ? ` · ${l.stitches.toLocaleString()} st` : ""}
              </Text>
            </View>
            <Text style={font.money}>{fmtMoney(l.unitPrice * l.qty)}</Text>
          </Row>
        ))}
        <Divider />
        <Row><Text style={font.dim}>Total</Text><Text style={font.money}>{fmtMoney(t.revenue)}</Text></Row>
        <Row><Text style={font.dim}>Cost</Text><Text style={font.dim}>{fmtMoney(t.cost)}</Text></Row>
        <Row>
          <Text style={font.dim}>Margin</Text>
          <Text style={[font.money, { color: t.margin >= 0 ? colors.good : colors.bad }]}>
            {fmtMoney(t.margin)} ({fmtPct(t.margin, t.revenue)})
          </Text>
        </Row>
      </Card>

      <Card>
        <Row>
          <Text style={font.h2}>Payments</Text>
          <Text style={[font.money, { color: t.balance > 0 ? colors.warn : colors.good }]}>
            {t.balance > 0 ? `${fmtMoney(t.balance)} due` : "Paid in full"}
          </Text>
        </Row>
        {payments.map((p) => (
          <Row key={p.id} style={{ paddingVertical: 6 }}>
            <Text style={font.body}>
              {shortDate(p.receivedOn)} · {p.method}
            </Text>
            <Row style={{ gap: space.md }}>
              <Text style={font.money}>{fmtMoney(p.amount)}</Text>
              <Pressable onPress={() => { deletePayment(p.id); reload(); }}>
                <Text style={{ color: colors.bad }}>✕</Text>
              </Pressable>
            </Row>
          </Row>
        ))}
        {payOpen ? (
          <View style={{ marginTop: space.md }}>
            <Field label="Amount">
              <MoneyInput cents={amount} onChange={setAmount} />
            </Field>
            <Field label="How">
              <Segmented
                value={method}
                options={[{ value: "venmo", label: "Venmo" }, { value: "cash", label: "Cash" }, { value: "other", label: "Other" }]}
                onChange={setMethod}
              />
            </Field>
            <Field label="Received">
              <DateInput value={receivedOn} onChange={setReceivedOn} />
            </Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setPayOpen(false)} style={{ flex: 1 }} />
              <Button title="Record" onPress={recordPayment} style={{ flex: 2 }} />
            </Row>
          </View>
        ) : (
          <Row style={{ gap: space.sm, marginTop: space.md }}>
            {t.balance > 0 && (
              <Button
                title={`Paid in full ${fmtMoney(t.balance)}`}
                kind="secondary"
                onPress={() => { setAmount(t.balance); setPayOpen(true); }}
                style={{ flex: 1 }}
              />
            )}
            <Button title="Add payment" kind="secondary" onPress={() => { setAmount(0); setPayOpen(true); }} style={{ flex: 1 }} />
          </Row>
        )}
      </Card>

      <Button title="Delete order" kind="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}
