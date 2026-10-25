import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, nativeCamera, cameraBridge, photoSheet] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-external-photo-sheet.tsx", import.meta.url), "utf8"),
]);

test("external camera selection uses the result-bearing image capture contract only", () => {
  assert.match(nativeCamera, /new Intent\(MediaStore\.ACTION_IMAGE_CAPTURE\)/);
  assert.match(nativeCamera, /putExtra\(MediaStore\.EXTRA_OUTPUT, outputUri\)/);
  assert.match(nativeCamera, /Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)/);
  assert.match(nativeCamera, /startActivityForResult\(call, launchIntent, "externalCameraResult"\)/);
  assert.doesNotMatch(nativeCamera, /openExternalCameraAppPicker|externalAppPickerResult|ACTION_PICK_ACTIVITY|ACTION_MAIN|CATEGORY_LAUNCHER|ComponentName|makeMainActivity/);
  assert.doesNotMatch(cameraBridge, /openExternalCameraAppPicker|externalAppPickerAvailable/);
});

test("capture output grants are scoped to compatible handlers and always revoked", () => {
  assert.match(nativeCamera, /queryIntentActivities\(cameraIntent, PackageManager\.MATCH_DEFAULT_ONLY\)/);
  assert.match(nativeCamera, /grantOutputUriToCameraApps\(handlers\)/);
  assert.match(nativeCamera, /grantUriPermission\(packageName, pendingOutputUri, OUTPUT_URI_PERMISSION_FLAGS\)/);
  assert.match(nativeCamera, /finally \{[\s\S]*detachPendingOutput\(\)[\s\S]*clearPendingOutput\(\)/);
  assert.match(nativeCamera, /revokeUriPermission\([\s\S]*OUTPUT_URI_PERMISSION_FLAGS/);
  assert.doesNotMatch(nativeCamera, /QUERY_ALL_PACKAGES|getInstalledApplications|getInstalledPackages|setPackage\(/);
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|<package\b/);
});

test("capture cancellation and empty results fail without guessing a gallery photo", () => {
  assert.match(nativeCamera, /result\.getResultCode\(\) != Activity\.RESULT_OK[\s\S]*CAMERA_CANCELLED/);
  assert.match(nativeCamera, /pendingOutputFile\.length\(\) == 0 && result\.getData\(\) != null[\s\S]*copyResultToPendingFile/);
  assert.match(nativeCamera, /pendingOutputFile\.length\(\) == 0[\s\S]*촬영한 사진을 읽을 수 없습니다/);
  assert.doesNotMatch(nativeCamera, /MediaStore\.Images|DATE_ADDED|DATE_TAKEN|LATEST|latest/i);
});

test("photo source sheet exposes two capture modes and one icon-only album action", () => {
  assert.match(photoSheet, /다른 카메라 앱으로 촬영/);
  assert.match(photoSheet, /onClick=\{\(\) => onCapture\("chooser"\)\}/);
  assert.match(photoSheet, /기본 카메라로 촬영/);
  assert.match(photoSheet, /canUseCameraApps \? onCapture\("default"\)/);
  assert.match(photoSheet, /aria-label="앨범에서 선택"/);
  assert.match(photoSheet, /<Images className="h-5 w-5" aria-hidden="true" \/>/);
  assert.doesNotMatch(photoSheet, /STEP|다른 촬영 앱 선택|시스템 앱 선택기에서 촬영 앱을 골라|촬영 결과를 바로 받을 수 없어/);
});

test("manifest visibility remains limited to image capture and FileProvider", () => {
  assert.match(manifest, /<queries>[\s\S]*android\.media\.action\.IMAGE_CAPTURE[\s\S]*<\/queries>/);
  assert.match(manifest, /androidx\.core\.content\.FileProvider/);
  assert.match(manifest, /android:grantUriPermissions="true"/);
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|<package\b/);
});
