package kr.petmanager.owner;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.SimpleDateFormat;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.Date;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class OwnerCallScreeningStore {
    private static final String PREFS = "petmanager_call_screening";
    private static final String KEY_ALIAS = "petmanager_call_screening_v1";
    private static final String CONFIG_KEY = "config";
    private static final String EVENTS_KEY = "events";
    private static final String CHOICES_KEY = "choices";
    private static final int MAX_PENDING_EVENTS = 50;
    private static final int MAX_PENDING_CHOICES = 50;

    private OwnerCallScreeningStore() {}

    static synchronized String getOrCreateDeviceId(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        String existing = config.optString("deviceId", "").trim();
        if (!existing.isEmpty()) return existing;
        String deviceId = UUID.randomUUID().toString().replace("-", "");
        try {
            config.put("deviceId", deviceId);
        } catch (Exception ignored) {
            return deviceId;
        }
        writeObject(context, CONFIG_KEY, config);
        return deviceId;
    }

    static synchronized void configure(Context context, JSONObject values) {
        JSONObject config = readObject(context, CONFIG_KEY);
        Iterator<String> keys = values.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            try {
                config.put(key, values.opt(key));
            } catch (Exception ignored) {
                // Ignore a single malformed optional configuration value.
            }
        }
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized boolean isEnabled(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        if (config.has("callCaptureEnabled")) return config.optBoolean("callCaptureEnabled", false);
        return !config.optString("shopId", "").trim().isEmpty()
            && !config.optString("integrationId", "").trim().isEmpty();
    }

    static synchronized void setEnabled(Context context, boolean enabled) {
        JSONObject config = readObject(context, CONFIG_KEY);
        try {
            config.put("callCaptureEnabled", enabled);
        } catch (Exception ignored) {
            return;
        }
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized void clearActiveCall(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        config.remove("activeProviderCallId");
        config.remove("activeCallerNumber");
        config.remove("activeAnswered");
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized String getActiveProviderCallId(Context context) {
        return readObject(context, CONFIG_KEY).optString("activeProviderCallId", "").trim();
    }

    static synchronized JSONObject getConfig(Context context) {
        return readObject(context, CONFIG_KEY);
    }

    static synchronized void setPendingReservationAction(Context context, String providerCallId, String callerNumber) {
        JSONObject config = readObject(context, CONFIG_KEY);
        try {
            config.put("pendingReservationProviderCallId", providerCallId == null ? "" : providerCallId);
            config.put("pendingReservationCallerNumber", callerNumber == null ? "" : callerNumber);
        } catch (Exception ignored) {
            return;
        }
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized JSONObject getPendingReservationAction(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        JSONObject action = new JSONObject();
        try {
            String providerCallId = config.optString("pendingReservationProviderCallId", "").trim();
            String callerNumber = config.optString("pendingReservationCallerNumber", "").trim();
            action.put("pending", !providerCallId.isEmpty() || !callerNumber.isEmpty());
            action.put("providerCallId", providerCallId);
            action.put("callerNumber", callerNumber);
        } catch (Exception ignored) {
            return new JSONObject();
        }
        return action;
    }

    static synchronized void clearPendingReservationAction(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        config.remove("pendingReservationProviderCallId");
        config.remove("pendingReservationCallerNumber");
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized void setPendingIncomingCallChoice(Context context, String providerCallId, String callerNumber) {
        setPendingIncomingCallChoice(context, providerCallId, callerNumber, "choose");
    }

    static synchronized void setPendingIncomingCallChoice(Context context, String providerCallId, String callerNumber, String action) {
        JSONObject config = readObject(context, CONFIG_KEY);
        try {
            config.put("pendingIncomingProviderCallId", providerCallId == null ? "" : providerCallId);
            config.put("pendingIncomingCallerNumber", callerNumber == null ? "" : callerNumber);
            config.put("pendingIncomingAction", "new-customer".equals(action) ? "new-customer" : "choose");
        } catch (Exception ignored) {
            return;
        }
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized JSONObject getPendingIncomingCallChoice(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        JSONObject action = new JSONObject();
        try {
            String providerCallId = config.optString("pendingIncomingProviderCallId", "").trim();
            String callerNumber = config.optString("pendingIncomingCallerNumber", "").trim();
            action.put("pending", !providerCallId.isEmpty() || !callerNumber.isEmpty());
            action.put("providerCallId", providerCallId);
            action.put("callerNumber", callerNumber);
            action.put("action", config.optString("pendingIncomingAction", "choose"));
        } catch (Exception ignored) {
            return new JSONObject();
        }
        return action;
    }

    static synchronized void clearPendingIncomingCallChoice(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        config.remove("pendingIncomingProviderCallId");
        config.remove("pendingIncomingCallerNumber");
        config.remove("pendingIncomingAction");
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized void setAllowedPhoneNumbers(Context context, JSONArray phoneNumbers) {
        JSONObject config = readObject(context, CONFIG_KEY);
        try {
            config.put("allowedPhoneNumbers", phoneNumbers == null ? new JSONArray() : phoneNumbers);
        } catch (Exception ignored) {
            return;
        }
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized boolean isAllowedCallerNumber(Context context, String callerNumber) {
        String normalized = normalizePhoneNumber(callerNumber);
        if (normalized.isEmpty()) return false;
        JSONArray allowed = readObject(context, CONFIG_KEY).optJSONArray("allowedPhoneNumbers");
        if (allowed == null) return false;
        for (int index = 0; index < allowed.length(); index += 1) {
            if (normalized.equals(normalizePhoneNumber(allowed.optString(index, "")))) return true;
        }
        return false;
    }

    /**
     * Creates the single incoming event for a call and records its active state.
     * Both the platform screening service and PHONE_STATE fallback use this
     * method so a Samsung device cannot produce duplicate incoming events.
     */
    static synchronized JSONObject createIncomingEvent(Context context, String callerNumber) {
        if (!isEnabled(context)) return null;
        if (!isAllowedCallerNumber(context, callerNumber)) return null;

        JSONObject config = readObject(context, CONFIG_KEY);
        if (!config.optString("activeProviderCallId", "").trim().isEmpty()) return null;

        String shopId = config.optString("shopId", "").trim();
        String integrationId = config.optString("integrationId", "").trim();
        if (shopId.isEmpty() || integrationId.isEmpty()) return null;

        String providerCallId = UUID.randomUUID().toString();
        try {
            JSONObject event = new JSONObject();
            event.put("shopId", shopId);
            event.put("integrationId", integrationId);
            event.put("providerEventId", providerCallId + ":incoming");
            event.put("eventType", "incoming");
            event.put("direction", "inbound");
            event.put("callerNumber", callerNumber);
            event.put("occurredAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(new Date()));
            JSONObject metadata = new JSONObject();
            metadata.put("providerCallId", providerCallId);
            metadata.put("deviceId", getOrCreateDeviceId(context));
            event.put("metadata", metadata);

            config.put("activeProviderCallId", providerCallId);
            config.put("activeCallerNumber", callerNumber);
            config.put("activeAnswered", false);
            writeObject(context, CONFIG_KEY, config);
            return event;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String normalizePhoneNumber(String value) {
        if (value == null) return "";
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.startsWith("82") && digits.length() >= 10) return "0" + digits.substring(2);
        return digits;
    }

    static synchronized void enqueue(Context context, JSONObject event) {
        JSONArray events = readArray(context, EVENTS_KEY);
        JSONArray next = new JSONArray();
        int start = Math.max(0, events.length() - MAX_PENDING_EVENTS + 1);
        for (int index = start; index < events.length(); index += 1) next.put(events.optJSONObject(index));
        next.put(event);
        writeArray(context, EVENTS_KEY, next);
    }

    static synchronized JSONArray getPending(Context context) {
        return readArray(context, EVENTS_KEY);
    }

    static synchronized void acknowledge(Context context, JSONArray eventIds) {
        Set<String> acknowledged = new HashSet<>();
        for (int index = 0; index < eventIds.length(); index += 1) {
            String id = eventIds.optString(index, "").trim();
            if (!id.isEmpty()) acknowledged.add(id);
        }
        JSONArray existing = readArray(context, EVENTS_KEY);
        JSONArray remaining = new JSONArray();
        for (int index = 0; index < existing.length(); index += 1) {
            JSONObject event = existing.optJSONObject(index);
            if (event != null && !acknowledged.contains(event.optString("providerEventId", ""))) remaining.put(event);
        }
        writeArray(context, EVENTS_KEY, remaining);
    }

    static synchronized JSONArray enqueueChoice(Context context, String providerCallId, String actionName) {
        String callId = providerCallId == null ? "" : providerCallId.trim();
        if (callId.isEmpty() || !("reservation_selected".equals(actionName) || "phone_only_selected".equals(actionName))) return new JSONArray();
        String shopId = readObject(context, CONFIG_KEY).optString("shopId", "").trim();
        if (shopId.isEmpty()) return new JSONArray();

        JSONArray choices = readArray(context, CHOICES_KEY);
        for (int index = 0; index < choices.length(); index += 1) {
            JSONObject choice = choices.optJSONObject(index);
            if (choice != null && callId.equals(choice.optString("providerCallId", ""))) return choices;
        }

        try {
            JSONObject choice = new JSONObject();
            choice.put("shopId", shopId);
            choice.put("providerCallId", callId);
            choice.put("action", actionName);
            choice.put("selectedAt", System.currentTimeMillis());
            JSONArray next = new JSONArray();
            int start = Math.max(0, choices.length() - MAX_PENDING_CHOICES + 1);
            for (int index = start; index < choices.length(); index += 1) next.put(choices.optJSONObject(index));
            next.put(choice);
            writeArray(context, CHOICES_KEY, next);
            return next;
        } catch (Exception ignored) {
            return choices;
        }
    }

    static synchronized JSONArray getPendingChoices(Context context) {
        return readArray(context, CHOICES_KEY);
    }

    static synchronized void acknowledgeChoices(Context context, JSONArray providerCallIds) {
        Set<String> acknowledged = new HashSet<>();
        for (int index = 0; index < providerCallIds.length(); index += 1) {
            String id = providerCallIds.optString(index, "").trim();
            if (!id.isEmpty()) acknowledged.add(id);
        }
        JSONArray existing = readArray(context, CHOICES_KEY);
        JSONArray remaining = new JSONArray();
        for (int index = 0; index < existing.length(); index += 1) {
            JSONObject choice = existing.optJSONObject(index);
            if (choice != null && !acknowledged.contains(choice.optString("providerCallId", ""))) remaining.put(choice);
        }
        writeArray(context, CHOICES_KEY, remaining);
    }

    static synchronized void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }

    private static JSONObject readObject(Context context, String key) {
        String encrypted = preferences(context).getString(key, "");
        if (encrypted.isEmpty()) return new JSONObject();
        try {
            return new JSONObject(decrypt(encrypted));
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private static JSONArray readArray(Context context, String key) {
        String encrypted = preferences(context).getString(key, "");
        if (encrypted.isEmpty()) return new JSONArray();
        try {
            return new JSONArray(decrypt(encrypted));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static void writeObject(Context context, String key, JSONObject value) {
        preferences(context).edit().putString(key, encrypt(value.toString())).apply();
    }

    private static void writeArray(Context context, String key, JSONArray value) {
        preferences(context).edit().putString(key, encrypt(value.toString())).apply();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String encrypt(String plaintext) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            // Let AndroidKeyStore generate the GCM IV. Android 16 rejects
            // caller-provided IVs for keys whose purpose includes encryption.
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            byte[] nonce = cipher.getIV();
            if (nonce == null || nonce.length == 0) {
                throw new IllegalStateException("call screening storage returned no encryption IV");
            }
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[nonce.length + ciphertext.length];
            System.arraycopy(nonce, 0, combined, 0, nonce.length);
            System.arraycopy(ciphertext, 0, combined, nonce.length, ciphertext.length);
            return Base64.encodeToString(combined, Base64.NO_WRAP);
        } catch (Exception error) {
            throw new IllegalStateException("call screening storage unavailable", error);
        }
    }

    private static String decrypt(String encoded) throws Exception {
        byte[] combined = Base64.decode(encoded, Base64.NO_WRAP);
        byte[] nonce = new byte[12];
        byte[] ciphertext = new byte[combined.length - nonce.length];
        System.arraycopy(combined, 0, nonce, 0, nonce.length);
        System.arraycopy(combined, nonce.length, ciphertext, 0, ciphertext.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, nonce));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private static SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
             .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
             .build());
            generator.generateKey();
        }
        return ((SecretKey) keyStore.getKey(KEY_ALIAS, null));
    }
}
