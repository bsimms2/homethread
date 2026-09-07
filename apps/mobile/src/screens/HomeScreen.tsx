import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  STATUS_LABEL,
  fmtMoney,
  monthPeriod,
  orderTotals,
  periodLabel,
  profitAndLoss,
  shortDate,
  today,
} from "@embroidery/ledger";
import type { TabParamList } from "../nav";
import { Button, Card, Row, Stat } from "../components/ui";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

export function HomeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const L = useLedger();
  const now = new Date();
  const period = monthPeriod(now.getFullYear(), now.getMonth() + 1);
  const pnl = profitAndLoss(period, L.orders, L.lines, L.payments, L.expenses);

  const open = L.orders
    .filter((o) => o.status === "confirmed" || o.status === "in_progress" || o.status === "done")
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"))
    .slice(0, 6);
  const owed = L.orders
    .map((o) => ({ o, t: orderTotals(o, L.lines, L.payments) }))
    .filter((x) => x.o.status !== "quote" && x.o.status !== "cancelled" && x.t.balance > 0);
  const owedTotal = owed.reduce((s, x) => s + x.t.balance, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <Text style={[font.small, { marginBottom: space.sm }]}>{periodLabel(period).toUpperCase()}</Text>
      <Row style={{ gap: space.sm, marginBottom: space.md }}>
        <Stat label="Revenue" cents={pnl.revenue} />
        <Stat label="Expenses" cents={pnl.expenses} />
        <Stat label="Net" cents={pnl.netIncome} tone="auto" />
      </Row>

      <Row style={{ gap: space.sm, marginBottom: space.lg }}>
        <Button
          title="📷  Snap a receipt"
          onPress={() =>
            nav.navigate("ExpensesTab", { screen: "ExpenseEdit", params: { capture: "camera" }, initial: false })
          }
          style={{ flex: 1 }}
        />
        <Button
          title="＋ Order"
          kind="secondary"
          onPress={() => nav.navigate("OrdersTab", { screen: "OrderEdit", params: {}, initial: false })}
          style={{ flex: 1 }}
        />
      </Row>

      <Card>
        <Row>
          <Text style={font.h2}>In the queue</Text>
          <Pressable onPress={() => nav.navigate("OrdersTab", { screen: "OrdersList" })}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>All orders</Text>
          </Pressable>
        </Row>
        {open.length === 0 ? (
          <Text style={[font.dim, { marginTop: space.sm }]}>Nothing open. Enjoy it.</Text>
        ) : (
          open.map((o) => {
            const late = o.dueOn !== null && o.dueOn < today() && o.status !== "done";
            return (
              <Pressable
                key={o.id}
                onPress={() => nav.navigate("OrdersTab", { screen: "OrderDetail", params: { orderId: o.id } })}
                style={s.line}
              >
                <View style={{ flex: 1 }}>
                  <Text style={font.body}>{o.customerName || "No name"}</Text>
                  <Text style={font.small}>
                    {STATUS_LABEL[o.status]}
                    {o.dueOn ? ` · due ${shortDate(o.dueOn)}` : ""}
                  </Text>
                </View>
                <Text style={[font.money, late && { color: colors.bad }]}>
                  {fmtMoney(orderTotals(o, L.lines, L.payments).revenue, { cents: false })}
                </Text>
              </Pressable>
            );
          })
        )}
      </Card>

      {owed.length > 0 && (
        <Card>
          <Row>
            <Text style={font.h2}>Owed to you</Text>
            <Text style={[font.money, { color: colors.warn }]}>{fmtMoney(owedTotal)}</Text>
          </Row>
          {owed.slice(0, 5).map(({ o, t }) => (
            <Pressable
              key={o.id}
              onPress={() => nav.navigate("OrdersTab", { screen: "OrderDetail", params: { orderId: o.id } })}
              style={s.line}
            >
              <Text style={[font.body, { flex: 1 }]}>{o.customerName || "No name"}</Text>
              <Text style={font.money}>{fmtMoney(t.balance)}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 6,
  },
});
