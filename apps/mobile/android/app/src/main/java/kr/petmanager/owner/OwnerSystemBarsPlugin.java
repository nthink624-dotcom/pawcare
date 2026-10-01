package kr.petmanager.owner;

import android.view.Window;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OwnerSystemBars")
public class OwnerSystemBarsPlugin extends Plugin {

    @PluginMethod
    public void getStatusBarInset(PluginCall call) {
        Window window = getActivity().getWindow();
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(window.getDecorView());
        int statusBarInsetPx = insets == null ? 0 : insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
        if (statusBarInsetPx <= 0) {
            int statusBarHeightId = getContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (statusBarHeightId > 0) {
                statusBarInsetPx = getContext().getResources().getDimensionPixelSize(statusBarHeightId);
            }
        }

        float density = getContext().getResources().getDisplayMetrics().density;
        JSObject result = new JSObject();
        result.put("statusBarInsetTop", statusBarInsetPx / density);
        call.resolve(result);
    }
}
