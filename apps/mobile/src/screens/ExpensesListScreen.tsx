import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fmtMoney, shortDate } from "@embroidery/ledger";
import type { ExpensesStackParamList } from "../nav";
import { Button, Empty } from "../components/ui";
import { deleteExpense } from "../db/repo";
import { categoryName, useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

export function ExpensesListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ExpensesStackParamList>>();
  const L = useLedger();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, flexDirection: "row", gap: space.sm }}>
        <Button title="📷  Snap receipt" onPress={() => nav.navigate("ExpenseEdit", { capture: "camera" })} style={{ flex: 2 }} />
        <Button title="Photos" kind="secondary" onPress={() => nav.navigate("ExpenseEdit", { capture: "library" })} style={{ flex: 1 }} />
        <Button title="Type" kind="secondary" onPress={() => nav.navigate("ExpenseEdit", {})} style={{ flex: 1 }} />
      </View>
      <FlatList
        data={L.expenses}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        ListEmptyComponent={<Empty title="No expenses yet" hint="Snap a receipt and the details fill themselves in." />}
        ListHeaderComponent={
          L.expenses.length > 0 ? <Text style={[font.small, { marginBottom: space.sm }]}>Tap to edit · press and hold to delete</Text> : null
        }
        renderItem={({ item: e }) => (
          <Pressable
            onPress={() => nav.navigate("ExpenseEdit", { expenseId: e.id })}
            onLongPress={() =>
              Alert.alert(`Delete ${e.vendor || "this expense"} ${fmtMoney(e.amount)}?`, undefined, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => { deleteExpense(e.id); L.reload(); } },
              ])
            }
            style={s.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={font.body}>{e.vendor || "Unknown vendor"}</Text>
              <Text style={font.small}>
                {shortDate(e.spentOn)} · {categoryName(L.categories, e.categoryId)}
                {e.receiptImagePath ? " · 📷" : ""}
              </Text>
            </View>
            <Text style={font.money}>{fmtMoney(e.amount)}</Text>
          </Pressable>
        )}
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
