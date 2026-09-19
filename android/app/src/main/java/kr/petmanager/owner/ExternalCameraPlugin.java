package kr.petmanager.owner;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;

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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(
    name = "ExternalCamera",
    permissions = { @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }) }
)
public class ExternalCameraPlugin extends Plugin {
    private static final String CACHE_DIRECTORY = "external-camera";
    private static final String FILE_PREFIX = "petmanager-";
    private static final String CAMERA_PERMISSION_ALIAS = "camera";
    private static final String CAMERA_PERMISSION_DENIED = "CAMERA_PERMISSION_DENIED";
    private static final String CAMERA_UNAVAILABLE = "CAMERA_UNAVAILABLE";
    private static final String CAMERA_LAUNCH_FAILED = "CAMERA_LAUNCH_FAILED";
    private Uri pendingOutputUri;
    private File pendingOutputFile;

    private static final class WipingByteArrayOutputStream extends ByteArrayOutputStream {
        void wipe() {
            Arrays.fill(buf, (byte) 0);
            reset();
        }
    }

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
    public void getCapabilities(PluginCall call) {
        List<ResolveInfo> handlers = getCameraHandlers(new Intent(MediaStore.ACTION_IMAGE_CAPTURE));
        JSObject response = new JSObject();
        response.put("available", !handlers.isEmpty());
        response.put("handlerCount", handlers.size());
        call.resolve(response);
    }

    @PluginMethod
    public void capture(PluginCall call) {
        if (getPermissionState(CAMERA_PERMISSION_ALIAS) != PermissionState.GRANTED) {
            requestPermissionForAlias(CAMERA_PERMISSION_ALIAS, call, "cameraPermissionCallback");
            return;
        }
        launchCamera(call);
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState(CAMERA_PERMISSION_ALIAS) != PermissionState.GRANTED) {
            clearPendingOutput();
            call.reject("카메라 권한을 허용해야 촬영할 수 있습니다.", CAMERA_PERMISSION_DENIED);
            return;
        }
        launchCamera(call);
    }

    private void launchCamera(PluginCall call) {
        try {
            Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            List<ResolveInfo> handlers = getContext().getPackageManager().queryIntentActivities(cameraIntent, 0);
            handlers = filterUsableCameraHandlers(handlers);
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

            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingOutputUri);
            cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            cameraIntent.setClipData(ClipData.newRawUri("petmanager-photo", pendingOutputUri));
            grantOutputUriToCameraApps(handlers);
            Intent launchIntent = call.getBoolean("chooser", false)
                ? Intent.createChooser(cameraIntent, "카메라 앱 선택")
                : cameraIntent;
            if (launchIntent != cameraIntent) {
                launchIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                launchIntent.setClipData(cameraIntent.getClipData());
            }
            startActivityForResult(call, launchIntent, "externalCameraResult");
        } catch (Exception error) {
            clearPendingOutput();
            call.reject("카메라 앱을 열 수 없습니다.", CAMERA_LAUNCH_FAILED, error);
        }
    }

    @ActivityCallback
    private void externalCameraResult(PluginCall call, ActivityResult result) {
        try {
            if (result.getResultCode() != Activity.RESULT_OK) {
                call.reject("CAMERA_CANCELLED");
                return;
            }
            Uri resultUri = pendingOutputUri;
            if ((pendingOutputFile == null || pendingOutputFile.length() == 0) && result.getData() != null && result.getData().getData() != null) {
                resultUri = result.getData().getData();
            }
            if (resultUri == null) {
                call.reject("촬영한 사진을 찾을 수 없습니다.");
                return;
            }
            byte[] bytes = readBytes(resultUri);
            if (bytes.length == 0) {
                call.reject("촬영한 사진을 읽을 수 없습니다.");
                return;
            }
            byte[] encoded = Base64.encode(bytes, Base64.NO_WRAP);
            try {
                JSObject response = new JSObject();
                response.put("base64", new String(encoded, java.nio.charset.StandardCharsets.US_ASCII));
                response.put("mimeType", getContext().getContentResolver().getType(resultUri) == null ? "image/jpeg" : getContext().getContentResolver().getType(resultUri));
                response.put("fileName", "petmanager-photo-" + System.currentTimeMillis() + ".jpg");
                call.resolve(response);
            } finally {
                Arrays.fill(encoded, (byte) 0);
                Arrays.fill(bytes, (byte) 0);
            }
        } catch (Exception error) {
            call.reject("촬영한 사진을 불러올 수 없습니다.", error);
        } finally {
            clearPendingOutput();
        }
    }

    private byte[] readBytes(Uri uri) throws Exception {
        InputStream stream = "file".equals(uri.getScheme()) ? new FileInputStream(new File(uri.getPath())) : getContext().getContentResolver().openInputStream(uri);
        if (stream == null) return new byte[0];
        byte[] buffer = new byte[8192];
        try (InputStream input = stream; WipingByteArrayOutputStream output = new WipingByteArrayOutputStream()) {
            int count;
            try {
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                return output.toByteArray();
            } finally {
                Arrays.fill(buffer, (byte) 0);
                output.wipe();
            }
        }
    }

    private void clearPendingOutput() {
        if (pendingOutputUri != null) {
            getContext().revokeUriPermission(
                pendingOutputUri,
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION
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
            getContext().grantUriPermission(
                handler.activityInfo.packageName,
                pendingOutputUri,
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        }
    }

    private List<ResolveInfo> getCameraHandlers(Intent cameraIntent) {
        return filterUsableCameraHandlers(
            getContext().getPackageManager().queryIntentActivities(cameraIntent, PackageManager.MATCH_DEFAULT_ONLY)
        );
    }

    private List<ResolveInfo> filterUsableCameraHandlers(List<ResolveInfo> matches) {
        List<ResolveInfo> handlers = new ArrayList<>();
        for (ResolveInfo match : matches) {
            if (match.activityInfo == null) continue;
            if (!match.activityInfo.enabled || !match.activityInfo.exported) continue;
            if (match.activityInfo.packageName == null || match.activityInfo.name == null) continue;
            handlers.add(match);
        }
        return handlers;
    }

    private void clearStaleOutputFiles() {
        File directory = new File(getContext().getCacheDir(), CACHE_DIRECTORY);
        File[] files = directory.listFiles((dir, name) -> name.startsWith(FILE_PREFIX));
        if (files == null) return;
        for (File file : files) {
            if (!file.equals(pendingOutputFile)) file.delete();
        }
    }
}
