import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";

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
import { MOCK_AUTH_SESSION } from "@/services/mockAuthSessionProvider";
import { selectAuthSessionProvider } from "@/services/selectAuthSessionProvider";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { createInjectedSettingsSummaryPreviewSelectProvider } from "@/services/settingsSummaryPreviewInjection";
import { createAuthSessionTokenResolver, type AuthSessionProvider } from "@/services/authSessionProvider";
import {
  addOwnerPushListeners,
  deactivateOwnerPushDevice,
  registerOwnerPushDevice,
  type OwnerPushPayload,
} from "@/services/ownerPushNotifications";
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
  onOpenPushPayload: (payload: OwnerPushPayload) => void;
};

type DataRouteProps = {
  ownerDataProvider: OwnerDataProvider;
};

type PreviewDataRouteProps = DataRouteProps & {
  previewDataProvider: OwnerDataProvider;
  previewDataSource: "mock" | "real";
};

export function AppNavigator() {
  const navigationRef = useNavigationContainerRef<MainTabsParamList>();
  const pendingPushPayloadRef = useRef<OwnerPushPayload | null>(null);
  const authSelection = useMemo(() => selectAuthSessionProvider(), []);
  const authSessionProvider = authSelection.provider ?? defaultAuthSessionProvider;
  const { session: loadedSession, loading: sessionLoading } = useAppSession(authSessionProvider);
  const { state: ownerDataState, provider: ownerDataProvider, loading: ownerDataLoading, retry } = useOwnerDataProvider();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    const timer = setTimeout(() => {
      setSession(authSelection.mode === "mock" ? MOCK_AUTH_SESSION : loadedSession);
    }, 0);

    return () => clearTimeout(timer);
  }, [authSelection.mode, loadedSession, sessionLoading]);

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
  const openOwnerPushPayload = useCallback(
    (payload: OwnerPushPayload) => {
      if (!navigationRef.isReady()) {
        pendingPushPayloadRef.current = payload;
        return;
      }

      const reservationId = payload.route?.params?.reservationId ?? payload.appointmentId ?? undefined;
      if (reservationId) {
        navigationRef.navigate("Reservations", {
          screen: "ReservationDetail",
          params: { reservationId },
        });
        return;
      }

      navigationRef.navigate("Reservations", { screen: "ReservationList" });
    },
    [navigationRef],
  );

  useEffect(() => {
    if (!session || !navigationRef.isReady() || !pendingPushPayloadRef.current) return;
    const payload = pendingPushPayloadRef.current;
    pendingPushPayloadRef.current = null;
    openOwnerPushPayload(payload);
  }, [navigationRef, openOwnerPushPayload, session]);

  const signOutSelectedProvider = useCallback(() => {
    setAuthErrorMessage(null);
    void deactivateOwnerPushDevice({ accessToken: session?.accessToken ?? null })
      .catch(() => undefined)
      .then(() => authSessionProvider.signOut())
      .catch(() => undefined)
      .finally(() => setSession(null));
  }, [authSessionProvider, session?.accessToken]);

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
      <NavigationContainer ref={navigationRef} onReady={() => {
        if (!pendingPushPayloadRef.current) return;
        const payload = pendingPushPayloadRef.current;
        pendingPushPayloadRef.current = null;
        openOwnerPushPayload(payload);
      }}>
        {session ? (
          <MainTabsNavigator
            ownerDataProvider={ownerDataProvider}
            authSessionProvider={authSessionProvider}
            session={session}
            onSignOut={signOutSelectedProvider}
            onOpenPushPayload={openOwnerPushPayload}
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

function MainTabsNavigator({ ownerDataProvider, authSessionProvider, session, onSignOut, onOpenPushPayload }: MainTabsNavigatorProps) {
  const accessTokenResolver = useCallback(() => session.accessToken, [session.accessToken]);
  const [pushBanner, setPushBanner] = useState<OwnerPushPayload | null>(null);
  const [pushUnreadCount, setPushUnreadCount] = useState(0);
  const pushBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownerDataPreview = useOwnerDataPreviewProvider({
    mockProvider: ownerDataProvider,
    accessTokenResolver,
    ownerEmail: session.email,
  });
  const bootstrap = ownerDataPreview.provider.getBootstrap();
  const ownerBookingRequestBadgeCount = bootstrap.notifications.filter(
    (notification) =>
      notification.type === "owner_booking_requested" &&
      notification.channel === "in_app" &&
      notification.status === "queued",
  ).length;
  const reservationPushBadge = pushUnreadCount + ownerBookingRequestBadgeCount;

  const openPushPayload = useCallback(
    (payload: OwnerPushPayload) => {
      setPushUnreadCount(0);
      setPushBanner(null);
      onOpenPushPayload(payload);
    },
    [onOpenPushPayload],
  );

  useEffect(() => {
    return () => {
      if (pushBannerTimerRef.current) clearTimeout(pushBannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (ownerDataPreview.source !== "real" || !session.accessToken) return;

    void registerOwnerPushDevice({
      accessToken: session.accessToken,
      shopId: bootstrap.shop.id,
      ownerId: session.ownerId,
    });
  }, [bootstrap.shop.id, ownerDataPreview.source, session.accessToken, session.ownerId]);

  useEffect(() => {
    const cleanup = addOwnerPushListeners({
      onNotificationReceived(payload) {
        setPushUnreadCount((count) => count + 1);
        setPushBanner(payload);

        if (pushBannerTimerRef.current) clearTimeout(pushBannerTimerRef.current);
        pushBannerTimerRef.current = setTimeout(() => {
          setPushBanner(null);
        }, 4500);
      },
      onNotificationResponse(payload) {
        openPushPayload(payload);
      },
    });

    return () => cleanup.remove();
  }, [openPushPayload]);

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
    <View style={styles.tabShell}>
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
        <MainTabs.Screen
          name="Reservations"
          options={{ title: TAB_LABELS.Reservations, tabBarBadge: reservationPushBadge > 0 ? reservationPushBadge : undefined }}
        >
          {() => (
            <ReservationStackNavigator
              ownerDataProvider={ownerDataProvider}
              previewDataProvider={ownerDataPreview.provider}
              previewDataSource={ownerDataPreview.source}
            />
          )}
        </MainTabs.Screen>
        <MainTabs.Screen name="Customers" options={{ title: TAB_LABELS.Customers }}>
          {() => (
            <CustomerStackNavigator
              ownerDataProvider={ownerDataProvider}
              previewDataProvider={ownerDataPreview.provider}
              previewDataSource={ownerDataPreview.source}
            />
          )}
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
      {pushBanner ? <OwnerPushToast payload={pushBanner} onPress={() => openPushPayload(pushBanner)} /> : null}
    </View>
  );
}

function OwnerPushToast({ payload, onPress }: { payload: OwnerPushPayload; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.pushToast} onPress={onPress}>
      <Text style={styles.pushToastTitle}>{payload.title || "새 예약 요청이 들어왔어요"}</Text>
      <Text style={styles.pushToastBody} numberOfLines={2}>
        {payload.body || "예약 현황에서 새 요청을 확인해 주세요."}
      </Text>
    </TouchableOpacity>
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
        {(props) => (
          <ReservationDetailRoute
            {...props}
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={previewDataProvider}
            previewDataSource={previewDataSource}
          />
        )}
      </ReservationStack.Screen>
    </ReservationStack.Navigator>
  );
}

function CustomerStackNavigator({ ownerDataProvider, previewDataProvider, previewDataSource }: PreviewDataRouteProps) {
  return (
    <CustomerStack.Navigator screenOptions={stackScreenOptions}>
      <CustomerStack.Screen name="CustomerList">
        {(props) => (
          <CustomerListRoute
            {...props}
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={previewDataProvider}
            previewDataSource={previewDataSource}
          />
        )}
      </CustomerStack.Screen>
      <CustomerStack.Screen name="CustomerDetail">
        {(props) => (
          <CustomerDetailRoute
            {...props}
            ownerDataProvider={ownerDataProvider}
            previewDataProvider={previewDataProvider}
            previewDataSource={previewDataSource}
          />
        )}
      </CustomerStack.Screen>
    </CustomerStack.Navigator>
  );
}

function TodayRoute({ navigation, previewDataProvider }: TodayRouteProps & PreviewDataRouteProps) {
  const todayDate = getLocalDateKey();

  return (
    <TodayHomeScreen
      viewModel={previewDataProvider.getTodayHome(todayDate)}
      todayDate={todayDate}
      getViewModelForDate={(date) => previewDataProvider.getTodayHome(date)}
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
        navigation.navigate("ReservationDetail", { reservationId });
      }}
    />
  );
}

