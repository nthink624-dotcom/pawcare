import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useAppSession } from "@/hooks/useAppSession";
import { useOwnerDataProvider } from "@/hooks/useOwnerDataProvider";
import { useSettingsSummaryPreview } from "@/hooks/useSettingsSummaryPreview";
import {
  type AuthStackParamList,
  type CustomerStackParamList,
  type MainTabsParamList,
  type ReservationStackParamList,
  TAB_LABELS,
} from "@/navigation/routes";
import CustomerDetailScreen from "@/screens/CustomerDetailScreen";
import CustomerListScreen from "@/screens/CustomerListScreen";
import LoginScreen from "@/screens/LoginScreen";
import ReservationDetailScreen from "@/screens/ReservationDetailScreen";
import ReservationListScreen from "@/screens/ReservationListScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import TodayHomeScreen from "@/screens/TodayHomeScreen";
import { signInWithMockOwnerSession, signOutCurrentOwnerSession, type OwnerSession } from "@/services/authService";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { createInjectedSettingsSummaryPreviewSelectProvider } from "@/services/settingsSummaryPreviewInjection";

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
  ownerDataProvider: OwnerDataProvider;
  onSignOut: () => void;
};

type DataRouteProps = {
  ownerDataProvider: OwnerDataProvider;
};

