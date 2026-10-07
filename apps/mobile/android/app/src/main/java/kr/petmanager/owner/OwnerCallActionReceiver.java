package kr.petmanager.owner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class OwnerCallActionReceiver extends BroadcastReceiver {
    static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? "" : intent.getAction();
        if (OwnerCallNotification.ACTION_DISMISS.equals(action)) {
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
                        if (choice == null || !providerCallId.equals(choice.optString("providerCallId", ""))) continue;
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
                } finally {
                    pendingResult.finish();
                }
            }, "petmanager-call-phone-only-choice").start();
            return;
        }
        if (OwnerCallNotification.ACTION_ADD_RESERVATION.equals(action)) {
            String reservationCallId = intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID);
            String callerNumber = intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER);
            OwnerCallScreeningStore.setPendingReservationAction(context, reservationCallId, callerNumber);
            Intent openApp = new Intent(context, MainActivity.class)
                .setAction(action)
                .putExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID, reservationCallId)
                .putExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER, callerNumber)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(openApp);
            return;
        }
        if (OwnerCallNotification.ACTION_ANSWER_CALL.equals(action) || OwnerCallNotification.ACTION_END_CALL.equals(action)) {
            // Invalidate stale actions from older builds. Samsung Phone remains the call controller.
            OwnerCallNotification.cancel(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0));
        }
    }
}
