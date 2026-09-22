package kr.petmanager.owner;

import android.content.IntentSender;
import android.os.Bundle;
import android.view.View;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {
    private static final int APP_UPDATE_REQUEST_CODE = 1001;
    private AppUpdateManager appUpdateManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalCameraPlugin.class);
        registerPlugin(OwnerNotificationSettingsPlugin.class);
        registerPlugin(OwnerSpeechRecognitionPlugin.class);
        registerPlugin(OwnerBackNavigationPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (dismissKeyboardIfVisible()) return;
                dispatchOwnerBack();
            }
        });

        appUpdateManager = AppUpdateManagerFactory.create(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appUpdateManager == null) return;

        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                startImmediateUpdate(appUpdateInfo);
                return;
            }

            if (
                appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
            ) {
                startImmediateUpdate(appUpdateInfo);
            }
        });
    }

    private void startImmediateUpdate(AppUpdateInfo appUpdateInfo) {
        try {
            appUpdateManager.startUpdateFlowForResult(
                appUpdateInfo,
                AppUpdateType.IMMEDIATE,
                this,
                APP_UPDATE_REQUEST_CODE
            );
        } catch (IntentSender.SendIntentException ignored) {
            // Keep the app usable when Google Play cannot start the update flow.
        }
    }

    private boolean dismissKeyboardIfVisible() {
        View content = findViewById(android.R.id.content);
        if (content == null) return false;

        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(content);
        if (insets == null || !insets.isVisible(WindowInsetsCompat.Type.ime())) return false;

        WindowInsetsControllerCompat controller = ViewCompat.getWindowInsetsController(content);
        if (controller != null) controller.hide(WindowInsetsCompat.Type.ime());
        return true;
    }

    private void dispatchOwnerBack() {
        PluginHandle handle = getBridge() == null ? null : getBridge().getPlugin("OwnerBackNavigation");
        if (handle != null && handle.getInstance() instanceof OwnerBackNavigationPlugin) {
            ((OwnerBackNavigationPlugin) handle.getInstance()).dispatchHardwareBack();
        }
    }
}