function ReservationDetailRoute({
  navigation,
  route,
  previewDataProvider,
  previewDataSource,
}: ReservationDetailRouteProps & PreviewDataRouteProps) {
  const reservation = previewDataProvider.getAppointmentDetail(route.params.reservationId);

  return <ReservationDetailScreen reservation={reservation} isReadOnly={previewDataSource === "real"} onBack={() => navigation.goBack()} />;
}

function CustomerListRoute({ navigation, previewDataProvider }: CustomerListRouteProps & PreviewDataRouteProps) {
  return (
    <CustomerListScreen
      customers={previewDataProvider.getCustomerSummaries()}
      onOpenCustomer={(customerId) => navigation.navigate("CustomerDetail", { customerId })}
    />
  );
}

function CustomerDetailRoute({ navigation, route, previewDataProvider }: CustomerDetailRouteProps & PreviewDataRouteProps) {
  const customer = previewDataProvider.getCustomerDetail(route.params.customerId);

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

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const tabScreenOptions = ({ route }: { route: { name: keyof MainTabsParamList } }) => ({
  headerShown: false,
  tabBarShowIcon: true,
  tabBarActiveTintColor: "#1f6b5b",
  tabBarInactiveTintColor: "#817f7a",
  tabBarIcon: ({ color, focused }: { color: string; focused: boolean; size: number }) => {
    const iconNameByRoute: Record<keyof MainTabsParamList, keyof typeof Ionicons.glyphMap> = {
      Today: focused ? "home" : "home-outline",
      Reservations: focused ? "calendar" : "calendar-outline",
      Customers: focused ? "paw" : "paw-outline",
      Settings: focused ? "settings" : "settings-outline",
    };

    return <Ionicons name={iconNameByRoute[route.name]} size={24} color={color} />;
  },
  tabBarItemStyle: {
    height: 66,
    justifyContent: "center" as const,
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: "700" as const,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 0,
  },
  tabBarStyle: {
    height: 76,
    borderTopColor: "#eee8df",
    backgroundColor: "#ffffff",
    paddingTop: 8,
    paddingBottom: 8,
  },
});

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    borderTopWidth: 4,
    borderTopColor: "#253822",
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
  tabShell: {
    flex: 1,
  },
  pushToast: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce4ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  pushToastTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  pushToastBody: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 19,
  },
});
