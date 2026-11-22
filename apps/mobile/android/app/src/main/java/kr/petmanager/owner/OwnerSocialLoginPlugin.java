package kr.petmanager.owner;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OwnerSocialLogin")
public class OwnerSocialLoginPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String value = call.getString("url");
        if (value == null) {
            call.reject("Missing social login URL");
            return;
        }
        Uri url = Uri.parse(value);
        String host = url.getHost();
        boolean project = "ysxykikqnneuhypybjry.supabase.co".equals(host) || "qefxdtmdtvnzgupmjlom.supabase.co".equals(host);
        if (!"https".equals(url.getScheme()) || !project || url.getPort() != -1 || url.getUserInfo() != null
                || url.getFragment() != null || !"/auth/v1/authorize".equals(url.getEncodedPath())) {
            call.reject("Unexpected social login URL");
            return;
        }
        String callback = url.getQueryParameter("redirect_to");
        if (callback == null || !callback.matches("kr\\.petmanager\\.owner://auth/auth/social/callback/[a-f0-9]{32}")) {
            call.reject("Unexpected social login return URL");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (ActivityNotFoundException unavailable) {
                call.reject("System browser unavailable");
            }
        });
    }
}
