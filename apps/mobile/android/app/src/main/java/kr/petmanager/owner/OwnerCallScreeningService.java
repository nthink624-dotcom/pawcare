package kr.petmanager.owner;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;

import org.json.JSONObject;

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
        handleIncoming(this, callerNumber);
    }

    static void handleIncoming(Context context, String callerNumber) {
        try {
            JSONObject event = OwnerCallScreeningStore.createIncomingEvent(context, callerNumber);
            if (event == null) return;
            JSONObject metadata = event.optJSONObject("metadata");
            String providerCallId = metadata == null ? "" : metadata.optString("providerCallId", "");
            if (providerCallId.isEmpty()) return;
            if (!OwnerInCallService.isDefaultDialer(context)) {
                OwnerCallNotification.showIncoming(context, providerCallId, callerNumber);
            }

            new Thread(() -> OwnerCallScreeningTransport.sendOrQueue(context, event), "petmanager-call-upload").start();
        } catch (Exception ignored) {
            // The call has already been allowed. A malformed local event must
            // never interfere with the system phone flow.
        }
    }

}