export function AppNavigator() {
  const { session: loadedSession, loading: sessionLoading } = useAppSession();
  const { state: ownerDataState, provider: ownerDataProvider, loading: ownerDataLoading, retry } = useOwnerDataProvider();
  const [session, setSession] = useState<OwnerSession | null>(null);

  useEffect(() => {
    if (!sessionLoading) setSession(loadedSession);
  }, [loadedSession, sessionLoading]);

  const signInWithMockSession = () => {
    void signInWithMockOwnerSession().then(setSession);
  };
  const signOutPlaceholder = () => {
    void signOutCurrentOwnerSession().then(() => setSession(null));
  };

  if (sessionLoading || ownerDataLoading || ownerDataState.status === "idle") {
    return (
      <View style={styles.shell}>
        <View style={styles.loading}>
          <LoadingState />
        </View>
      </View>
    );
  }

  if (ownerDataState.status === "error") {
    return (
      <View style={styles.shell}>
        <View style={styles.loading}>
          <ErrorState onRetry={retry} />
        </View>
      </View>
    );
  }

  if (!ownerDataProvider) {
    return (
      <View style={styles.shell}>
        <View style={styles.loading}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <NavigationContainer>
        {session ? (
          <MainTabsNavigator ownerDataProvider={ownerDataProvider} onSignOut={signOutPlaceholder} />
        ) : (
          <AuthStackNavigator onSignedIn={signInWithMockSession} />
        )}
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

function MainTabsNavigator({ ownerDataProvider, onSignOut }: MainTabsNavigatorProps) {
  return (
    <MainTabs.Navigator screenOptions={tabScreenOptions}>
      <MainTabs.Screen name="Today" options={{ title: TAB_LABELS.Today }}>
        {(props) => <TodayRoute {...props} ownerDataProvider={ownerDataProvider} />}
      </MainTabs.Screen>
      <MainTabs.Screen name="Reservations" options={{ title: TAB_LABELS.Reservations }}>
        {() => <ReservationStackNavigator ownerDataProvider={ownerDataProvider} />}
      </MainTabs.Screen>
      <MainTabs.Screen name="Customers" options={{ title: TAB_LABELS.Customers }}>
        {() => <CustomerStackNavigator ownerDataProvider={ownerDataProvider} />}
      </MainTabs.Screen>
      <MainTabs.Screen name="Settings" options={{ title: TAB_LABELS.Settings }}>
        {() => <SettingsRoute ownerDataProvider={ownerDataProvider} onSignOut={onSignOut} />}
      </MainTabs.Screen>
    </MainTabs.Navigator>
  );
}

function ReservationStackNavigator({ ownerDataProvider }: DataRouteProps) {
  return (
    <ReservationStack.Navigator screenOptions={stackScreenOptions}>
      <ReservationStack.Screen name="ReservationList">
        {(props) => <ReservationListRoute {...props} ownerDataProvider={ownerDataProvider} />}
      </ReservationStack.Screen>
      <ReservationStack.Screen name="ReservationDetail">
        {(props) => <ReservationDetailRoute {...props} ownerDataProvider={ownerDataProvider} />}
      </ReservationStack.Screen>
    </ReservationStack.Navigator>
  );
}

function CustomerStackNavigator({ ownerDataProvider }: DataRouteProps) {
  return (
    <CustomerStack.Navigator screenOptions={stackScreenOptions}>
      <CustomerStack.Screen name="CustomerList">
        {(props) => <CustomerListRoute {...props} ownerDataProvider={ownerDataProvider} />}
      </CustomerStack.Screen>
      <CustomerStack.Screen name="CustomerDetail">
        {(props) => <CustomerDetailRoute {...props} ownerDataProvider={ownerDataProvider} />}
      </CustomerStack.Screen>
    </CustomerStack.Navigator>
  );
}

function TodayRoute({ navigation, ownerDataProvider }: TodayRouteProps & DataRouteProps) {
  return (
    <TodayHomeScreen
      viewModel={ownerDataProvider.getTodayHome()}
      onOpenReservations={() => navigation.navigate("Reservations", { screen: "ReservationList" })}
    />
  );
}

function ReservationListRoute({ navigation, ownerDataProvider }: ReservationListRouteProps & DataRouteProps) {
  return (
    <ReservationListScreen
      rows={ownerDataProvider.getAppointmentRows()}
      onOpenReservation={(reservationId) => navigation.navigate("ReservationDetail", { reservationId })}
    />
  );
}

function ReservationDetailRoute({ navigation, route, ownerDataProvider }: ReservationDetailRouteProps & DataRouteProps) {
  const reservation = ownerDataProvider.getAppointmentDetail(route.params.reservationId);

  return <ReservationDetailScreen reservation={reservation} onBack={() => navigation.goBack()} />;
}

function CustomerListRoute({ navigation, ownerDataProvider }: CustomerListRouteProps & DataRouteProps) {
  return (
    <CustomerListScreen
      customers={ownerDataProvider.getCustomerSummaries()}
      onOpenCustomer={(customerId) => navigation.navigate("CustomerDetail", { customerId })}
    />
  );
}

function CustomerDetailRoute({ navigation, route, ownerDataProvider }: CustomerDetailRouteProps & DataRouteProps) {
  const customer = ownerDataProvider.getCustomerDetail(route.params.customerId);

  return <CustomerDetailScreen customer={customer} onBack={() => navigation.goBack()} />;
}

function SettingsRoute({ ownerDataProvider, onSignOut }: DataRouteProps & { onSignOut: () => void }) {
  const mockSettingsSummary = useMemo(() => ownerDataProvider.getSettingsSummary(), [ownerDataProvider]);
  const settingsSummaryPreviewSelectProvider = useMemo(
    () => createInjectedSettingsSummaryPreviewSelectProvider(mockSettingsSummary),
    [mockSettingsSummary],
  );
  const settingsSummaryPreview = useSettingsSummaryPreview({
    mockSummary: mockSettingsSummary,
    selectProvider: settingsSummaryPreviewSelectProvider,
  });

  if (settingsSummaryPreview.loading) {
    return (
      <View style={styles.routeState}>
        <LoadingState />
      </View>
    );
  }

  if (settingsSummaryPreview.status === "error") {
    return (
      <View style={styles.routeState}>
        <ErrorState onRetry={settingsSummaryPreview.retry} />
      </View>
    );
  }

  return <SettingsScreen viewModel={settingsSummaryPreview.viewModel} onSignOut={onSignOut} />;
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
  routeState: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#fbfaf7",
    padding: 24,
  },
});
