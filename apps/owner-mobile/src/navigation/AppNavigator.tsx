import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useAppSession } from "@/hooks/useAppSession";
import { useOwnerDataPreviewProvider } from "@/hooks/useOwnerDataPreviewProvider";
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
import { defaultAuthSessionProvider, type OwnerSession } from "@/services/authService";
import { selectAuthSessionProvider } from "@/services/selectAuthSessionProvider";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { createInjectedSettingsSummaryPreviewSelectProvider } from "@/services/settingsSummaryPreviewInjection";
import { createAuthSessionTokenResolver, type AuthSessionProvider } from "@/services/authSessionProvider";
import type { AuthSignInCredentials } from "@/types/auth";

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
  authMode: "mock" | "real";
  errorMessage?: string | null;
  isSigningIn?: boolean;
  onSignedIn: (credentials?: AuthSignInCredentials) => void;
};

type MainTabsNavigatorProps = {
  ownerDataProvider: OwnerDataProvider;
  authSessionProvider: AuthSessionProvider;
  session: OwnerSession;
  onSignOut: () => void;
};

type DataRouteProps = {
  ownerDataProvider: OwnerDataProvider;
};

type PreviewDataRouteProps = DataRouteProps & {
  previewDataProvider: OwnerDataProvider;
  previewDataSource: "mock" | "real";
};

export function AppNavigator() {
  const authSelection = useMemo(() => selectAuthSessionProvider(), []);
  const authSessionProvider = authSelection.provider ?? defaultAuthSessionProvider;
  const { session: loadedSession, loading: sessionLoading } = useAppSession(authSessionProvider);
  const { state: ownerDataState, provider: ownerDataProvider, loading: ownerDataLoading, retry } = useOwnerDataProvider();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (!sessionLoading) setSession(loadedSession);
  }, [loadedSession, sessionLoading]);

  const signInWithSelectedProvider = useCallback(
    (credentials?: AuthSignInCredentials) => {
      if (authSelection.error) {
        setAuthErrorMessage("로그인 환경을 확인하지 못했습니다. 설정을 확인해 주세요.");
        return;
      }

      setAuthBusy(true);
      setAuthErrorMessage(null);
      void authSessionProvider
        .signIn({
          loginId: credentials?.loginId ?? "mock-owner",
          password: credentials?.password ?? "mock-password",
        })
        .then(setSession)
        .catch(() => {
          setSession(null);
          setAuthErrorMessage("로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.");
        })
        .finally(() => setAuthBusy(false));
    },
    [authSelection.error, authSessionProvider],
  );
  const signOutSelectedProvider = useCallback(() => {
    setAuthErrorMessage(null);
    void authSessionProvider
      .signOut()
      .catch(() => undefined)
      .finally(() => setSession(null));
  }, [authSessionProvider]);

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

  if (authSelection.error) {
    return (
      <View style={styles.shell}>
        <View style={styles.loading}>
          <ErrorState
            title="로그인 설정을 확인하지 못했습니다."
            description="real auth mode를 사용하려면 Supabase 공개 설정이 필요합니다."
          />
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
          <MainTabsNavigator
            ownerDataProvider={ownerDataProvider}
            authSessionProvider={authSessionProvider}
            session={session}
            onSignOut={signOutSelectedProvider}
          />
        ) : (
          <AuthStackNavigator
            authMode={authSelection.mode}
            errorMessage={authErrorMessage}
            isSigningIn={authBusy}
            onSignedIn={signInWithSelectedProvider}
          />
        )}
      </NavigationContainer>
    </View>
  );
}

