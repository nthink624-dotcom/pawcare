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
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class OwnerCallScreeningStore {
    private static final String PREFS = "petmanager_call_screening";
    private static final String KEY_ALIAS = "petmanager_call_screening_v1";
    private static final String CONFIG_KEY = "config";
    private static final String EVENTS_KEY = "events";
    private static final int MAX_PENDING_EVENTS = 50;

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

    static synchronized void clearActiveCall(Context context) {
        JSONObject config = readObject(context, CONFIG_KEY);
        config.remove("activeProviderCallId");
        config.remove("activeCallerNumber");
        config.remove("activeAnswered");
        writeObject(context, CONFIG_KEY, config);
    }

    static synchronized JSONObject getConfig(Context context) {
        return readObject(context, CONFIG_KEY);
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
            cipher.init(Cipher.ENCRYPT_MODE, getKey(), new GCMParameterSpec(128, randomNonce()));
            byte[] nonce = cipher.getIV();
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

    private static byte[] randomNonce() {
        byte[] nonce = new byte[12];
        new SecureRandom().nextBytes(nonce);
        return nonce;
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
