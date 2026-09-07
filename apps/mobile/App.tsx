import React from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./src/db/supabase";
import { loadAll, refreshIfStale } from "./src/db/store";
import type { ExpensesStackParamList, OrdersStackParamList, TabParamList } from "./src/nav";
import { Button } from "./src/components/ui";
import { SignInScreen } from "./src/screens/SignInScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OrdersListScreen } from "./src/screens/OrdersListScreen";
import { OrderEditScreen } from "./src/screens/OrderEditScreen";
import { OrderDetailScreen } from "./src/screens/OrderDetailScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { DesignsScreen } from "./src/screens/DesignsScreen";
import { ExpensesListScreen } from "./src/screens/ExpensesListScreen";
import { ExpenseEditScreen } from "./src/screens/ExpenseEditScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { colors, font, space } from "./src/theme";

const Tab = createBottomTabNavigator<TabParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const ExpensesStack = createNativeStackNavigator<ExpensesStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

const stackOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" as const },
  contentStyle: { backgroundColor: colors.bg },
};

function OrdersNav() {
  return (
    <OrdersStack.Navigator screenOptions={stackOptions}>
      <OrdersStack.Screen name="OrdersList" component={OrdersListScreen} options={{ title: "Orders" }} />
      <OrdersStack.Screen name="OrderEdit" component={OrderEditScreen} options={{ title: "Order" }} />
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order" }} />
      <OrdersStack.Screen name="Customers" component={CustomersScreen} options={{ title: "Customers" }} />
      <OrdersStack.Screen name="Designs" component={DesignsScreen} options={{ title: "Designs" }} />
    </OrdersStack.Navigator>
  );
}

function ExpensesNav() {
  return (
    <ExpensesStack.Navigator screenOptions={stackOptions}>
      <ExpensesStack.Screen name="ExpensesList" component={ExpensesListScreen} options={{ title: "Expenses" }} />
      <ExpensesStack.Screen name="ExpenseEdit" component={ExpenseEditScreen} options={{ title: "Expense" }} />
    </ExpensesStack.Navigator>
  );
}

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: string }) {
    return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
  };

function Tabs() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textDim,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Today", tabBarIcon: icon("⌂") }} />
        <Tab.Screen name="OrdersTab" component={OrdersNav} options={{ title: "Orders", headerShown: false, tabBarIcon: icon("✎") }} />
        <Tab.Screen name="ExpensesTab" component={ExpensesNav} options={{ title: "Expenses", headerShown: false, tabBarIcon: icon("▣") }} />
        <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: icon("▤") }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: icon("⚙") }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

type Phase = { kind: "booting" } | { kind: "signed_out" } | { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

export default function App() {
  const [session, setSession] = React.useState<Session | null | undefined>(undefined);
  const [phase, setPhase] = React.useState<Phase>({ kind: "booting" });

  React.useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = React.useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      await loadAll();
      setPhase({ kind: "ready" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
    }
  }, []);

  React.useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setPhase({ kind: "signed_out" });
      return;
    }
    void load();
  }, [session, load]);

  // Pull the other phone's changes when this tab comes back to the front.
  React.useEffect(() => {
    if (Platform.OS !== "web" || phase.kind !== "ready") return;
    const onFocus = () => void refreshIfStale();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [phase.kind]);

  let body: React.ReactNode;
  if (phase.kind === "signed_out") body = <SignInScreen />;
  else if (phase.kind === "ready") body = <Tabs />;
  else if (phase.kind === "error")
    body = (
      <View style={{ flex: 1, justifyContent: "center", padding: space.xl, backgroundColor: colors.bg }}>
        <Text style={font.h2}>Couldn't load the ledger</Text>
        <Text style={[font.body, { marginVertical: space.md }]}>{phase.message}</Text>
        <Text style={[font.dim, { marginBottom: space.md }]}>
          If this says permission denied, the email you signed in with isn't on the allowed list yet.
        </Text>
        <Button title="Try again" onPress={() => void load()} />
        <Button title="Sign out" kind="ghost" onPress={() => void supabase.auth.signOut()} style={{ marginTop: space.sm }} />
      </View>
    );
  else
    body = (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {body}
    </SafeAreaProvider>
  );
}
