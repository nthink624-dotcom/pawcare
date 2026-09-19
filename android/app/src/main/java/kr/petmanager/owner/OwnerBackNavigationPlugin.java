package kr.petmanager.owner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OwnerBackNavigation")
public class OwnerBackNavigationPlugin extends Plugin {
    public void dispatchHardwareBack() {
        if (!hasListeners("backButton")) return;
        notifyListeners("backButton", new JSObject());
    }
}
