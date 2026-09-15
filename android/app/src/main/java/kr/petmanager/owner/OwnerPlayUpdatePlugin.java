package kr.petmanager.owner;

import android.app.Activity;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "OwnerPlayUpdate")
public class OwnerPlayUpdatePlugin extends Plugin {
    private AppUpdateManager appUpdateManager;
    private final AtomicBoolean updateFlowStarting = new AtomicBoolean(false);
    private volatile int targetVersionCode = 0;
    private final InstallStateUpdatedListener installStateListener = state -> {
        if (state.installStatus() != InstallStatus.DOWNLOADED || targetVersionCode <= 0) return;
        JSObject result = baseState(true, true);
        result.put("available", true);
        result.put("downloaded", true);
        result.put("targetVersionCode", targetVersionCode);
        notifyListeners("updateStateChanged", result);
    };

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
        appUpdateManager.registerListener(installStateListener);
    }

    @Override
    protected void handleOnDestroy() {
        if (appUpdateManager != null) appUpdateManager.unregisterListener(installStateListener);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        if (!isInstalledFromGooglePlay()) {
            call.resolve(baseState(false, true));
            return;
        }

        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> call.resolve(stateFromInfo(info)))
            .addOnFailureListener(error -> call.resolve(baseState(true, false)));
    }

    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        if (!isInstalledFromGooglePlay() || !updateFlowStarting.compareAndSet(false, true)) {
            call.resolve(flowResult(false, false));
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            updateFlowStarting.set(false);
            call.resolve(flowResult(false, false));
            return;
        }

        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (
                    info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
                    !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                ) {
                    updateFlowStarting.set(false);
                    call.resolve(flowResult(false, false));
                    return;
                }

                targetVersionCode = info.availableVersionCode();
                AppUpdateOptions options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build();
                appUpdateManager.startUpdateFlow(info, activity, options)
                    .addOnSuccessListener(resultCode -> {
                        updateFlowStarting.set(false);
                        call.resolve(flowResult(true, resultCode == Activity.RESULT_OK));
                    })
                    .addOnFailureListener(error -> {
                        updateFlowStarting.set(false);
                        call.resolve(flowResult(false, false));
                    });
            })
            .addOnFailureListener(error -> {
                updateFlowStarting.set(false);
                call.resolve(flowResult(false, false));
            });
    }

    @PluginMethod
    public void completeFlexibleUpdate(PluginCall call) {
        if (!isInstalledFromGooglePlay()) {
            call.resolve(completeResult(false));
            return;
        }
        appUpdateManager.completeUpdate()
            .addOnSuccessListener(unused -> call.resolve(completeResult(true)))
            .addOnFailureListener(error -> call.resolve(completeResult(false)));
    }

    private JSObject stateFromInfo(AppUpdateInfo info) {
        int availability = info.updateAvailability();
        boolean downloaded = info.installStatus() == InstallStatus.DOWNLOADED;
        boolean updateAvailable =
            availability == UpdateAvailability.UPDATE_AVAILABLE &&
            info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
        boolean updateInProgress = availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
        boolean available = updateAvailable || updateInProgress || downloaded;
        if (available) targetVersionCode = info.availableVersionCode();

        JSObject result = baseState(true, true);
        result.put("available", available);
        result.put("downloaded", downloaded);
        if (available) result.put("targetVersionCode", targetVersionCode);
        return result;
    }

    private JSObject baseState(boolean supported, boolean checked) {
        JSObject result = new JSObject();
        result.put("supported", supported);
        result.put("checked", checked);
        result.put("available", false);
        result.put("downloaded", false);
        result.put("installedVersionCode", installedVersionCode());
        return result;
    }

    private JSObject flowResult(boolean started, boolean accepted) {
        JSObject result = new JSObject();
        result.put("started", started);
        result.put("accepted", accepted);
        return result;
    }

    private JSObject completeResult(boolean requested) {
        JSObject result = new JSObject();
        result.put("requested", requested);
        return result;
    }

    private int installedVersionCode() {
        try {
            PackageInfo packageInfo = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;
            return (int) Math.min(Integer.MAX_VALUE, Math.max(0, versionCode));
        } catch (PackageManager.NameNotFoundException ignored) {
            return 0;
        }
    }

    @SuppressWarnings("deprecation")
    private boolean isInstalledFromGooglePlay() {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            String installer;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                InstallSourceInfo sourceInfo = packageManager.getInstallSourceInfo(getContext().getPackageName());
                installer = sourceInfo.getInstallingPackageName();
            } else {
                installer = packageManager.getInstallerPackageName(getContext().getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Exception ignored) {
            return false;
        }
    }
}
