package kr.petmanager.owner;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.app.role.RoleManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "OwnerCallScreening",
    permissions = {
        @Permission(alias = "phoneState", strings = { Manifest.permission.READ_PHONE_STATE }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
        @Permission(alias = "answerPhoneCalls", strings = { Manifest.permission.ANSWER_PHONE_CALLS })
    }
)
public class OwnerCallScreeningPlugin extends Plugin {
    private static final int ROLE_REQUEST_CODE = 9172;

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject response = new JSObject();
        response.put("available", isRoleAvailable());
        response.put("enabled", isRoleHeld());
        response.put("dialerEnabled", isDialerRoleHeld());
        response.put("fullScreenIntentAllowed", canUseFullScreenIntent());
        response.put("active", OwnerCallScreeningStore.isEnabled(getContext()));
        response.put("phoneStateGranted", getPermissionState("phoneState") == com.getcapacitor.PermissionState.GRANTED);
        response.put("answerPhoneCallsGranted", getPermissionState("answerPhoneCalls") == com.getcapacitor.PermissionState.GRANTED);
        response.put("deviceId", OwnerCallScreeningStore.getOrCreateDeviceId(getContext()));
        call.resolve(response);
    }

    @PluginMethod
    public void requestPhoneStateAccess(PluginCall call) {
        if (getPermissionState("phoneState") == com.getcapacitor.PermissionState.GRANTED) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }
        requestPermissionForAlias("phoneState", call, "phoneStatePermissionCallback");
    }

    @PluginMethod
    public void requestAnswerPhoneCallsAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26 || getPermissionState("answerPhoneCalls") == com.getcapacitor.PermissionState.GRANTED) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }
        requestPermissionForAlias("answerPhoneCalls", call, "answerPhoneCallsPermissionCallback");
    }

    @PluginMethod
    public void requestNotificationAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        OwnerCallScreeningStore.setEnabled(getContext(), enabled);
        if (!enabled) {
            JSONObject config = OwnerCallScreeningStore.getConfig(getContext());
            OwnerCallNotification.cancel(getContext(), config.optString("activeProviderCallId", ""));
            OwnerCallScreeningStore.clearActiveCall(getContext());
            OwnerCallScreeningStore.clearPendingReservationAction(getContext());
            OwnerCallScreeningStore.clearPendingIncomingCallChoice(getContext());
        }
        call.resolve(new JSObject().put("enabled", enabled));
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED;
        if (granted) call.resolve(new JSObject().put("granted", true));
        else call.reject("캐치콜 수신 알림 권한을 허용해 주세요.", "NOTIFICATION_PERMISSION_DENIED");
    }

    @PermissionCallback
    private void phoneStatePermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("phoneState") == com.getcapacitor.PermissionState.GRANTED;
        if (granted) call.resolve(new JSObject().put("granted", true));
        else call.reject("?꾪솕 ?곹깭瑜?媛먯? ?꾩슂??沅뚰븳???덉슜?댁빞 ?⑸땲??", "PHONE_STATE_PERMISSION_DENIED");
    }

    @PermissionCallback
    private void answerPhoneCallsPermissionCallback(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < 26 || getPermissionState("answerPhoneCalls") == com.getcapacitor.PermissionState.GRANTED;
        if (granted) call.resolve(new JSObject().put("granted", true));
        else call.reject("통화 받기와 통화 종료를 사용하려면 전화 권한이 필요합니다.", "ANSWER_PHONE_CALLS_PERMISSION_DENIED");
    }

    @PluginMethod
    public void requestRole(PluginCall call) {
        if (!isRoleAvailable()) {
            call.reject("이 Android 기기에서는 통화 확인 기능을 사용할 수 없습니다.", "CALL_SCREENING_UNAVAILABLE");
            return;
        }
        if (isRoleHeld()) {
            call.resolve(new JSObject().put("enabled", true));
            return;
        }
        RoleManager roleManager = (RoleManager) getContext().getSystemService(RoleManager.class);
        if (roleManager == null) {
            call.reject("Android 통화 확인 설정을 열 수 없습니다.", "CALL_SCREENING_UNAVAILABLE");
            return;
        }
        startActivityForResult(call, roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), "callScreeningRoleResult");
    }

    @PluginMethod
    public void requestDialerRole(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Android 10 이상에서 기본 전화 화면을 설정할 수 있습니다.", "DIALER_ROLE_UNAVAILABLE");
            return;
        }
        RoleManager roleManager = getContext().getSystemService(RoleManager.class);
        if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            call.reject("이 기기에서 기본 전화 앱 설정을 사용할 수 없습니다.", "DIALER_ROLE_UNAVAILABLE");
            return;
        }
        if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
            call.resolve(new JSObject().put("enabled", true));
            return;
        }
        startActivityForResult(call, roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), "dialerRoleResult");
    }

    @ActivityCallback
    private void dialerRoleResult(PluginCall call, ActivityResult result) {
        boolean held = isDialerRoleHeld();
        if (held) call.resolve(new JSObject().put("enabled", true));
        else call.reject("기본 전화 앱 설정이 완료되지 않았습니다.", "DIALER_ROLE_DENIED");
    }

    @PluginMethod
    public void requestFullScreenIntentAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34 || canUseFullScreenIntent()) {
            call.resolve(new JSObject().put("granted", true));
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            .setData(Uri.parse("package:" + getContext().getPackageName()));
        startActivityForResult(call, intent, "fullScreenIntentResult");
    }

    @ActivityCallback
    private void fullScreenIntentResult(PluginCall call, ActivityResult result) {
        if (canUseFullScreenIntent()) call.resolve(new JSObject().put("granted", true));
        else call.reject("수신 화면을 바로 표시하려면 전체 화면 알림을 허용해 주세요.", "FULL_SCREEN_INTENT_DENIED");
    }

    @ActivityCallback
    private void callScreeningRoleResult(PluginCall call, ActivityResult result) {
        JSObject response = new JSObject();
        response.put("enabled", isRoleHeld());
        if (isRoleHeld()) call.resolve(response);
        else call.reject("통화 확인 권한이 켜지지 않았습니다.", "CALL_SCREENING_DENIED");
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String shopId = call.getString("shopId", "").trim();
        String integrationId = call.getString("integrationId", "").trim();
        String apiOrigin = call.getString("apiOrigin", "").trim();
        String accessToken = call.getString("accessToken", "").trim();
        if (shopId.isEmpty() || integrationId.isEmpty() || accessToken.isEmpty() || !isSafeApiOrigin(apiOrigin)) {
            call.reject("통화 확인 연결 정보를 확인해 주세요.", "CALL_SCREENING_CONFIG_INVALID");
            return;
        }
        JSONObject values = new JSONObject();
        try {
            values.put("shopId", shopId);
            values.put("integrationId", integrationId);
            values.put("apiOrigin", apiOrigin);
            values.put("accessToken", accessToken);
            values.put("callCaptureEnabled", true);
            OwnerCallScreeningStore.configure(getContext(), values);
            call.resolve(new JSObject().put("configured", true));
        } catch (Exception error) {
            call.reject("통화 확인 연결 정보를 저장하지 못했습니다.", "CALL_SCREENING_CONFIG_FAILED", error);
        }
    }

    @PluginMethod
    public void setPhoneAllowlist(PluginCall call) {
        JSONArray phoneNumbers = call.getArray("phoneNumbers");
        if (phoneNumbers == null) {
            call.reject("고객 번호 목록을 확인해 주세요.", "CALL_SCREENING_ALLOWLIST_INVALID");
            return;
        }
        OwnerCallScreeningStore.setAllowedPhoneNumbers(getContext(), phoneNumbers);
        call.resolve(new JSObject().put("configured", true));
    }

    @PluginMethod
    public void getPendingEvents(PluginCall call) {
        call.resolve(new JSObject().put("events", OwnerCallScreeningStore.getPending(getContext())));
    }

    @PluginMethod
    public void acknowledgeEvents(PluginCall call) {
        JSONArray eventIds = call.getArray("eventIds");
        if (eventIds == null) {
            call.reject("통화 이벤트를 확인하지 못했습니다.");
            return;
        }
        OwnerCallScreeningStore.acknowledge(getContext(), eventIds);
        call.resolve();
    }

    @PluginMethod
    public void getPendingReservationAction(PluginCall call) {
        JSONObject pending = OwnerCallScreeningStore.getPendingReservationAction(getContext());
        JSObject response = new JSObject();
        response.put("pending", pending.optBoolean("pending", false));
        response.put("providerCallId", pending.optString("providerCallId", ""));
        response.put("callerNumber", pending.optString("callerNumber", ""));
        call.resolve(response);
    }

    @PluginMethod
    public void clearPendingReservationAction(PluginCall call) {
        OwnerCallScreeningStore.clearPendingReservationAction(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getPendingIncomingCallChoice(PluginCall call) {
        JSONObject pending = OwnerCallScreeningStore.getPendingIncomingCallChoice(getContext());
        JSObject response = new JSObject();
        response.put("pending", pending.optBoolean("pending", false));
        response.put("providerCallId", pending.optString("providerCallId", ""));
        response.put("callerNumber", pending.optString("callerNumber", ""));
        call.resolve(response);
    }

    @PluginMethod
    public void clearPendingIncomingCallChoice(PluginCall call) {
        JSONObject pending = OwnerCallScreeningStore.getPendingIncomingCallChoice(getContext());
        OwnerCallScreeningStore.clearPendingIncomingCallChoice(getContext());
        OwnerCallNotification.cancel(getContext(), pending.optString("providerCallId", ""));
        call.resolve();
    }

    @PluginMethod
    public void answerIncomingCall(PluginCall call) {
        String providerCallId = call.getString("providerCallId", "");
        boolean answered = OwnerInCallService.answer() || OwnerCallControl.answer(getContext());
        OwnerCallScreeningStore.clearPendingIncomingCallChoice(getContext());
        OwnerCallNotification.cancel(getContext(), providerCallId);
        call.resolve(new JSObject().put("answered", answered));
    }

    @PluginMethod
    public void endIncomingCall(PluginCall call) {
        String providerCallId = call.getString("providerCallId", "");
        boolean ended = OwnerInCallService.disconnect() || OwnerCallControl.end(getContext());
        OwnerCallScreeningStore.clearPendingIncomingCallChoice(getContext());
        OwnerCallNotification.cancel(getContext(), providerCallId);
        call.resolve(new JSObject().put("ended", ended));
    }

    void handleIncomingCallIntent(Intent intent) {
        if (intent == null || !OwnerCallNotification.ACTION_INCOMING_CALL_CHOICE.equals(intent.getAction())) return;
        String providerCallId = intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID);
        String callerNumber = intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER);
        OwnerCallScreeningStore.setPendingIncomingCallChoice(getContext(), providerCallId, callerNumber);
        JSObject choice = new JSObject();
        choice.put("pending", true);
        choice.put("providerCallId", providerCallId == null ? "" : providerCallId);
        choice.put("callerNumber", callerNumber == null ? "" : callerNumber);
        notifyListeners("incomingCallChoice", choice);
    }

    void handleReservationIntent(Intent intent) {
        if (intent == null || !OwnerCallNotification.ACTION_ADD_RESERVATION.equals(intent.getAction())) return;
        String providerCallId = intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID);
        String callerNumber = intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER);
        OwnerCallScreeningStore.setPendingReservationAction(getContext(), providerCallId, callerNumber);
        OwnerCallNotification.cancel(getContext(), providerCallId);
        JSObject action = new JSObject();
        action.put("pending", true);
        action.put("providerCallId", providerCallId == null ? "" : providerCallId);
        action.put("callerNumber", callerNumber == null ? "" : callerNumber);
        notifyListeners("reservationAction", action);
    }

    private boolean isRoleAvailable() {
        if (Build.VERSION.SDK_INT < 29) return false;
        RoleManager roleManager = (RoleManager) getContext().getSystemService(RoleManager.class);
        return roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING);
    }

    private boolean isRoleHeld() {
        if (Build.VERSION.SDK_INT < 29) return false;
        RoleManager roleManager = (RoleManager) getContext().getSystemService(RoleManager.class);
        return roleManager != null && roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
    }

    private boolean isDialerRoleHeld() {
        if (Build.VERSION.SDK_INT < 29) return false;
        RoleManager roleManager = getContext().getSystemService(RoleManager.class);
        return roleManager != null && roleManager.isRoleHeld(RoleManager.ROLE_DIALER);
    }

    private boolean canUseFullScreenIntent() {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        return manager != null && manager.canUseFullScreenIntent();
    }

    private boolean isSafeApiOrigin(String value) {
        try {
            Uri uri = Uri.parse(value);
            if ("https".equalsIgnoreCase(uri.getScheme())) {
                String host = uri.getHost();
                boolean allowedHost = "www.petmanager.co.kr".equalsIgnoreCase(host)
                    || "petmanager.co.kr".equalsIgnoreCase(host);
                return allowedHost && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()));
            }
            return "http".equalsIgnoreCase(uri.getScheme()) && ("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost()));
        } catch (Exception ignored) {
            return false;
        }
    }
}
