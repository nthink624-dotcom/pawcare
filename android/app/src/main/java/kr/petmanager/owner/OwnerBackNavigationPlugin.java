package kr.petmanager.owner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OwnerBackNavigation")
public class OwnerBackNavigationPlugin extends Plugin {
    public boolean dispatchHardwareBack() {
        if (!hasListeners("backButton")) return false;
        notifyListeners("backButton", new JSObject());
        return true;
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        getActivity().finishAndRemoveTask();
        call.resolve();
    }
}
