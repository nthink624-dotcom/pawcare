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
            OwnerCallNotification.cancel(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0));
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
        if (!OwnerCallNotification.ACTION_ANSWER_CALL.equals(action) && !OwnerCallNotification.ACTION_END_CALL.equals(action)) return;

        String providerCallId = intent.getStringExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID);
        boolean completed = OwnerCallNotification.ACTION_ANSWER_CALL.equals(action)
            ? (OwnerInCallService.answer() || OwnerCallControl.answer(context))
            : (OwnerInCallService.disconnect() || OwnerCallControl.end(context));
        if (!completed) {
            OwnerCallNotification.showIncoming(
                context,
                providerCallId,
                intent.getStringExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER),
                "통화 제어에 실패했어요. 권한을 확인하거나 기본 전화 화면을 이용해 주세요."
            );
            return;
        }
        OwnerCallScreeningStore.clearPendingIncomingCallChoice(context);
        OwnerCallNotification.cancel(context, providerCallId);
        OwnerCallNotification.cancel(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0));
    }
}
