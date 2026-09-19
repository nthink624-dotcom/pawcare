import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sheetSource = await readFile(new URL("../src/components/owner/owner-external-photo-sheet.tsx", import.meta.url), "utf8");
const ownerSource = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const bridgeSource = await readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8");
const pluginSource = await readFile(
  new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url),
  "utf8",
);
const manifestSource = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");

test("photo sheet removes workflow steps and exposes three explicit photo sources", () => {
  assert.doesNotMatch(sheetSource, /STEP\s*[12]|사진 선택/);
  assert.match(sheetSource, />기본 카메라로 촬영</);
  assert.match(sheetSource, />다른 카메라 앱</);
  assert.match(sheetSource, />앨범에서 선택</);
  assert.match(sheetSource, /다른 카메라 앱 선택은 Android 앱에서 사용할 수 있습니다/);
  assert.match(sheetSource, /min-h-\[72px\]/);
  assert.equal((sheetSource.match(/min-h-\[(?:44|52|64|72)px\]|min-h-11/g) ?? []).length >= 6, true);
  assert.equal((sheetSource.match(/type="file"[\s\S]{0,100}?hidden/g) ?? []).length, 2);
});

test("web camera-app selection reports unavailable without falling back to default capture", () => {
  assert.match(sheetSource, /if \(cameraAppsAvailability === "web"\) \{[\s\S]*?fallbackCameraInputRef\.current\?\.click\(\)/);
  assert.match(sheetSource, /const openCameraAppChooser = \(\) => \{[\s\S]*?onCapture\("chooser"\)[\s\S]*?setCameraAppsNotice/);
  assert.doesNotMatch(
    sheetSource.match(/const openCameraAppChooser = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "",
    /fallbackCameraInputRef|onCapture\("default"\)/,
  );
});

test("Android capability is resolved after hydration and requires the registered plugin", () => {
  assert.match(bridgeSource, /Capacitor\.getPlatform\(\) === "android" && Capacitor\.isPluginAvailable\("ExternalCamera"\)/);
  assert.match(bridgeSource, /ExternalCamera\.getCapabilities\(\)/);
  assert.match(bridgeSource, /capability\.available && capability\.handlerCount > 0/);
  assert.match(ownerSource, /useState<ExternalCameraAppsAvailability>\("checking"\)/);
  assert.match(ownerSource, /resolveExternalCameraAppsAvailability\(\)\.then/);
  assert.match(ownerSource, /cameraAppsAvailability=\{externalCameraAppsAvailability\}/);
});

test("native chooser is limited to image-capture handlers and keeps URI grants", () => {
  assert.match(pluginSource, /public void getCapabilities\(PluginCall call\)/);
  assert.match(pluginSource, /new Intent\(MediaStore\.ACTION_IMAGE_CAPTURE\)/);
  assert.match(pluginSource, /queryIntentActivities\([\s\S]*?PackageManager\.MATCH_DEFAULT_ONLY/);
  assert.match(pluginSource, /Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)/);
  assert.match(pluginSource, /launchIntent\.setClipData\(cameraIntent\.getClipData\(\)\)/);
  assert.match(pluginSource, /grantOutputUriToCameraApps\(handlers\)/);
  assert.doesNotMatch(pluginSource, /ACTION_PICK|ACTION_GET_CONTENT|setPackage\(|SODA/i);
  assert.match(manifestSource, /<action android:name="android\.media\.action\.IMAGE_CAPTURE" \/>/);
  assert.doesNotMatch(manifestSource, /QUERY_ALL_PACKAGES|<package android:name=/);
});

test("cancel keeps state unchanged and successful photos retain appointment and pet binding", () => {
  assert.match(pluginSource, /result\.getResultCode\(\) != Activity\.RESULT_OK[\s\S]*?call\.reject\("CAMERA_CANCELLED"\)/);
  assert.match(pluginSource, /finally \{\s*clearPendingOutput\(\);\s*\}/);
  assert.match(ownerSource, /captureError\.message === "CAMERA_CANCELLED"\) return/);
  assert.match(ownerSource, /shopId: data\.shop\.id,[\s\S]*?petId: appointment\.pet_id,[\s\S]*?appointmentId: appointment\.id/);
  assert.match(ownerSource, /mediaAssetIds: \[uploaded\.mediaAsset\.id\]/);
  assert.match(ownerSource, /await updateAppointment\([\s\S]*?setMobilePhotoPreviewFile\(null\)/);
});
