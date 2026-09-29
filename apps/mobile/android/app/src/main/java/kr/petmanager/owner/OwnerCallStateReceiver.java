package kr.petmanager.owner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.TelephonyManager;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class OwnerCallStateReceiver extends BroadcastReceiver {
    private static final String ACTION_PHONE_STATE = "android.intent.action.PHONE_STATE";
    private static final String EXTRA_STATE = "state";
    private static final String STATE_RINGING = "RINGING";
    private static final String STATE_OFFHOOK = "OFFHOOK";
    private static final String STATE_IDLE = "IDLE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_PHONE_STATE.equals(intent.getAction())) return;
        String state = intent.getStringExtra(EXTRA_STATE);
        if (state == null) return;

        if (STATE_RINGING.equals(state)) {
            String incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
            if (incomingNumber != null && !incomingNumber.trim().isEmpty()) {
                OwnerCallScreeningService.handleIncoming(context, incomingNumber);
            }
            return;
        }

        JSONObject config = OwnerCallScreeningStore.getConfig(context);
        String providerCallId = config.optString("activeProviderCallId", "").trim();
        String callerNumber = config.optString("activeCallerNumber", "").trim();
        if (providerCallId.isEmpty() || callerNumber.isEmpty()) return;

        if (STATE_OFFHOOK.equals(state)) {
            OwnerCallNotification.cancel(context, providerCallId);
            try {
                JSONObject active = new JSONObject();
                active.put("activeAnswered", true);
                OwnerCallScreeningStore.configure(context, active);
            } catch (Exception ignored) {
                // The next state still has a safe fallback to an ended event.
            }
            sendEvent(context, "answered", providerCallId, callerNumber);
            return;
        }

        if (STATE_IDLE.equals(state)) {
            boolean answered = config.optBoolean("activeAnswered", false);
            sendEvent(context, answered ? "ended" : "missed", providerCallId, callerNumber);
            OwnerCallNotification.cancel(context, providerCallId);
            OwnerCallScreeningStore.clearActiveCall(context);
        }
    }

    private void sendEvent(Context context, String eventType, String providerCallId, String callerNumber) {
        try {
            JSONObject config = OwnerCallScreeningStore.getConfig(context);
            JSONObject event = new JSONObject();
            event.put("shopId", config.optString("shopId", ""));
            event.put("integrationId", config.optString("integrationId", ""));
            event.put("providerEventId", providerCallId + ":" + eventType);
            event.put("eventType", eventType);
            event.put("direction", "inbound");
            event.put("callerNumber", callerNumber);
            event.put("occurredAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date()));
            JSONObject metadata = new JSONObject();
            metadata.put("providerCallId", providerCallId);
            metadata.put("deviceId", OwnerCallScreeningStore.getOrCreateDeviceId(context));
            event.put("metadata", metadata);
            new Thread(() -> OwnerCallScreeningTransport.sendOrQueue(context, event), "petmanager-call-state-upload").start();
        } catch (Exception ignored) {
            // Never interfere with the phone state broadcast.
        }
    }
}
