import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { fmtMoney, orderTotals } from "@embroidery/ledger";
import { Button, Card, Empty, Field, Input } from "../components/ui";
import { deleteCustomer, saveCustomer } from "../db/repo";
import { useLedger } from "../state/useLedger";
import { colors, font, space } from "../theme";

export function CustomersScreen() {
  const L = useLedger();
  const [name, setName] = React.useState("");
  const [contact, setContact] = React.useState("");

  function add() {
    if (!name.trim()) return;
    saveCustomer({ name: name.trim(), contact: contact.trim(), notes: "" });
    setName("");
    setContact("");
    L.reload();
  }

  const stats = (id: string) => {
    const mine = L.orders.filter((o) => o.customerId === id && o.status !== "quote" && o.status !== "cancelled");
    const spent = mine.reduce((s, o) => s + orderTotals(o, L.lines, L.payments).revenue, 0);
    return { count: mine.length, spent };
  };

  return (
    <FlatList
      data={L.customers}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: space.lg }}
      ListHeaderComponent={
        <Card>
          <Field label="New customer">
            <Input value={name} onChangeText={setName} placeholder="Name" autoCapitalize="words" />
          </Field>
          <Field label="How she reaches them">
            <Input value={contact} onChangeText={setContact} placeholder="Text 252-555-0100, Facebook: Jane D." />
          </Field>
          <Button title="Add" onPress={add} disabled={!name.trim()} />
        </Card>
      }
      ListEmptyComponent={<Empty title="No customers yet" hint="They're added automatically when you save an order." />}
      renderItem={({ item: c }) => {
        const st = stats(c.id);
        return (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.body}>{c.name}</Text>
              <Text style={font.small}>
                {c.contact ? `${c.contact} · ` : ""}
                {st.count} order{st.count === 1 ? "" : "s"} · {fmtMoney(st.spent, { cents: false })}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert("Remove customer?", "Their orders stay; they just lose the link.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => { deleteCustomer(c.id); L.reload(); } },
                ])
              }
            >
              <Text style={{ color: colors.bad }}>✕</Text>
            </Pressable>
          </View>
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
