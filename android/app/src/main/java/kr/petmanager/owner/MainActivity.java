package kr.petmanager.owner;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalCameraPlugin.class);
        registerPlugin(OwnerNotificationSettingsPlugin.class);
        registerPlugin(OwnerAppPermissionsPlugin.class);
        registerPlugin(OwnerSpeechRecognitionPlugin.class);
        registerPlugin(OwnerBackNavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        PluginHandle handle = getBridge() == null ? null : getBridge().getPlugin("OwnerBackNavigation");
        if (handle != null && handle.getInstance() instanceof OwnerBackNavigationPlugin) {
            if (((OwnerBackNavigationPlugin) handle.getInstance()).dispatchHardwareBack()) return;
        }
        super.onBackPressed();
    }
}
