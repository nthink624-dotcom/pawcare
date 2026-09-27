package kr.petmanager.owner;

import android.Manifest;
import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

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
    permissions = { @Permission(alias = "phoneState", strings = { Manifest.permission.READ_PHONE_STATE }) }
)
public class OwnerCallScreeningPlugin extends Plugin {
    private static final int ROLE_REQUEST_CODE = 9172;

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject response = new JSObject();
        response.put("available", isRoleAvailable());
        response.put("enabled", isRoleHeld());
        response.put("phoneStateGranted", getPermissionState("phoneState") == com.getcapacitor.PermissionState.GRANTED);
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

    @PermissionCallback
    private void phoneStatePermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("phoneState") == com.getcapacitor.PermissionState.GRANTED;
        if (granted) call.resolve(new JSObject().put("granted", true));
        else call.reject("?꾪솕 ?곹깭瑜?媛먯? ?꾩슂??沅뚰븳???덉슜?댁빞 ?⑸땲??", "PHONE_STATE_PERMISSION_DENIED");
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
            OwnerCallScreeningStore.configure(getContext(), values);
            call.resolve(new JSObject().put("configured", true));
        } catch (Exception error) {
            call.reject("통화 확인 연결 정보를 저장하지 못했습니다.", "CALL_SCREENING_CONFIG_FAILED", error);
        }
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
