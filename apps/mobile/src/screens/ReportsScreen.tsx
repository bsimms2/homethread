import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  fmtMoney,
  fmtPct,
  monthPeriod,
  monthlySeries,
  orderTotals,
  periodLabel,
  profitAndLoss,
  yearPeriod,
  inPeriod,
  REVENUE_STATUSES,
} from "@embroidery/ledger";
import { Card, Divider, Row, Segmented } from "../components/ui";
import { categoryName, useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

export function ReportsScreen() {
  const L = useLedger();
  const now = new Date();
  const [mode, setMode] = React.useState<"month" | "year">("month");
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1);

  const period = mode === "month" ? monthPeriod(year, month) : yearPeriod(year);
  const p = profitAndLoss(period, L.orders, L.lines, L.payments, L.expenses);
  const series = monthlySeries(year, L.orders, L.lines, L.payments, L.expenses);
  const maxBar = Math.max(1, ...series.map((m) => Math.max(m.revenue, m.expenses)));

  const orders = L.orders
    .filter((o) => REVENUE_STATUSES.has(o.status) && inPeriod(o.orderedOn, period))
    .map((o) => ({ o, t: orderTotals(o, L.lines, L.payments) }))
    .sort((a, b) => b.t.margin - a.t.margin);

  function step(d: number) {
    if (mode === "year") return setYear(year + d);
    let m = month + d;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  const Line = ({ label, cents, bold, tone }: { label: string; cents: number; bold?: boolean; tone?: "auto" }) => (
    <Row style={{ paddingVertical: 4 }}>
      <Text style={bold ? font.h2 : font.body}>{label}</Text>
      <Text style={[font.money, bold && { fontSize: 18 }, tone === "auto" && { color: cents < 0 ? colors.bad : colors.good }]}>
        {fmtMoney(cents)}
      </Text>
    </Row>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Row style={{ marginBottom: space.md }}>
        <Pressable onPress={() => step(-1)} style={s.arrow}><Text style={font.h2}>‹</Text></Pressable>
        <Text style={font.title}>{periodLabel(period)}</Text>
        <Pressable onPress={() => step(1)} style={s.arrow}><Text style={font.h2}>›</Text></Pressable>
      </Row>
      <Segmented value={mode} options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} onChange={setMode} />

      <Card style={{ marginTop: space.md }}>
        <Line label={`Revenue (${p.orderCount} order${p.orderCount === 1 ? "" : "s"})`} cents={p.revenue} />
        <Line label="Cost of items" cents={-p.cogs} />
        <Line label="Gross margin" cents={p.grossMargin} bold />
        <Text style={[font.small, { textAlign: "right" }]}>{fmtPct(p.grossMargin, p.revenue)} of revenue</Text>
        <Divider />
        <Line label="Running expenses" cents={-p.expenses} />
        <Line label="Net income" cents={p.netIncome} bold tone="auto" />
        {p.startupExpenses > 0 && <Line label="Startup purchases (not in net)" cents={-p.startupExpenses} />}
        <Text style={[font.small, { marginTop: 4 }]}>Net = revenue minus running expenses. Startup purchases are tracked as payback on Home. Item cost is her estimate for per-order margin and isn't subtracted twice.</Text>
        <Divider />
        <Line label="Cash actually received" cents={p.cashReceived} />
        <Line label="Still owed on these orders" cents={p.outstanding} />
      </Card>

      {p.byCategory.length > 0 && (
        <Card>
          <Text style={[font.h2, { marginBottom: space.sm }]}>Expenses by category</Text>
          {p.byCategory.map((c) => (
            <Row key={c.categoryId ?? "none"} style={{ paddingVertical: 4 }}>
              <Text style={font.body}>{categoryName(L.categories, c.categoryId)}</Text>
              <Text style={font.money}>{fmtMoney(c.amount)}</Text>
            </Row>
          ))}
        </Card>
      )}

      <Card>
        <Text style={[font.h2, { marginBottom: space.sm }]}>{year} by month</Text>
        {series.map((m) => (
          <Pressable key={m.month} onPress={() => { setMode("month"); setMonth(m.month); }} style={{ paddingVertical: 4 }}>
            <Row>
              <Text style={[font.small, { width: 34 }]}>{m.label}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={[s.bar, { width: `${(m.revenue / maxBar) * 100}%`, backgroundColor: colors.good }]} />
                <View style={[s.bar, { width: `${(m.expenses / maxBar) * 100}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[font.small, { width: 70, textAlign: "right", color: m.net < 0 ? colors.bad : colors.textDim }]}>
                {fmtMoney(m.net, { cents: false })}
              </Text>
            </Row>
          </Pressable>
        ))}
        <Row style={{ marginTop: space.sm, justifyContent: "flex-start", gap: space.md }}>
          <Text style={font.small}><Text style={{ color: colors.good }}>■</Text> revenue</Text>
          <Text style={font.small}><Text style={{ color: colors.accent }}>■</Text> expenses</Text>
        </Row>
      </Card>

      {orders.length > 0 && (
        <Card>
          <Text style={[font.h2, { marginBottom: space.sm }]}>Margin by order</Text>
          {orders.map(({ o, t }) => (
            <Row key={o.id} style={{ paddingVertical: 4 }}>
              <Text style={[font.body, { flex: 1 }]} numberOfLines={1}>{o.customerName || "No name"}</Text>
              <Text style={[font.small, { width: 70, textAlign: "right" }]}>{fmtMoney(t.revenue, { cents: false })}</Text>
              <Text style={[font.money, { width: 80, textAlign: "right", color: t.margin < 0 ? colors.bad : colors.good }]}>
                {fmtMoney(t.margin, { cents: false })}
              </Text>
              <Text style={[font.small, { width: 52, textAlign: "right" }]}>{fmtPct(t.margin, t.revenue)}</Text>
            </Row>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  arrow: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  bar: { height: 6, borderRadius: 3, minWidth: 2 },
});
