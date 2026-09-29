package kr.petmanager.owner;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

final class OwnerCallNotification {
    static final String ACTION_ADD_RESERVATION = "kr.petmanager.owner.action.ADD_CALL_RESERVATION";
    static final String ACTION_DISMISS = "kr.petmanager.owner.action.DISMISS_CALL_NOTIFICATION";
    static final String EXTRA_PROVIDER_CALL_ID = "providerCallId";
    static final String EXTRA_CALLER_NUMBER = "callerNumber";

    private static final String CHANNEL_ID = "catch-call-incoming-v1";
    private static final int REQUEST_CODE_BASE = 47000;

    private OwnerCallNotification() {}

    static void showIncoming(Context context, String providerCallId, String callerNumber) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(manager);

        int notificationId = notificationId(providerCallId);
        Intent reservationIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_ADD_RESERVATION)
            .putExtra(EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(EXTRA_CALLER_NUMBER, callerNumber)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent reservationPendingIntent = PendingIntent.getActivity(
            context,
            notificationId + 1,
            reservationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent dismissIntent = new Intent(context, OwnerCallActionReceiver.class)
            .setAction(ACTION_DISMISS)
            .putExtra(OwnerCallActionReceiver.EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 2,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String phoneTail = callerNumber == null || callerNumber.length() < 4
            ? ""
            : callerNumber.substring(callerNumber.length() - 4);
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(kr.petmanager.owner.R.drawable.ic_stat_paw)
            .setContentTitle("등록 고객에게 전화가 왔어요")
            .setContentText(phoneTail.isEmpty() ? "예약을 바로 추가할 수 있어요." : "010-****-" + phoneTail + " · 예약을 바로 추가할 수 있어요.")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(new NotificationCompat.Action.Builder(0, "예약 추가", reservationPendingIntent).build())
            .addAction(new NotificationCompat.Action.Builder(0, "전화만 받기", dismissPendingIntent).build())
            .build();

        NotificationManagerCompat.from(context).notify(notificationId, notification);
    }

    static void cancel(Context context, String providerCallId) {
        NotificationManagerCompat.from(context).cancel(notificationId(providerCallId));
    }

    static void cancel(Context context, int notificationId) {
        NotificationManagerCompat.from(context).cancel(notificationId);
    }

    private static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "캐치콜 수신 알림",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("등록된 고객의 전화가 왔을 때 예약 추가 버튼을 보여줍니다.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    private static int notificationId(String providerCallId) {
        return REQUEST_CODE_BASE + ((providerCallId == null ? 0 : providerCallId.hashCode()) & 0x7fff);
    }
}
