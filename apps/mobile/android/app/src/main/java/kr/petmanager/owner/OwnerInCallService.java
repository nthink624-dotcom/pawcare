package kr.petmanager.owner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.InCallService;

import androidx.core.app.NotificationCompat;

import java.util.concurrent.CopyOnWriteArraySet;

public class OwnerInCallService extends InCallService {
    private static final String CHANNEL_ID = "petmanager-incoming-calls-v2";
    private static final int NOTIFICATION_ID = 48001;
    private static volatile OwnerInCallService instance;
    private static volatile Call activeCall;
    private static final CopyOnWriteArraySet<Runnable> listeners = new CopyOnWriteArraySet<>();

    private final Call.Callback callback = new Call.Callback() {
        @Override public void onStateChanged(Call call, int state) {
            if (state != Call.STATE_DISCONNECTED) showCallUi(call);
            publishState();
            if (state == Call.STATE_DISCONNECTED) {
                dismissCallUi();
                if (activeCall == call) activeCall = null;
                publishState();
            }
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override public void onCallAdded(Call call) {
        super.onCallAdded(call);
        activeCall = call;
        call.registerCallback(callback);
        if (call.getState() == Call.STATE_RINGING && call.getDetails() != null && call.getDetails().getHandle() != null) {
            String callerNumber = call.getDetails().getHandle().getSchemeSpecificPart();
            if (callerNumber != null && !callerNumber.trim().isEmpty()) {
                OwnerCallScreeningService.handleIncoming(this, callerNumber);
            }
        }
        showCallUi(call);
        publishState();
    }

    @Override public void onCallRemoved(Call call) {
        call.unregisterCallback(callback);
        if (activeCall == call) activeCall = null;
        super.onCallRemoved(call);
        dismissCallUi();
        publishState();
    }

    static Call getActiveCall() { return activeCall; }
    static String getActiveProviderCallId(Context context) {
        return OwnerCallScreeningStore.getActiveProviderCallId(context);
    }
    static void addStateListener(Runnable listener) { listeners.add(listener); }
    static void removeStateListener(Runnable listener) { listeners.remove(listener); }

    static boolean answer() {
        Call call = activeCall;
        if (call == null || call.getState() != Call.STATE_RINGING) return false;
        call.answer(call.getDetails().getVideoState());
        return true;
    }

    static boolean disconnect() {
        Call call = activeCall;
        if (call == null) return false;
        call.disconnect();
        return true;
    }

    static boolean isDefaultDialer(Context context) {
        if (Build.VERSION.SDK_INT < 29) return false;
        RoleManager roles = context.getSystemService(RoleManager.class);
        return roles != null && roles.isRoleHeld(RoleManager.ROLE_DIALER);
    }

    static String getCallerNumber() {
        Call call = activeCall;
        if (call == null || call.getDetails() == null || call.getDetails().getHandle() == null) return "알 수 없는 번호";
        String number = call.getDetails().getHandle().getSchemeSpecificPart();
        return number == null || number.trim().isEmpty() ? "알 수 없는 번호" : number;
    }

    static boolean isRinging() {
        Call call = activeCall;
        return call != null && call.getState() == Call.STATE_RINGING;
    }

    private void showCallUi(Call call) {
        ensureChannel();
        boolean ringing = call.getState() == Call.STATE_RINGING;
        Intent screen = new Intent(this, OwnerIncomingCallActivity.class)
            .setAction(OwnerIncomingCallActivity.ACTION_SHOW_CALL)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent fullScreenIntent = PendingIntent.getActivity(this, NOTIFICATION_ID, screen,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_paw)
            .setContentTitle(ringing ? "수신 전화" : "통화 중")
            .setContentText(getCallerNumber())
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(ringing ? fullScreenIntent : null, ringing);
        if (ringing) {
            String callerNumber = getCallerNumber();
            String providerCallId = getActiveProviderCallId(this);
            Intent reservation = new Intent(this, MainActivity.class)
                .setAction(OwnerCallNotification.ACTION_ADD_RESERVATION)
                .putExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID, providerCallId)
                .putExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER, callerNumber)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent reservationAction = PendingIntent.getActivity(this, NOTIFICATION_ID + 1, reservation,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.addAction(new NotificationCompat.Action.Builder(0, "예약 추가", reservationAction).build());
            builder.addAction(callAction(OwnerCallNotification.ACTION_END_CALL, "통화 끊기", NOTIFICATION_ID + 2, providerCallId, callerNumber));
            builder.addAction(callAction(OwnerCallNotification.ACTION_ANSWER_CALL, "통화 받기", NOTIFICATION_ID + 3, providerCallId, callerNumber));
        }
        Notification notification = builder.build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification);
    }

    private NotificationCompat.Action callAction(String action, String title, int requestCode, String providerCallId, String callerNumber) {
        Intent intent = new Intent(this, OwnerCallActionReceiver.class)
            .setAction(action)
            .putExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER, callerNumber)
            .putExtra(OwnerCallActionReceiver.EXTRA_NOTIFICATION_ID, NOTIFICATION_ID);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Action.Builder(0, title, pendingIntent).build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "전화", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("수신 통화 화면과 통화 상태를 표시합니다.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        channel.setSound(ringtone, new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        manager.createNotificationChannel(channel);
    }

    private void dismissCallUi() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
    }

    private static void publishState() {
        for (Runnable listener : listeners) listener.run();
        OwnerIncomingCallActivity.refreshVisibleScreen();
    }
}
