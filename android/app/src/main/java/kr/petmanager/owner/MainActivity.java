package kr.petmanager.owner;

import android.os.Bundle;
import android.view.View;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
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
