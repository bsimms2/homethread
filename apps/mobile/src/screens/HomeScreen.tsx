import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  STAGE_LABEL,
  STAGE_OF,
  blankStock,
  fmtMoney,
  fmtPct,
  monthPeriod,
  orderTotals,
  periodLabel,
  profitAndLoss,
  shortDate,
  startupPayback,
  today,
  type Order,
  type Stage,
} from "@embroidery/ledger";
import type { TabParamList } from "../nav";
import { Button, Card, Row, Stat } from "../components/ui";
import { allBlanks } from "../db/repo";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

export function HomeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const L = useLedger();
  const now = new Date();
  const period = monthPeriod(now.getFullYear(), now.getMonth() + 1);
  const pnl = profitAndLoss(period, L.orders, L.lines, L.payments, L.expenses);

  const byStage = (st: Stage): Order[] =>
    L.orders
      .filter((o) => STAGE_OF[o.status] === st)
      .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.orderedOn.localeCompare(b.orderedOn));
  const toMake = byStage("to_make");
  const ready = byStage("ready");
  const finished = byStage("finished");

  const owed = L.orders
    .map((o) => ({ o, t: orderTotals(o, L.lines, L.payments) }))
    .filter((x) => x.o.status !== "quote" && x.o.status !== "cancelled" && x.t.balance > 0);
  const owedTotal = owed.reduce((s, x) => s + x.t.balance, 0);
  const payback = startupPayback(L.orders, L.lines, L.payments, L.expenses);
  const lowBlanks = allBlanks()
    .map((b) => ({ b, st: blankStock(b, L.orders, L.lines) }))
    .filter((x) => x.st.remaining <= 2);

  const openOrder = (id: string) => nav.navigate("OrdersTab", { screen: "OrderDetail", params: { orderId: id }, initial: false });

  const OrderRow = ({ o }: { o: Order }) => {
    const t = orderTotals(o, L.lines, L.payments);
    const late = o.dueOn !== null && o.dueOn < today() && STAGE_OF[o.status] === "to_make";
    return (
      <Pressable onPress={() => openOrder(o.id)} style={s.line}>
        <View style={{ flex: 1 }}>
          <Text style={font.body}>{o.customerName || "No name"}</Text>
          <Text style={[font.small, late && { color: colors.bad }]}>
            {L.lines.find((l) => l.orderId === o.id)?.description ?? ""}
            {o.dueOn ? ` · due ${shortDate(o.dueOn)}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={font.money}>{fmtMoney(t.revenue, { cents: false })}</Text>
          <Text style={[font.small, { color: t.balance <= 0 && t.revenue > 0 ? colors.good : colors.warn }]}>
            {t.revenue === 0 ? "no price" : t.balance <= 0 ? "paid" : "unpaid"}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Text style={[font.small, { marginBottom: space.sm }]}>{periodLabel(period).toUpperCase()}</Text>
      <Row style={{ gap: space.sm, marginBottom: space.md }}>
        <Stat label="Billed" cents={pnl.revenue} />
        <Stat label="Received" cents={pnl.cashReceived} tone="good" />
        <Stat label="Spent" cents={pnl.expenses} />
      </Row>

      <Row style={{ gap: space.sm, marginBottom: space.lg }}>
        <Button
          title="📷  Snap a receipt"
          onPress={() => nav.navigate("ExpensesTab", { screen: "ExpenseEdit", params: { capture: "camera" }, initial: false })}
          style={{ flex: 1 }}
        />
        <Button title="＋ Order" kind="secondary" onPress={() => nav.navigate("OrdersTab", { screen: "OrderEdit", params: {}, initial: false })} style={{ flex: 1 }} />
      </Row>

      <Card>
        <Row>
          <Text style={font.h2}>{STAGE_LABEL.to_make} · {toMake.length}</Text>
          <Pressable onPress={() => nav.navigate("OrdersTab", { screen: "OrdersList" })}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>All orders</Text>
          </Pressable>
        </Row>
        {toMake.length === 0 ? (
          <Text style={[font.dim, { marginTop: space.sm }]}>Nothing waiting to be stitched.</Text>
        ) : (
          toMake.slice(0, 8).map((o) => <OrderRow key={o.id} o={o} />)
        )}
        {toMake.length > 8 && <Text style={[font.small, { marginTop: space.sm }]}>and {toMake.length - 8} more…</Text>}
      </Card>

      <Card>
        <Text style={font.h2}>{STAGE_LABEL.ready} · {ready.length}</Text>
        {ready.length === 0 ? (
          <Text style={[font.dim, { marginTop: space.sm }]}>Nothing made and waiting.</Text>
        ) : (
          ready.slice(0, 8).map((o) => <OrderRow key={o.id} o={o} />)
        )}
      </Card>

      {payback.startupTotal > 0 && (
        <Card>
          <Row>
            <Text style={font.h2}>Getting even</Text>
            <Text style={[font.money, { color: payback.remaining === 0 ? colors.good : colors.text }]}>
              {payback.remaining === 0 ? "Paid off!" : `${fmtMoney(payback.remaining, { cents: false })} to go`}
            </Text>
          </Row>
          <View style={s.track}>
            <View style={[s.fill, { width: `${payback.startupTotal ? (payback.recovered / payback.startupTotal) * 100 : 0}%` }]} />
          </View>
          <Text style={font.small}>
            {fmtMoney(payback.recovered, { cents: false })} of {fmtMoney(payback.startupTotal, { cents: false })} startup earned back
            {" "}({fmtPct(payback.recovered, payback.startupTotal)}). Counts money received, not orders billed.
          </Text>
          <Text style={[font.small, { marginTop: 4 }]}>
            Received {fmtMoney(payback.cashReceived, { cents: false })} · running costs {fmtMoney(payback.operatingExpenses, { cents: false })}
            {owedTotal > 0 ? ` · ${fmtMoney(owedTotal, { cents: false })} still owed on orders` : ""}
          </Text>
        </Card>
      )}

      {lowBlanks.length > 0 && (
        <Card>
          <Row>
            <Text style={font.h2}>Running low</Text>
            <Pressable onPress={() => nav.navigate("OrdersTab", { screen: "Blanks", initial: false })}>
              <Text style={{ color: colors.accent, fontWeight: "600" }}>Blanks</Text>
            </Pressable>
          </Row>
          {lowBlanks.map(({ b, st }) => (
            <Row key={b.id} style={{ paddingVertical: 4 }}>
              <Text style={font.body}>{b.type}{b.style ? ` · ${b.style}` : ""}</Text>
              <Text style={[font.money, { color: st.remaining <= 0 ? colors.bad : colors.warn }]}>{st.remaining} left</Text>
            </Row>
          ))}
        </Card>
      )}

      {owed.length > 0 && (
        <Card>
          <Row>
            <Text style={font.h2}>Owed to you</Text>
            <Text style={[font.money, { color: colors.warn }]}>{fmtMoney(owedTotal)}</Text>
          </Row>
          {owed.slice(0, 6).map(({ o, t }) => (
            <Pressable key={o.id} onPress={() => openOrder(o.id)} style={s.line}>
              <Text style={[font.body, { flex: 1 }]}>{o.customerName || "No name"}</Text>
              <Text style={font.small}>{STAGE_LABEL[STAGE_OF[o.status] ?? "to_make"]}</Text>
              <Text style={[font.money, { marginLeft: space.md }]}>{fmtMoney(t.balance)}</Text>
            </Pressable>
          ))}
          {owed.length > 6 && <Text style={[font.small, { marginTop: space.sm }]}>and {owed.length - 6} more…</Text>}
        </Card>
      )}

      <Text style={[font.small, { textAlign: "center", marginTop: space.sm }]}>
        {finished.length} finished order{finished.length === 1 ? "" : "s"} all time
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, marginVertical: space.sm, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.good },
  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 6,
  },
});
