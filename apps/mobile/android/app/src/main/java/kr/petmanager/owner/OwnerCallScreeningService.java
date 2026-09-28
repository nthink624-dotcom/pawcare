package kr.petmanager.owner;

import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public class OwnerCallScreeningService extends CallScreeningService {
    @Override
    public void onScreenCall(Call.Details callDetails) {
        // The platform waits for this response before ringing. Always allow first;
        // matching and upload happen asynchronously and never delay the call.
        CallResponse response = new CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSilenceCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build();
        respondToCall(callDetails, response);

        if (Build.VERSION.SDK_INT >= 29 && callDetails.getCallDirection() != Call.Details.DIRECTION_INCOMING) return;
        Uri handle = callDetails.getHandle();
        if (handle == null) return;
        String callerNumber = handle.getSchemeSpecificPart();
        if (callerNumber == null || callerNumber.trim().isEmpty()) return;
        // Only process phone numbers synced from this shop's PetManager customers.
        // Personal and unknown calls are still allowed normally and never uploaded.
        if (!OwnerCallScreeningStore.isAllowedCallerNumber(this, callerNumber)) return;

        try {
            JSONObject config = OwnerCallScreeningStore.getConfig(this);
            JSONObject event = new JSONObject();
            event.put("shopId", config.optString("shopId", ""));
            event.put("integrationId", config.optString("integrationId", ""));
            String providerCallId = UUID.randomUUID().toString();
            event.put("providerEventId", providerCallId + ":incoming");
            event.put("eventType", "incoming");
            event.put("direction", "inbound");
            event.put("callerNumber", callerNumber);
            event.put("occurredAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date()));
            JSONObject metadata = new JSONObject();
            metadata.put("providerCallId", providerCallId);
            metadata.put("deviceId", OwnerCallScreeningStore.getOrCreateDeviceId(this));
            event.put("metadata", metadata);

            JSONObject activeCall = new JSONObject();
            activeCall.put("activeProviderCallId", providerCallId);
            activeCall.put("activeCallerNumber", callerNumber);
            activeCall.put("activeAnswered", false);
            OwnerCallScreeningStore.configure(this, activeCall);
            OwnerCallNotification.showIncoming(this, providerCallId, callerNumber);

            new Thread(() -> OwnerCallScreeningTransport.sendOrQueue(this, event), "petmanager-call-upload").start();
        } catch (Exception ignored) {
            // The call has already been allowed. A malformed local event must
            // never interfere with the system phone flow.
        }
    }

}
