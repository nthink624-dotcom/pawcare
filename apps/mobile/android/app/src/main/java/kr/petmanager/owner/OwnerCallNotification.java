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
    static final String EXTRA_PROVIDER_CALL_ID = "providerCallId";
    static final String EXTRA_CALLER_NUMBER = "callerNumber";
    static final String EXTRA_NOTIFICATION_ID = "notificationId";

    private static final String RESERVATION_CHANNEL_ID = "catch-call-incoming-v1";
    private static final String NEW_CUSTOMER_CHANNEL_ID = "catch-call-new-customer-v1";
    private static final int REQUEST_CODE_BASE = 47000;

    private OwnerCallNotification() {}

    static void showReservationReady(Context context, String providerCallId, String callerNumber) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureReservationChannel(manager);

        int id = notificationId(providerCallId);
        Intent reservationIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_ADD_RESERVATION)
            .putExtra(EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(EXTRA_CALLER_NUMBER, callerNumber)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent reservationPendingIntent = PendingIntent.getActivity(
            context, id + 1, reservationIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent dismissIntent = new Intent(context, OwnerCallActionReceiver.class)
            .setAction(ACTION_DISMISS)
            .putExtra(EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(EXTRA_NOTIFICATION_ID, id);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            context, id + 2, dismissIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String phoneTail = phoneTail(callerNumber);
        Notification notification = new NotificationCompat.Builder(context, RESERVATION_CHANNEL_ID)
            .setSmallIcon(kr.petmanager.owner.R.drawable.ic_stat_paw)
            .setContentTitle("등록 고객 전화")
            .setContentText(phoneTail.isEmpty() ? "고객 예약을 접수할 수 있어요" : "번호 끝자리 " + phoneTail + " · 예약을 접수할 수 있어요")
            .setContentIntent(reservationPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .addAction(new NotificationCompat.Action.Builder(0, "예약 접수", reservationPendingIntent).build())
            .addAction(new NotificationCompat.Action.Builder(0, "전화만 받기", dismissPendingIntent).build())
            .build();
        NotificationManagerCompat.from(context).notify(id, notification);
    }

    static void showNewCustomer(Context context, String callerNumber) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureNewCustomerChannel(manager);

        int id = notificationId("new-customer:" + callerNumber);
        Intent registerIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_REGISTER_CUSTOMER)
            .putExtra(EXTRA_CALLER_NUMBER, callerNumber)
            .putExtra(EXTRA_NOTIFICATION_ID, id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent registerPendingIntent = PendingIntent.getActivity(
            context, id + 3, registerIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String phoneTail = phoneTail(callerNumber);
        Notification notification = new NotificationCompat.Builder(context, NEW_CUSTOMER_CHANNEL_ID)
            .setSmallIcon(kr.petmanager.owner.R.drawable.ic_stat_paw)
            .setContentTitle("새 번호에서 전화가 왔어요")
            .setContentText(phoneTail.isEmpty() ? "신규 고객으로 등록할 수 있어요" : "번호 끝자리 " + phoneTail + " · 신규 고객으로 등록할 수 있어요")
            .setContentIntent(registerPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .addAction(new NotificationCompat.Action.Builder(0, "신규 고객 등록", registerPendingIntent).build())
            .build();
        NotificationManagerCompat.from(context).notify(id, notification);
    }

    static void cancel(Context context, String providerCallId) {
        NotificationManagerCompat.from(context).cancel(notificationId(providerCallId));
    }

    static void cancel(Context context, int notificationId) {
        NotificationManagerCompat.from(context).cancel(notificationId);
    }

    private static String phoneTail(String callerNumber) {
        return callerNumber == null || callerNumber.length() < 4 ? "" : callerNumber.substring(callerNumber.length() - 4);
    }

    private static void ensureReservationChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(RESERVATION_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(RESERVATION_CHANNEL_ID, "캐치콜 예약 알림", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("등록 고객 통화가 끝나면 예약 접수 버튼을 보여줍니다.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(channel);
    }

    private static void ensureNewCustomerChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(NEW_CUSTOMER_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(NEW_CUSTOMER_CHANNEL_ID, "새 고객 전화", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("등록되지 않은 번호가 전화하면 신규 고객 등록 버튼을 보여줍니다.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private static int notificationId(String value) {
        return REQUEST_CODE_BASE + ((value == null ? 0 : value.hashCode()) & 0x7fff);
    }
}
