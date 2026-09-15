package kr.petmanager.owner;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.MediaStore;
import android.os.Bundle;

import androidx.core.content.FileProvider;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(
    name = "ExternalCamera",
    permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) }
)
public class ExternalCameraPlugin extends Plugin {
    private static final String CACHE_DIRECTORY = "external-camera";
    private static final String FILE_PREFIX = "petmanager-";
    private static final long STALE_OUTPUT_MAX_AGE_MS = 24L * 60L * 60L * 1000L;
    private static final String STATE_PENDING_FILE_NAME = "pendingOutputFileName";
    private static final String CAMERA_PERMISSION_DENIED = "CAMERA_PERMISSION_DENIED";
    private static final String CAMERA_UNAVAILABLE = "CAMERA_UNAVAILABLE";
    private static final String CAMERA_LAUNCH_FAILED = "CAMERA_LAUNCH_FAILED";
    private static final String EXTERNAL_APP_PICKER_CANCELLED = "EXTERNAL_APP_PICKER_CANCELLED";
    private static final String EXTERNAL_APP_PICKER_UNAVAILABLE = "EXTERNAL_APP_PICKER_UNAVAILABLE";
    private static final int OUTPUT_URI_PERMISSION_FLAGS =
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION;
    private Uri pendingOutputUri;
    private File pendingOutputFile;

    @Override
    public void load() {
        clearStaleOutputFiles();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (pendingOutputFile == null) clearStaleOutputFiles();
    }

