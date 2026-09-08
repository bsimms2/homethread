import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { STAGE_OF, STATUS_LABEL, fmtMoney, orderTotals, shortDate, type Stage } from "@embroidery/ledger";
import type { OrdersStackParamList } from "../nav";
import { Button, Empty, Segmented } from "../components/ui";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

type Filter = Stage | "quote" | "all";

export function OrdersListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<OrdersStackParamList>>();
  const L = useLedger();
  const [filter, setFilter] = React.useState<Filter>("to_make");

  const count = (st: Stage) => L.orders.filter((o) => STAGE_OF[o.status] === st).length;
  const FILTERS: { value: Filter; label: string }[] = [
    { value: "to_make", label: `To make (${count("to_make")})` },
    { value: "ready", label: `Not picked up (${count("ready")})` },
    { value: "finished", label: `Finished (${count("finished")})` },
    { value: "quote", label: "Quotes" },
    { value: "all", label: "All" },
  ];

  const rows = L.orders.filter((o) =>
    filter === "all" ? true : filter === "quote" ? o.status === "quote" : STAGE_OF[o.status] === filter,
  );

  const empty =
    filter === "to_make"
      ? { title: "Nothing to make", hint: "New orders land here until she marks them ready." }
      : filter === "ready"
        ? { title: "Nothing waiting for pickup", hint: "Orders she has finished stitching but not handed over." }
        : filter === "finished"
          ? { title: "No finished orders yet", hint: "Delivered orders live here." }
          : { title: "No orders here", hint: "Tap New order when a text or Facebook message comes in." };

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
        ListEmptyComponent={<Empty title={empty.title} hint={empty.hint} />}
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
                <Text style={[font.small, { color: paid ? colors.good : t.paid > 0 ? colors.warn : t.revenue === 0 ? colors.textDim : colors.bad }]}>
                  {paid ? "paid" : t.paid > 0 ? `${fmtMoney(t.balance)} due` : t.revenue === 0 ? "no price yet" : "unpaid"}
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
