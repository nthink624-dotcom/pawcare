package kr.petmanager.owner;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "OwnerSpeechRecognition",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class OwnerSpeechRecognitionPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private boolean listening = false;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startListeningOnMainThread(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("PERMISSION_DENIED");
            return;
        }
        startListeningOnMainThread(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        getActivity().runOnUiThread(() -> {
            stopListening();
            finish();
            destroyRecognizer();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        finish();
        destroyRecognizer();
        super.handleOnDestroy();
    }

    private void startListeningOnMainThread(PluginCall call) {
        if (getActivity() == null) {
            call.reject("UNAVAILABLE");
            return;
        }
        getActivity().runOnUiThread(() -> startListening(call));
    }

    private void startListening(PluginCall call) {
        if (getActivity() == null || !SpeechRecognizer.isRecognitionAvailable(getActivity())) {
            call.reject("UNAVAILABLE");
            return;
        }
        destroyRecognizer();
        recognizer = SpeechRecognizer.createSpeechRecognizer(getActivity());
        recognizer.setRecognitionListener(this);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR")
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        listening = true;
        recognizer.startListening(intent);
        call.resolve();
    }

    private void stopListening() {
        if (recognizer != null && listening) recognizer.stopListening();
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
        }
        listening = false;
    }

    private void emitError(String code) {
        JSObject data = new JSObject();
        data.put("code", code);
        notifyListeners("error", data);
    }

    private void finish() {
        if (!listening) return;
        listening = false;
        notifyListeners("end", new JSObject());
    }

    private String errorCode(int error) {
        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) return "EMPTY";
        if (error == SpeechRecognizer.ERROR_CLIENT) return "CANCELLED";
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) return "PERMISSION_DENIED";
        return "FAILED";
    }

    @Override public void onReadyForSpeech(Bundle params) { }
    @Override public void onBeginningOfSpeech() { }
    @Override public void onRmsChanged(float rmsdB) { }
    @Override public void onBufferReceived(byte[] buffer) { }
    @Override public void onEndOfSpeech() { }
    @Override public void onPartialResults(Bundle partialResults) { }
    @Override public void onEvent(int eventType, Bundle params) { }

    @Override
    public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        String transcript = matches == null || matches.isEmpty() ? "" : matches.get(0).trim();
        if (transcript.isEmpty()) {
            emitError("EMPTY");
            finish();
            destroyRecognizer();
            return;
        }
        JSObject data = new JSObject();
        data.put("transcript", transcript);
        notifyListeners("result", data);
        finish();
        destroyRecognizer();
    }

    @Override
    public void onError(int error) {
        emitError(errorCode(error));
        finish();
        destroyRecognizer();
    }
}
