package kr.petmanager.owner;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(
    name = "OwnerAppPermissions",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class OwnerAppPermissionsPlugin extends Plugin {
    private static final List<String> ALLOWED_PERMISSIONS = Arrays.asList("camera", "microphone", "notifications");

    @PluginMethod
    public void checkAll(PluginCall call) {
        call.resolve(allStates());
    }

    @PluginMethod
    public void request(PluginCall call) {
        String permission = call.getString("permission", "");
        if (!ALLOWED_PERMISSIONS.contains(permission)) {
            call.reject("확인할 앱 권한을 찾지 못했습니다.");
            return;
        }
        String current = stateFor(permission);
        if ("granted".equals(current) || "permanently_denied".equals(current)) {
            JSObject result = new JSObject();
            result.put("state", current);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(permission, call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        String permission = call.getString("permission", "");
        JSObject result = new JSObject();
        result.put("state", stateFor(permission));
        call.resolve(result);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", getContext().getPackageName(), null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("휴대폰 앱 설정을 열 수 없습니다.");
            return;
        }
        getContext().startActivity(intent);
        call.resolve();
    }

    private JSObject allStates() {
        JSObject result = new JSObject();
        result.put("camera", stateFor("camera"));
        result.put("microphone", stateFor("microphone"));
        result.put("notifications", stateFor("notifications"));
        return result;
    }

    private String stateFor(String permission) {
        if (!ALLOWED_PERMISSIONS.contains(permission)) return "unsupported";
        if ("notifications".equals(permission)) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            boolean appEnabled = Build.VERSION.SDK_INT < Build.VERSION_CODES.N || manager == null || manager.areNotificationsEnabled();
            if (!appEnabled) return "permanently_denied";
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        }
        PermissionState state = getPermissionState(permission);
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.PROMPT) return "prompt";
        if (state == PermissionState.PROMPT_WITH_RATIONALE) return "denied";
        if (state == PermissionState.DENIED) return "permanently_denied";
        return "unsupported";
    }
}
