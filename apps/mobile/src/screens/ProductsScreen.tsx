import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "../components/dialog";
import { fmtMoney, type Product } from "@embroidery/ledger";
import { Button, Card, Empty, Field, Input, MoneyInput, Row } from "../components/ui";
import { allProducts, deleteProduct, saveProduct } from "../db/repo";
import { subscribe } from "../db/store";
import { colors, font, space } from "../theme";

/** Her price list. Picking one on an order fills the line's description, qty and price. */
export function ProductsScreen() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => subscribe(bump), []);
  const products = allProducts();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [name, setName] = React.useState("");
  const [option, setOption] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [price, setPrice] = React.useState(0);
  const [notes, setNotes] = React.useState("");

  function startNew() {
    setEditing(null); setName(""); setOption(""); setQty("1"); setPrice(0); setNotes(""); setOpen(true);
  }
  function startEdit(p: Product) {
    setEditing(p); setName(p.name); setOption(p.option); setQty(String(p.qty)); setPrice(p.price); setNotes(p.notes); setOpen(true);
  }
  function save() {
    if (!name.trim()) return Alert.alert("Product", "Give it a name, like Wreath sash.");
    saveProduct({ ...(editing ? { id: editing.id } : {}), name, option, qty: parseInt(qty, 10) || 1, price, notes });
    setOpen(false);
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}
      ListHeaderComponent={
        open ? (
          <Card>
            <Text style={[font.h2, { marginBottom: space.sm }]}>{editing ? "Edit product" : "New product"}</Text>
            <Field label="Product"><Input value={name} onChangeText={setName} placeholder="Wreath sash" autoCapitalize="words" /></Field>
            <Field label="Option"><Input value={option} onChangeText={setOption} placeholder="Two sides embroidered" /></Field>
            <Row style={{ gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Pieces" hint="A 2-towel set is 2."><Input value={qty} onChangeText={setQty} keyboardType="number-pad" /></Field>
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Price for the option"><MoneyInput cents={price} onChange={setPrice} /></Field>
              </View>
            </Row>
            <Field label="Notes"><Input value={notes} onChangeText={setNotes} placeholder="Premium blank, second side +$7…" /></Field>
            <Row style={{ gap: space.sm }}>
              <Button title="Cancel" kind="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} style={{ flex: 2 }} />
            </Row>
          </Card>
        ) : (
          <View style={{ marginBottom: space.md }}>
            <Button title="＋ New product" onPress={startNew} />
            {products.length > 0 && <Text style={[font.small, { marginTop: space.sm }]}>Tap to edit · press and hold to delete</Text>}
          </View>
        )
      }
      ListEmptyComponent={open ? null : <Empty title="No price list yet" hint="Add what she sells and what she charges. Orders pick from this." />}
      renderItem={({ item: p }) => (
        <Pressable
          onPress={() => startEdit(p)}
          onLongPress={() =>
            Alert.alert(`Delete ${p.name}${p.option ? ` · ${p.option}` : ""}?`, undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deleteProduct(p.id) },
            ])
          }
          style={s.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={font.body}>{p.name}</Text>
            <Text style={font.small}>{p.option || "standard"}{p.qty > 1 ? ` · ${p.qty} pieces` : ""}{p.notes ? ` · ${p.notes}` : ""}</Text>
          </View>
          <Text style={font.money}>{fmtMoney(p.price)}</Text>
        </Pressable>
      )}
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
