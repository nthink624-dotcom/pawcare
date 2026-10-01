package kr.petmanager.owner;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalCameraPlugin.class);
        registerPlugin(OwnerSystemBarsPlugin.class);
        registerPlugin(OwnerNotificationSettingsPlugin.class);
        registerPlugin(OwnerSpeechRecognitionPlugin.class);
        registerPlugin(OwnerBackNavigationPlugin.class);
        registerPlugin(OwnerPlayUpdatePlugin.class);
        registerPlugin(OwnerCallScreeningPlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemBars();
        handleCallIntent(getIntent());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (dismissKeyboardIfVisible()) return;
                dispatchOwnerBack();
            }
        });

    }

    private void configureSystemBars() {
        getWindow().setStatusBarColor(Color.WHITE);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent intent) {
        if (intent != null && OwnerCallNotification.ACTION_INCOMING_CALL_CHOICE.equals(intent.getAction())) {
            OwnerCallScreeningStore.setPendingIncomingCallChoice(
                this,
                intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID),
                intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER)
            );
        } else if (intent != null && OwnerCallNotification.ACTION_ADD_RESERVATION.equals(intent.getAction())) {
            OwnerCallScreeningStore.setPendingReservationAction(
                this,
                intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID),
                intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER)
            );
            OwnerCallNotification.cancel(this, intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID));
        }
        PluginHandle handle = getBridge() == null ? null : getBridge().getPlugin("OwnerCallScreening");
        if (handle != null && handle.getInstance() instanceof OwnerCallScreeningPlugin) {
            OwnerCallScreeningPlugin plugin = (OwnerCallScreeningPlugin) handle.getInstance();
            plugin.handleIncomingCallIntent(intent);
            plugin.handleReservationIntent(intent);
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
