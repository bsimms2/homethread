import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { STATUS_LABEL, fmtMoney, orderTotals, shortDate, type OrderStatus } from "@embroidery/ledger";
import type { OrdersStackParamList } from "../nav";
import { Button, Empty, Segmented } from "../components/ui";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

type Filter = "open" | "quote" | "delivered" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "quote", label: "Quotes" },
  { value: "delivered", label: "Delivered" },
  { value: "all", label: "All" },
];
const OPEN: OrderStatus[] = ["confirmed", "in_progress", "done"];

export function OrdersListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<OrdersStackParamList>>();
  const L = useLedger();
  const [filter, setFilter] = React.useState<Filter>("open");

  const rows = L.orders.filter((o) =>
    filter === "all"
      ? true
      : filter === "open"
        ? OPEN.includes(o.status)
        : filter === "quote"
          ? o.status === "quote"
          : o.status === "delivered",
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
        <Button title="＋ New order" onPress={() => nav.navigate("OrderEdit", {})} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title="Customers" kind="secondary" onPress={() => nav.navigate("Customers")} style={{ flex: 1 }} />
          <Button title="Price list" kind="secondary" onPress={() => nav.navigate("Products")} style={{ flex: 1 }} />
          <Button title="Blanks" kind="secondary" onPress={() => nav.navigate("Blanks")} style={{ flex: 1 }} />
          <Button title="Designs" kind="secondary" onPress={() => nav.navigate("Designs")} style={{ flex: 1 }} />
        </View>
        <Segmented value={filter} options={FILTERS} onChange={setFilter} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        ListEmptyComponent={<Empty title="No orders here" hint="Tap New order when a text or Facebook message comes in." />}
        renderItem={({ item: o }) => {
          const t = orderTotals(o, L.lines, L.payments);
          const paid = t.balance <= 0 && t.revenue > 0;
          return (
            <Pressable onPress={() => nav.navigate("OrderDetail", { orderId: o.id })} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={font.body}>{o.customerName || "No name"}</Text>
                <Text style={font.small}>
                  {STATUS_LABEL[o.status]} · {shortDate(o.orderedOn)}
                  {o.dueOn ? ` · due ${shortDate(o.dueOn)}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={font.money}>{fmtMoney(t.revenue)}</Text>
                <Text style={[font.small, { color: paid ? colors.good : t.paid > 0 ? colors.warn : colors.textDim }]}>
                  {paid ? "paid" : t.paid > 0 ? `${fmtMoney(t.balance)} due` : "unpaid"}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
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
