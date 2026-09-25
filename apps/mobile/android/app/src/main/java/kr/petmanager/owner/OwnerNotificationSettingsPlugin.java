package kr.petmanager.owner;

import android.content.Intent;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Set;

@CapacitorPlugin(name = "OwnerNotificationSettings")
public class OwnerNotificationSettingsPlugin extends Plugin {
    private static final Set<String> ALLOWED_CHANNEL_IDS = Set.of(
        "owner-bookings-sound-v1",
        "owner-bookings-vibrate-v1",
        "owner-bookings-silent-v1"
    );

    @PluginMethod
    public void getAppNotificationState(PluginCall call) {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        boolean enabled = Build.VERSION.SDK_INT < Build.VERSION_CODES.N || manager == null || manager.areNotificationsEnabled();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        openGuarded(intent, call);
    }

    @PluginMethod
    public void openChannelNotificationSettings(PluginCall call) {
        String channelId = call.getString("channelId", "");
        if (!ALLOWED_CHANNEL_IDS.contains(channelId)) {
            call.reject("알림 채널을 확인하지 못했습니다.");
            return;
        }
        Intent intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
            .putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
        openGuarded(intent, call);
    }

    private void openGuarded(Intent intent, PluginCall call) {
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("휴대폰 알림 설정을 열 수 없습니다.");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
