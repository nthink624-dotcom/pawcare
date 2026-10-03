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
    static final String ACTION_REGISTER_CUSTOMER = "kr.petmanager.owner.action.REGISTER_CALL_CUSTOMER";
    static final String ACTION_DISMISS = "kr.petmanager.owner.action.DISMISS_CALL_NOTIFICATION";
    static final String ACTION_INCOMING_CALL_CHOICE = "kr.petmanager.owner.action.INCOMING_CALL_CHOICE";
    static final String ACTION_ANSWER_CALL = "kr.petmanager.owner.action.ANSWER_CALL";
    static final String ACTION_END_CALL = "kr.petmanager.owner.action.END_CALL";
    static final String EXTRA_PROVIDER_CALL_ID = "providerCallId";
    static final String EXTRA_CALLER_NUMBER = "callerNumber";

    private static final String CHANNEL_ID = "catch-call-incoming-v2";
    private static final int REQUEST_CODE_BASE = 47000;

    private OwnerCallNotification() {}

    static void showIncoming(Context context, String providerCallId, String callerNumber) {
        showIncoming(context, providerCallId, callerNumber, null, true);
    }

    static void showIncoming(Context context, String providerCallId, String callerNumber, String actionFailureMessage) {
        showIncoming(context, providerCallId, callerNumber, actionFailureMessage, true);
    }

    static void showIncoming(Context context, String providerCallId, String callerNumber, boolean registeredCaller) {
        showIncoming(context, providerCallId, callerNumber, null, registeredCaller);
    }

    private static void showIncoming(Context context, String providerCallId, String callerNumber, String actionFailureMessage, boolean registeredCaller) {
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

        Intent registrationIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_REGISTER_CUSTOMER)
            .putExtra(EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(EXTRA_CALLER_NUMBER, callerNumber)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent registrationPendingIntent = PendingIntent.getActivity(
            context,
            notificationId + 2,
            registrationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent choiceIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_INCOMING_CALL_CHOICE)
            .putExtra(EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(EXTRA_CALLER_NUMBER, callerNumber)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent choicePendingIntent = PendingIntent.getActivity(
            context,
            notificationId + 3,
            choiceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String phoneTail = callerNumber == null || callerNumber.length() < 4
            ? ""
            : callerNumber.substring(callerNumber.length() - 4);
        String contentText = actionFailureMessage != null && !actionFailureMessage.trim().isEmpty()
            ? actionFailureMessage
            : phoneTail.isEmpty()
                ? (registeredCaller ? "예약을 바로 접수할 수 있어요." : "새 고객으로 등록할 수 있어요.")
                : "010-****-" + phoneTail + (registeredCaller ? " · 예약을 바로 접수할 수 있어요." : " · 새 고객으로 등록할 수 있어요.");
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(kr.petmanager.owner.R.drawable.ic_stat_paw)
            .setContentTitle(registeredCaller ? "등록 고객에게 전화가 왔어요" : "새 번호로 전화가 왔어요")
            .setContentText(contentText)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(choicePendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(new NotificationCompat.Action.Builder(0, "신규고객 등록", registrationPendingIntent).build())
            .addAction(new NotificationCompat.Action.Builder(0, "예약접수", reservationPendingIntent).build())
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
        channel.setDescription("전화가 왔을 때 신규고객 등록 또는 예약접수로 바로 이동합니다.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    private static int notificationId(String providerCallId) {
        return REQUEST_CODE_BASE + ((providerCallId == null ? 0 : providerCallId.hashCode()) & 0x7fff);
    }
}