function AuthStackNavigator({ authMode, errorMessage, isSigningIn, onSignedIn }: AuthStackNavigatorProps) {
  return (
    <AuthStack.Navigator screenOptions={stackScreenOptions}>
      <AuthStack.Screen name="Login">
        {() => (
          <LoginScreen
            authMode={authMode}
            errorMessage={errorMessage}
            isSigningIn={isSigningIn}
            onSignedIn={onSignedIn}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function MainTabsNavigator({ ownerDataProvider, authSessionProvider, session, onSignOut }: MainTabsNavigatorProps) {
  const accessTokenResolver = useCallback(() => session.accessToken, [session.accessToken]);
  const ownerDataPreview = useOwnerDataPreviewProvider({
    mockProvider: ownerDataProvider,
    accessTokenResolver,
    ownerEmail: session.email,
  });

  if (ownerDataPreview.loading) {
    return (
      <View style={styles.routeState}>
        <LoadingState />
      </View>
    );
  }

  if (ownerDataPreview.status === "error") {
    return (
      <View style={styles.routeState}>
        <ErrorState description={formatOwnerDataError(ownerDataPreview.error)} onRetry={ownerDataPreview.retry} />
      </View>
    );
  }

  return (
    <MainTabs.Navigator screenOptions={tabScreenOptions}>
      <MainTabs.Screen name="Today" options={{ title: TAB_LABELS.Today }}>
        {(props) => (
          <TodayRoute
            {...props}
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={ownerDataPreview.provider}
            previewDataSource={ownerDataPreview.source}
          />
        )}
      </MainTabs.Screen>
      <MainTabs.Screen name="Reservations" options={{ title: TAB_LABELS.Reservations }}>
        {() => (
          <ReservationStackNavigator
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={ownerDataPreview.provider}
            previewDataSource={ownerDataPreview.source}
          />
        )}
      </MainTabs.Screen>
      <MainTabs.Screen name="Customers" options={{ title: TAB_LABELS.Customers }}>
        {() => <CustomerStackNavigator ownerDataProvider={ownerDataProvider} />}
      </MainTabs.Screen>
      <MainTabs.Screen name="Settings" options={{ title: TAB_LABELS.Settings }}>
        {() => (
          <SettingsRoute
            ownerDataProvider={ownerDataProvider}
            authSessionProvider={authSessionProvider}
            onSignOut={onSignOut}
          />
        )}
      </MainTabs.Screen>
    </MainTabs.Navigator>
  );
}

function ReservationStackNavigator({ ownerDataProvider, previewDataProvider, previewDataSource }: PreviewDataRouteProps) {
  return (
    <ReservationStack.Navigator screenOptions={stackScreenOptions}>
      <ReservationStack.Screen name="ReservationList">
        {(props) => (
          <ReservationListRoute
            {...props}
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={previewDataProvider}
            previewDataSource={previewDataSource}
          />
        )}
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

function TodayRoute({ navigation, previewDataProvider }: TodayRouteProps & PreviewDataRouteProps) {
  return (
    <TodayHomeScreen
      viewModel={previewDataProvider.getTodayHome()}
      onOpenReservations={() => navigation.navigate("Reservations", { screen: "ReservationList" })}
    />
  );
}

function ReservationListRoute({
  navigation,
  previewDataProvider,
  previewDataSource,
}: ReservationListRouteProps & PreviewDataRouteProps) {
  return (
    <ReservationListScreen
      rows={previewDataProvider.getAppointmentRows()}
      onOpenReservation={(reservationId) => {
        if (previewDataSource === "real") return;

        navigation.navigate("ReservationDetail", { reservationId });
      }}
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

function SettingsRoute({
  ownerDataProvider,
  authSessionProvider,
  onSignOut,
}: DataRouteProps & { authSessionProvider: AuthSessionProvider; onSignOut: () => void }) {
  const mockSettingsSummary = useMemo(() => ownerDataProvider.getSettingsSummary(), [ownerDataProvider]);
  const sessionTokenResolver = useMemo(() => createAuthSessionTokenResolver(authSessionProvider), [authSessionProvider]);
  const settingsSummaryPreviewSelectProvider = useMemo(
    () => createInjectedSettingsSummaryPreviewSelectProvider(mockSettingsSummary),
    [mockSettingsSummary],
  );
  const settingsSummaryPreview = useSettingsSummaryPreview({
    mockSummary: mockSettingsSummary,
    sessionTokenResolver,
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

function formatOwnerDataError(error: Error | null) {
  const message = error?.message ?? "";

  if (/access token|로그인이 필요/i.test(message)) {
    return "로그인 정보가 확인되지 않았습니다. 다시 로그인해 주세요.";
  }

  if (/base URL/i.test(message)) {
    return "API 주소 설정을 확인해 주세요.";
  }

  if (/No owned shops|매장/i.test(message)) {
    return "이 계정에 연결된 매장을 찾지 못했습니다.";
  }

  if (/Invalid bootstrap payload|bootstrap/i.test(message)) {
    return "예약 데이터 형식이 앱과 맞지 않습니다.";
  }

  if (/Production owner API/i.test(message)) {
    return "개발 모드에서 운영 API 연결이 차단되었습니다.";
  }

  return "기존 서버에서 예약 데이터를 불러오지 못했습니다.";
}

const tabScreenOptions = {
  headerShown: false,
  tabBarShowIcon: false,
  tabBarActiveTintColor: "#1f6b5b",
  tabBarInactiveTintColor: "#746b62",
  tabBarItemStyle: {
    height: 58,
    justifyContent: "center" as const,
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarLabelStyle: {
    fontSize: 13,
    fontWeight: "700" as const,
    lineHeight: 18,
    marginTop: 0,
    marginBottom: 0,
  },
  tabBarStyle: {
    height: 58,
    borderTopColor: "#ded6ca",
    backgroundColor: "#fffaf3",
    paddingTop: 0,
    paddingBottom: 0,
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
