package kr.petmanager.owner;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    private static final int STATUS_BAR_BACKGROUND = 0xFFE9EEF5;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalCameraPlugin.class);
        registerPlugin(OwnerSystemBarsPlugin.class);
        registerPlugin(OwnerNotificationSettingsPlugin.class);
        registerPlugin(OwnerSpeechRecognitionPlugin.class);
        registerPlugin(OwnerBackNavigationPlugin.class);
        registerPlugin(OwnerPlayUpdatePlugin.class);
        registerPlugin(OwnerCallScreeningPlugin.class);
        registerPlugin(OwnerSocialLoginPlugin.class);
        super.onCreate(savedInstanceState);
        addStatusBarBackground();
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

    private void addStatusBarBackground() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;

        // Android 15+ draws a transparent status bar over the activity.
        View background = new View(this);
        background.setBackgroundColor(STATUS_BAR_BACKGROUND);
        background.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.TOP
        );
        ViewCompat.setOnApplyWindowInsetsListener(background, (view, insets) -> {
            int height = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            if (layout.height != height) {
                layout.height = height;
                view.setLayoutParams(layout);
            }
            return insets;
        });
        addContentView(background, layout);
        ViewCompat.requestApplyInsets(background);
    }

    private void configureSystemBars() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            getWindow().setStatusBarColor(STATUS_BAR_BACKGROUND);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) configureSystemBars();
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
                intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER),
                "choose"
            );
        } else if (intent != null && OwnerCallNotification.ACTION_REGISTER_CUSTOMER.equals(intent.getAction())) {
            OwnerCallScreeningStore.setPendingIncomingCallChoice(
                this,
                intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID),
                intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER),
                "new-customer"
            );
            OwnerCallNotification.cancel(this, intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID));
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
