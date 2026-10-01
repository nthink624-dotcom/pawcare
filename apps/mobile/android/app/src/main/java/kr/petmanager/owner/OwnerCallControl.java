package kr.petmanager.owner;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telecom.TelecomManager;

final class OwnerCallControl {
    private OwnerCallControl() {}

    static boolean answer(Context context) {
        if (Build.VERSION.SDK_INT < 26 || context.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        TelecomManager telecomManager = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
        if (telecomManager == null) return false;
        try {
            telecomManager.acceptRingingCall();
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    static boolean end(Context context) {
        if (Build.VERSION.SDK_INT < 28 || context.checkSelfPermission(Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        TelecomManager telecomManager = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
        if (telecomManager == null) return false;
        try {
            return telecomManager.endCall();
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
