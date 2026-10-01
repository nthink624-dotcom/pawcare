package kr.petmanager.owner;

import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class OwnerCallScreeningTransport {
    private OwnerCallScreeningTransport() {}

    static void sendOrQueue(Context context, JSONObject event) {
        if (!OwnerCallScreeningStore.isEnabled(context)) return;
        JSONObject config = OwnerCallScreeningStore.getConfig(context);
        String apiOrigin = config.optString("apiOrigin", "").trim();
        String accessToken = config.optString("accessToken", "").trim();
        String shopId = event.optString("shopId", "").trim();
        String integrationId = event.optString("integrationId", "").trim();
        if (apiOrigin.isEmpty() || accessToken.isEmpty() || shopId.isEmpty() || integrationId.isEmpty()) {
            OwnerCallScreeningStore.enqueue(context, event);
            return;
        }

        HttpURLConnection connection = null;
        try {
            URL url = new URL(apiOrigin + "/api/owner/call-events/android/events");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            connection.setRequestProperty("Content-Type", "application/json");
            byte[] body = event.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                OwnerCallScreeningStore.enqueue(context, event);
            }
        } catch (Exception ignored) {
            OwnerCallScreeningStore.enqueue(context, event);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
