package kr.petmanager.owner;

import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class OwnerCallScreeningTransport {
    private OwnerCallScreeningTransport() {}

    static void queueAndSendChoice(Context context, String providerCallId, String actionName) {
        org.json.JSONArray queued = OwnerCallScreeningStore.enqueueChoice(context, providerCallId, actionName);
        JSONObject choice = null;
        for (int index = 0; index < queued.length(); index += 1) {
            JSONObject candidate = queued.optJSONObject(index);
            if (candidate != null && providerCallId != null && providerCallId.equals(candidate.optString("providerCallId", ""))) {
                choice = candidate;
                break;
            }
        }
        if (choice == null) return;
        JSONObject pendingChoice = choice;
        new Thread(() -> sendChoiceIfPossible(context, pendingChoice), "petmanager-call-choice-upload").start();
    }

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

    static boolean sendChoiceIfPossible(Context context, JSONObject choice) {
        JSONObject config = OwnerCallScreeningStore.getConfig(context);
        String apiOrigin = config.optString("apiOrigin", "").trim();
        String accessToken = config.optString("accessToken", "").trim();
        if (apiOrigin.isEmpty() || accessToken.isEmpty()) return false;

        HttpURLConnection connection = null;
        try {
            URL url = new URL(apiOrigin + "/api/owner/call-events/android/choices");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(1500);
            connection.setReadTimeout(1500);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            connection.setRequestProperty("Content-Type", "application/json");
            byte[] body = choice.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
            if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                OwnerCallScreeningStore.acknowledgeChoices(context,
                    new org.json.JSONArray().put(choice.optString("providerCallId", "")));
                return true;
            }
        } catch (Exception ignored) {
            // Keep the encrypted choice queued for the next authenticated app launch.
        } finally {
            if (connection != null) connection.disconnect();
        }
        return false;
    }
}
