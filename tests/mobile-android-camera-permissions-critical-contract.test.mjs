import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, camera, permissions, activity, settings, permissionUi, photoUi] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerAppPermissionsPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app-permissions-settings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-external-photo-sheet.tsx", import.meta.url), "utf8"),
]);

test("manifest declares camera, microphone, Android 13 notifications, and camera-app visibility", () => {
  for (const permission of ["CAMERA", "RECORD_AUDIO", "POST_NOTIFICATIONS"]) {
    assert.match(manifest, new RegExp(`android\\.permission\\.${permission}`));
  }
  assert.match(manifest, /<queries>[\s\S]*android\.media\.action\.IMAGE_CAPTURE/);
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|<package\b/);
});

test("system camera asks contextually, checks availability, and keeps direct capture output", () => {
  assert.match(camera, /requestPermissionForAlias\("camera"/);
  assert.match(camera, /handlers\.isEmpty\(\)[\s\S]*CAMERA_UNAVAILABLE/);
  assert.match(camera, /getCapabilities\(PluginCall call\)[\s\S]*availableAppCount[\s\S]*canChoose[\s\S]*externalAppPickerAvailable/);
  assert.match(camera, /call\.getBoolean\("chooser", false\) && handlers\.size\(\) > 1/);
  assert.match(camera, /Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)/);
  assert.match(camera, /MediaStore\.EXTRA_OUTPUT/);
  assert.match(camera, /setClipData\(ClipData\.newRawUri/);
  assert.doesNotMatch(camera, /setPackage\(/);
  assert.match(photoUi, /getExternalCameraCapabilities/);
  assert.match(photoUi, /cameraMode = effectiveCameraCapabilities\?\.canChoose === true \? "chooser" : "default"/);
  assert.match(photoUi, /onCapture\(cameraMode\)/);
  assert.match(photoUi, /기본 카메라 선택/);
  assert.match(photoUi, /기본 카메라로 촬영/);
});

test("camera covers cancellation, FileProvider URI grants, process recreation, and missing result", () => {
  assert.match(camera, /result\.getResultCode\(\) != Activity\.RESULT_OK[\s\S]*CAMERA_CANCELLED/);
  assert.match(camera, /FileProvider\.getUriForFile/);
  assert.match(camera, /FLAG_GRANT_WRITE_URI_PERMISSION \| Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(camera, /protected Bundle saveInstanceState\(\)/);
  assert.match(camera, /protected void restoreState\(Bundle state\)/);
  assert.match(camera, /STALE_OUTPUT_MAX_AGE_MS/);
  assert.match(camera, /file\.lastModified\(\) < staleBefore/);
  assert.match(camera, /if \(pendingOutputFile == null\)[\s\S]*촬영한 사진을 찾을 수 없습니다/);
  assert.match(camera, /pendingOutputFile\.length\(\) == 0[\s\S]*촬영한 사진을 읽을 수 없습니다/);
});

test("settings exposes three individual permissions without a bulk first-run request", () => {
  assert.match(activity, /registerPlugin\(OwnerAppPermissionsPlugin\.class\)/);
  assert.match(settings, /appPermissions: \{ title: "앱 권한"/);
  for (const key of ["camera", "microphone", "notifications"]) assert.match(permissionUi, new RegExp(`key: "${key}"`));
  assert.match(permissionUi, /requestOwnerAppPermission\(permission\)/);
  assert.doesNotMatch(permissionUi, /requestAll|Promise\.all\([^)]*requestOwnerAppPermission/);
  assert.doesNotMatch(permissionUi, /설정으로 돌아가기/);
});

test("native permission states distinguish prompt, denied, permanent denial, and Android versions", () => {
  assert.match(permissions, /PermissionState\.PROMPT\) return "prompt"/);
  assert.match(permissions, /PermissionState\.PROMPT_WITH_RATIONALE\) return "denied"/);
  assert.match(permissions, /PermissionState\.DENIED\) return "permanently_denied"/);
  assert.match(permissions, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.TIRAMISU\) return "granted"/);
  assert.match(permissions, /manager\.areNotificationsEnabled\(\)/);
  assert.match(permissions, /Settings\.ACTION_APPLICATION_DETAILS_SETTINGS/);
  assert.doesNotMatch(permissions, /Set\.of\(/);
});
