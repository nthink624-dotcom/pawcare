package kr.petmanager.owner;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OwnerIncomingCallActivity extends Activity {
    static final String ACTION_SHOW_CALL = "kr.petmanager.owner.action.SHOW_CALL";
    private static volatile OwnerIncomingCallActivity visibleActivity;
    private TextView numberView;
    private TextView stateView;
    private Button answerButton;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (android.os.Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        visibleActivity = this;
        render();
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); render(); }
    @Override protected void onResume() { super.onResume(); visibleActivity = this; render(); }
    @Override protected void onDestroy() { if (visibleActivity == this) visibleActivity = null; super.onDestroy(); }

    static void refreshVisibleScreen() {
        OwnerIncomingCallActivity activity = visibleActivity;
        if (activity != null) activity.runOnUiThread(activity::render);
    }

    private void render() {
        boolean ringing = OwnerInCallService.isRinging();
        if (!ringing && OwnerInCallService.getActiveCall() == null) { finish(); return; }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(28), dp(32), dp(28), dp(28));
        root.setBackgroundColor(Color.rgb(241, 243, 247));

        TextView brand = text("펫매니저", 18, Color.rgb(100, 116, 139), Typeface.NORMAL);
        LinearLayout.LayoutParams brandParams = params(-2, -2);
        brandParams.topMargin = dp(32);
        root.addView(brand, brandParams);

        stateView = text(ringing ? "전화가 오고 있어요" : "통화 중", 24, Color.rgb(16, 26, 49), Typeface.BOLD);
        LinearLayout.LayoutParams stateParams = params(-1, -2);
        stateParams.topMargin = dp(44);
        root.addView(stateView, stateParams);

        numberView = text(OwnerInCallService.getCallerNumber(), 22, Color.rgb(21, 33, 59), Typeface.NORMAL);
        LinearLayout.LayoutParams numberParams = params(-1, -2);
        numberParams.topMargin = dp(18);
        root.addView(numberView, numberParams);

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1));

        if (ringing) {
            Button reservation = button("예약 추가", Color.WHITE, Color.rgb(16, 26, 49));
            reservation.setOnClickListener(view -> openReservation());
            root.addView(reservation, params(-1, dp(60)));

            Button end = button("통화 끊기", Color.rgb(154, 94, 78), Color.WHITE);
            end.setOnClickListener(view -> OwnerInCallService.disconnect());
            LinearLayout.LayoutParams endParams = params(-1, dp(60));
            endParams.topMargin = dp(12);
            root.addView(end, endParams);

            answerButton = button("통화 받기", Color.rgb(31, 107, 91), Color.WHITE);
            answerButton.setOnClickListener(view -> OwnerInCallService.answer());
            LinearLayout.LayoutParams answerParams = params(-1, dp(60));
            answerParams.topMargin = dp(12);
            root.addView(answerButton, answerParams);
        } else {
            Button end = button("통화 종료", Color.rgb(154, 94, 78), Color.WHITE);
            end.setOnClickListener(view -> OwnerInCallService.disconnect());
            root.addView(end, params(-1, dp(60)));
        }
        setContentView(root);
    }

    private void openReservation() {
        String providerCallId = OwnerInCallService.getActiveProviderCallId(this);
        Intent intent = new Intent(this, MainActivity.class)
            .setAction(OwnerCallNotification.ACTION_ADD_RESERVATION)
            .putExtra(OwnerCallNotification.EXTRA_PROVIDER_CALL_ID, providerCallId)
            .putExtra(OwnerCallNotification.EXTRA_CALLER_NUMBER, OwnerInCallService.getCallerNumber())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }

    private TextView text(String value, int sp, int color, int weight) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sp);
        text.setTextColor(color);
        text.setTypeface(Typeface.DEFAULT, weight);
        text.setGravity(Gravity.CENTER);
        return text;
    }

    private Button button(String value, int background, int foreground) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextSize(16);
        button.setTextColor(foreground);
        button.setAllCaps(false);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(background));
        return button;
    }

    private LinearLayout.LayoutParams params(int width, int height) { return new LinearLayout.LayoutParams(width, height); }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }
}
