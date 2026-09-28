package kr.petmanager.owner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class OwnerCallActionReceiver extends BroadcastReceiver {
    static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!OwnerCallNotification.ACTION_DISMISS.equals(intent.getAction())) return;
        OwnerCallNotification.cancel(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0));
    }
}
