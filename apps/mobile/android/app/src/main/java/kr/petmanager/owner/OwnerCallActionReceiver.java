package kr.petmanager.owner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class OwnerCallActionReceiver extends BroadcastReceiver {
    static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!OwnerCallNotification.ACTION_DISMISS.equals(intent.getAction())) return;
        int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
        String providerCallId = intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID);
        OwnerCallNotification.cancel(context, notificationId);
        if (providerCallId == null || providerCallId.trim().isEmpty()) return;

        PendingResult pendingResult = goAsync();
        Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                org.json.JSONArray queued = OwnerCallScreeningStore.enqueueChoice(appContext, providerCallId, "phone_only_selected");
                for (int index = 0; index < queued.length(); index += 1) {
                    org.json.JSONObject choice = queued.optJSONObject(index);
                    if (choice != null && providerCallId.equals(choice.optString("providerCallId", ""))) {
                        for (int attempt = 0; attempt < 2; attempt += 1) {
                            if (OwnerCallScreeningTransport.sendChoiceIfPossible(appContext, choice)) break;
                            if (attempt == 0) {
                                try {
                                    Thread.sleep(500L);
                                } catch (InterruptedException interrupted) {
                                    Thread.currentThread().interrupt();
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
            } finally {
                pendingResult.finish();
            }
        }, "petmanager-call-phone-only-choice").start();
    }
}
