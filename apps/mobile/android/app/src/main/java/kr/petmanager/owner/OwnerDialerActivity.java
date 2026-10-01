package kr.petmanager.owner;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.TelecomManager;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;

public class OwnerDialerActivity extends Activity {
    private static final int CALL_PERMISSION_REQUEST = 7501;
    private EditText number;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        number = new EditText(this);
        number.setSingleLine(true);
        number.setTextSize(24);
        number.setHint("전화번호");
        Uri incoming = getIntent() == null ? null : getIntent().getData();
        if (incoming != null) number.setText(incoming.getSchemeSpecificPart());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(number, new LinearLayout.LayoutParams(-1, dp(64)));
        GridLayout keypad = new GridLayout(this);
        keypad.setColumnCount(3);
        String[] keys = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"};
        for (String key : keys) {
            Button digit = new Button(this);
            digit.setText(key);
            digit.setTextSize(22);
            digit.setAllCaps(false);
            GridLayout.LayoutParams cell = new GridLayout.LayoutParams();
            cell.width = 0;
            cell.height = dp(64);
            cell.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            keypad.addView(digit, cell);
            digit.setOnClickListener(view -> number.append(key));
        }
        root.addView(keypad, new LinearLayout.LayoutParams(-1, -2));
        Button dial = new Button(this);
        dial.setText("전화 걸기");
        dial.setTextSize(16);
        dial.setAllCaps(false);
        root.addView(dial, new LinearLayout.LayoutParams(-1, dp(56)));
        dial.setOnClickListener(view -> placeCall());
        setContentView(root);
    }

    private void placeCall() {
        String value = number.getText().toString().trim();
        if (value.isEmpty()) { number.setError("전화번호를 입력해 주세요."); return; }
        if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.CALL_PHONE }, CALL_PERMISSION_REQUEST);
            return;
        }
        placeCallTo(value);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CALL_PERMISSION_REQUEST && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            placeCallTo(number.getText().toString().trim());
        }
    }

    private void placeCallTo(String value) {
        TelecomManager telecom = getSystemService(TelecomManager.class);
        if (telecom == null) { number.setError("전화 기능을 사용할 수 없습니다."); return; }
        try {
            telecom.placeCall(Uri.fromParts("tel", value, null), new Bundle());
            finish();
        } catch (SecurityException error) {
            number.setError("전화 권한을 확인해 주세요.");
        }
    }

    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }
}
