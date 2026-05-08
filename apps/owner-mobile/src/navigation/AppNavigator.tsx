import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAppSession } from "@/hooks/useAppSession";
import type { OwnerSession } from "@/services/authService";
import CustomerDetailScreen from "@/screens/CustomerDetailScreen";
import CustomerListScreen from "@/screens/CustomerListScreen";
import LoginScreen from "@/screens/LoginScreen";
import ReservationDetailScreen from "@/screens/ReservationDetailScreen";
import ReservationListScreen from "@/screens/ReservationListScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import TodayHomeScreen from "@/screens/TodayHomeScreen";
import {
  type AuthStackParamList,
  type CustomerStackParamList,
  type MainTabsParamList,
  type ReservationStackParamList,
  TAB_LABELS,
} from "@/navigation/routes";
import { createMockOwnerDataProvider } from "@/services/mockOwnerDataProvider";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabsParamList>();
const ReservationStack = createNativeStackNavigator<ReservationStackParamList>();
const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();

type TodayRouteProps = BottomTabScreenProps<MainTabsParamList, "Today">;
type ReservationListRouteProps = NativeStackScreenProps<ReservationStackParamList, "ReservationList">;
type ReservationDetailRouteProps = NativeStackScreenProps<ReservationStackParamList, "ReservationDetail">;
type CustomerListRouteProps = NativeStackScreenProps<CustomerStackParamList, "CustomerList">;
type CustomerDetailRouteProps = NativeStackScreenProps<CustomerStackParamList, "CustomerDetail">;

type AuthStackNavigatorProps = {
  onSignedIn: () => void;
};

type MainTabsNavigatorProps = {
  onSignOut: () => void;
};

const MOCK_OWNER_SESSION: OwnerSession = {
  ownerId: "mock-owner",
  shopId: "mock-shop",
};
const ownerDataProvider = createMockOwnerDataProvider();

export function AppNavigator() {
  const { session: loadedSession, loading } = useAppSession();
  const [session, setSession] = useState<OwnerSession | null>(null);

  useEffect(() => {
    if (!loading) setSession(loadedSession);
  }, [loadedSession, loading]);

  const signInWithMockSession = () => setSession(MOCK_OWNER_SESSION);
  const signOutPlaceholder = () => setSession(null);

  if (loading) {
    return (
      <View style={styles.shell}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>앱을 준비하고 있습니다</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <NavigationContainer>
        {session ? <MainTabsNavigator onSignOut={signOutPlaceholder} /> : <AuthStackNavigator onSignedIn={signInWithMockSession} />}
      </NavigationContainer>
    </View>
  );
}

function AuthStackNavigator({ onSignedIn }: AuthStackNavigatorProps) {
  return (
    <AuthStack.Navigator screenOptions={stackScreenOptions}>
      <AuthStack.Screen name="Login">{() => <LoginScreen onSignedIn={onSignedIn} />}</AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function MainTabsNavigator({ onSignOut }: MainTabsNavigatorProps) {
  return (
    <MainTabs.Navigator screenOptions={tabScreenOptions}>
      <MainTabs.Screen name="Today" component={TodayRoute} options={{ title: TAB_LABELS.Today }} />
      <MainTabs.Screen name="Reservations" component={ReservationStackNavigator} options={{ title: TAB_LABELS.Reservations }} />
      <MainTabs.Screen name="Customers" component={CustomerStackNavigator} options={{ title: TAB_LABELS.Customers }} />
      <MainTabs.Screen name="Settings" options={{ title: TAB_LABELS.Settings }}>
        {() => <SettingsRoute onSignOut={onSignOut} />}
      </MainTabs.Screen>
    </MainTabs.Navigator>
  );
}

function ReservationStackNavigator() {
  return (
    <ReservationStack.Navigator screenOptions={stackScreenOptions}>
      <ReservationStack.Screen name="ReservationList" component={ReservationListRoute} />
      <ReservationStack.Screen name="ReservationDetail" component={ReservationDetailRoute} />
    </ReservationStack.Navigator>
  );
}

function CustomerStackNavigator() {
  return (
    <CustomerStack.Navigator screenOptions={stackScreenOptions}>
      <CustomerStack.Screen name="CustomerList" component={CustomerListRoute} />
      <CustomerStack.Screen name="CustomerDetail" component={CustomerDetailRoute} />
    </CustomerStack.Navigator>
  );
}

function TodayRoute({ navigation }: TodayRouteProps) {
  return (
    <TodayHomeScreen
      viewModel={ownerDataProvider.getTodayHome()}
      onOpenReservations={() => navigation.navigate("Reservations", { screen: "ReservationList" })}
    />
  );
}

function ReservationListRoute({ navigation }: ReservationListRouteProps) {
  return (
    <ReservationListScreen
      rows={ownerDataProvider.getAppointmentRows()}
      onOpenReservation={(reservationId) => navigation.navigate("ReservationDetail", { reservationId })}
    />
  );
}

function ReservationDetailRoute({ navigation, route }: ReservationDetailRouteProps) {
  const reservation = ownerDataProvider.getAppointmentDetail(route.params.reservationId);

  return <ReservationDetailScreen reservation={reservation} onBack={() => navigation.goBack()} />;
}

function CustomerListRoute({ navigation }: CustomerListRouteProps) {
  return (
    <CustomerListScreen
      customers={ownerDataProvider.getCustomerSummaries()}
      onOpenCustomer={(customerId) => navigation.navigate("CustomerDetail", { customerId })}
    />
  );
}

function CustomerDetailRoute({ navigation, route }: CustomerDetailRouteProps) {
  const customer = ownerDataProvider.getCustomerDetail(route.params.customerId);

  return <CustomerDetailScreen customer={customer} onBack={() => navigation.goBack()} />;
}

function SettingsRoute({ onSignOut }: { onSignOut: () => void }) {
  return <SettingsScreen viewModel={ownerDataProvider.getSettingsSummary()} onSignOut={onSignOut} />;
}

const stackScreenOptions = {
  headerShown: false,
};

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: "#1f6b5b",
  tabBarInactiveTintColor: "#746b62",
  tabBarLabelStyle: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  tabBarStyle: {
    borderTopColor: "#ded6ca",
    backgroundColor: "#fffaf3",
  },
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#fbfaf7",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#686059",
    fontSize: 15,
    fontWeight: "700",
  },
});
