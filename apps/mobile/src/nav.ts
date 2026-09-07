import type { NavigatorScreenParams } from "@react-navigation/native";

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderEdit: { orderId?: string };
  OrderDetail: { orderId: string };
  Customers: undefined;
  Designs: undefined;
};

export type ExpensesStackParamList = {
  ExpensesList: undefined;
  ExpenseEdit: { expenseId?: string; capture?: "camera" | "library" };
};

export type TabParamList = {
  Home: undefined;
  OrdersTab: NavigatorScreenParams<OrdersStackParamList>;
  ExpensesTab: NavigatorScreenParams<ExpensesStackParamList>;
  Reports: undefined;
  Settings: undefined;
};