    @PluginMethod
    public void capture(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback");
            return;
        }
        launchCamera(call);
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        List<ResolveInfo> handlers = queryCameraHandlers();
        JSObject response = new JSObject();
        response.put("availableAppCount", handlers.size());
        response.put("canChoose", handlers.size() > 1);
        response.put("externalAppPickerAvailable", canOpenExternalAppPicker());
        call.resolve(response);
    }

    @PluginMethod
    public void openExternalCameraAppPicker(PluginCall call) {
        Intent pickerIntent = createExternalAppPickerIntent();
        if (pickerIntent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("앱 선택기를 열 수 없습니다. 앨범에서 사진을 선택해 주세요.", EXTERNAL_APP_PICKER_UNAVAILABLE);
            return;
        }
        try {
            startActivityForResult(call, pickerIntent, "externalAppPickerResult");
        } catch (Exception error) {
            call.reject("앱 선택기를 열 수 없습니다. 앨범에서 사진을 선택해 주세요.", EXTERNAL_APP_PICKER_UNAVAILABLE, error);
        }
    }

    @PluginMethod
    public void release(PluginCall call) {
        String cacheFileName = call.getString("cacheFileName");
        if (cacheFileName == null || cacheFileName.contains("/") || cacheFileName.contains("\\") || !cacheFileName.startsWith(FILE_PREFIX)) {
            call.reject("촬영 임시 파일을 확인할 수 없습니다.");
            return;
        }
        File file = new File(new File(getContext().getCacheDir(), CACHE_DIRECTORY), cacheFileName);
        if (file.exists()) file.delete();
        call.resolve();
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            clearPendingOutput();
            call.reject("카메라 권한을 허용해야 촬영할 수 있습니다.", CAMERA_PERMISSION_DENIED);
            return;
        }
        launchCamera(call);
    }

    private void launchCamera(PluginCall call) {
        try {
            List<ResolveInfo> handlers = queryCameraHandlers();
            if (handlers.isEmpty()) {
                clearPendingOutput();
                call.reject("사용할 수 있는 카메라 앱이 없습니다.", CAMERA_UNAVAILABLE);
                return;
            }

            File directory = new File(getContext().getCacheDir(), CACHE_DIRECTORY);
            if (!directory.exists() && !directory.mkdirs()) {
                call.reject("촬영용 임시 폴더를 만들 수 없습니다.");
                return;
            }
            pendingOutputFile = File.createTempFile(FILE_PREFIX, ".jpg", directory);
            pendingOutputUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", pendingOutputFile);

            Intent cameraIntent = createCaptureIntent(pendingOutputUri);
            grantOutputUriToCameraApps(handlers);
            Intent launchIntent = cameraIntent;
            if (call.getBoolean("chooser", false) && handlers.size() > 1) {
                Intent chooserIntent = Intent.createChooser(cameraIntent, "카메라 앱 선택");
                chooserIntent.setClipData(cameraIntent.getClipData());
                chooserIntent.addFlags(OUTPUT_URI_PERMISSION_FLAGS);
                launchIntent = chooserIntent;
            }
            startActivityForResult(call, launchIntent, "externalCameraResult");
        } catch (Exception error) {
            clearPendingOutput();
            call.reject("카메라 앱을 열 수 없습니다.", CAMERA_LAUNCH_FAILED, error);
        }
    }

    @Override
    protected Bundle saveInstanceState() {
        Bundle state = super.saveInstanceState();
        if (state == null) state = new Bundle();
        if (pendingOutputFile != null) state.putString(STATE_PENDING_FILE_NAME, pendingOutputFile.getName());
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        String fileName = state == null ? null : state.getString(STATE_PENDING_FILE_NAME);
        if (fileName == null || fileName.contains("/") || fileName.contains("\\") || !fileName.startsWith(FILE_PREFIX)) return;
        File restoredFile = new File(new File(getContext().getCacheDir(), CACHE_DIRECTORY), fileName);
        if (!restoredFile.exists()) return;
        pendingOutputFile = restoredFile;
        pendingOutputUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", restoredFile);
    }

    @ActivityCallback
    private void externalCameraResult(PluginCall call, ActivityResult result) {
        boolean retainOutputForBridge = false;
        try {
            if (result.getResultCode() != Activity.RESULT_OK) {
                call.reject("CAMERA_CANCELLED");
                return;
            }
            if (pendingOutputFile == null) {
                call.reject("촬영한 사진을 찾을 수 없습니다.");
                return;
            }
            Uri resultUri = pendingOutputUri;
            if (pendingOutputFile.length() == 0 && result.getData() != null && result.getData().getData() != null) {
                Uri returnedUri = result.getData().getData();
                copyResultToPendingFile(returnedUri, pendingOutputFile);
                resultUri = returnedUri;
            }
            if (pendingOutputFile.length() == 0) {
                call.reject("촬영한 사진을 읽을 수 없습니다.");
                return;
            }
            String mimeType = resultUri == null ? null : getContext().getContentResolver().getType(resultUri);
            JSObject response = new JSObject();
            response.put("path", pendingOutputFile.getAbsolutePath());
            response.put("cacheFileName", pendingOutputFile.getName());
            response.put("mimeType", mimeType == null ? "image/jpeg" : mimeType);
            response.put("fileName", "petmanager-photo-" + System.currentTimeMillis() + ".jpg");
            call.resolve(response);
            retainOutputForBridge = true;
        } catch (Exception error) {
            call.reject("촬영한 사진을 불러올 수 없습니다.", error);
        } finally {
            if (retainOutputForBridge) detachPendingOutput();
            else clearPendingOutput();
        }
    }

    @ActivityCallback
    private void externalAppPickerResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject(EXTERNAL_APP_PICKER_CANCELLED);
            return;
        }
        Intent selectedIntent = result.getData();
        ComponentName selectedComponent = selectedIntent == null ? null : selectedIntent.getComponent();
        if (selectedComponent == null) {
            call.reject("선택한 앱을 열 수 없습니다. 앨범에서 사진을 선택해 주세요.", EXTERNAL_APP_PICKER_UNAVAILABLE);
            return;
        }
        try {
            Intent launchIntent = Intent.makeMainActivity(selectedComponent);
            getActivity().startActivity(launchIntent);
            call.resolve();
        } catch (Exception error) {
            call.reject("선택한 앱을 열 수 없습니다. 앨범에서 사진을 선택해 주세요.", EXTERNAL_APP_PICKER_UNAVAILABLE, error);
        }
    }

    private void copyResultToPendingFile(Uri uri, File destination) throws Exception {
        InputStream stream = getContext().getContentResolver().openInputStream(uri);
        if (stream == null) return;
        byte[] buffer = new byte[8192];
        try (InputStream input = stream; FileOutputStream output = new FileOutputStream(destination, false)) {
            int count;
            try {
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                output.flush();
            } finally {
                Arrays.fill(buffer, (byte) 0);
            }
        }
    }

    private List<ResolveInfo> queryCameraHandlers() {
        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        return getContext().getPackageManager().queryIntentActivities(cameraIntent, PackageManager.MATCH_DEFAULT_ONLY);
    }

    private Intent createCaptureIntent(Uri outputUri) {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, outputUri);
        intent.addFlags(OUTPUT_URI_PERMISSION_FLAGS);
        intent.setClipData(ClipData.newRawUri("petmanager-photo", outputUri));
        return intent;
    }

    private Intent createExternalAppPickerIntent() {
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        Intent pickerIntent = new Intent(Intent.ACTION_PICK_ACTIVITY);
        pickerIntent.putExtra(Intent.EXTRA_INTENT, launcherIntent);
        pickerIntent.putExtra(Intent.EXTRA_TITLE, "다른 촬영 앱 선택");
        return pickerIntent;
    }

    private boolean canOpenExternalAppPicker() {
        return createExternalAppPickerIntent().resolveActivity(getContext().getPackageManager()) != null;
    }

    private void detachPendingOutput() {
        if (pendingOutputUri != null) {
            getContext().revokeUriPermission(
                pendingOutputUri,
                OUTPUT_URI_PERMISSION_FLAGS
            );
        }
        pendingOutputFile = null;
        pendingOutputUri = null;
    }

    private void clearPendingOutput() {
        if (pendingOutputUri != null) {
            getContext().revokeUriPermission(
                pendingOutputUri,
                OUTPUT_URI_PERMISSION_FLAGS
            );
        }
        if (pendingOutputFile != null && pendingOutputFile.exists()) pendingOutputFile.delete();
        pendingOutputFile = null;
        pendingOutputUri = null;
    }

    private void grantOutputUriToCameraApps(List<ResolveInfo> handlers) {
        if (pendingOutputUri == null) return;
        for (ResolveInfo handler : handlers) {
            if (handler.activityInfo == null || handler.activityInfo.packageName == null) continue;
            grantOutputUriToPackage(handler.activityInfo.packageName);
        }
    }

    private void grantOutputUriToPackage(String packageName) {
        if (pendingOutputUri == null) return;
        getContext().grantUriPermission(packageName, pendingOutputUri, OUTPUT_URI_PERMISSION_FLAGS);
    }

    private void clearStaleOutputFiles() {
        File directory = new File(getContext().getCacheDir(), CACHE_DIRECTORY);
        File[] files = directory.listFiles((dir, name) -> name.startsWith(FILE_PREFIX));
        if (files == null) return;
        long staleBefore = System.currentTimeMillis() - STALE_OUTPUT_MAX_AGE_MS;
        for (File file : files) {
            if (!file.equals(pendingOutputFile) && file.lastModified() < staleBefore) file.delete();
        }
    }
}
