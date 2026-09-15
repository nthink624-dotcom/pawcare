import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, nativeCamera, cameraBridge, photoSheet] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-external-photo-sheet.tsx", import.meta.url), "utf8"),
]);

const pickerStart = nativeCamera.indexOf("public void openExternalCameraAppPicker");
const pickerEnd = nativeCamera.indexOf("@PluginMethod\n    public void release", pickerStart);
const pickerMethod = nativeCamera.slice(pickerStart, pickerEnd);
const resultStart = nativeCamera.indexOf("private void externalAppPickerResult");
const resultEnd = nativeCamera.indexOf("private void copyResultToPendingFile", resultStart);
const pickerResult = nativeCamera.slice(resultStart, resultEnd);

test("external app selection uses the system launcher picker without broad package discovery", () => {
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart);
  assert.match(pickerMethod, /new Intent\(Intent\.ACTION_MAIN\)/);
  assert.match(pickerMethod, /addCategory\(Intent\.CATEGORY_LAUNCHER\)/);
  assert.match(pickerMethod, /new Intent\(Intent\.ACTION_PICK_ACTIVITY\)/);
  assert.match(pickerMethod, /putExtra\(Intent\.EXTRA_INTENT, launcherIntent\)/);
  assert.match(pickerMethod, /putExtra\(Intent\.EXTRA_TITLE, "다른 촬영 앱 선택"\)/);
  assert.doesNotMatch(nativeCamera, /CATEGORY_APP_CAMERA|QUERY_ALL_PACKAGES|getInstalledApplications|getInstalledPackages|setPackage\(/);
  assert.doesNotMatch(manifest, /QUERY_ALL_PACKAGES|<package\b/);
});

test("only the component returned by the system picker is launched for the current flow", () => {
  assert.ok(resultStart >= 0 && resultEnd > resultStart);
  assert.match(pickerResult, /ComponentName selectedComponent = selectedIntent == null \? null : selectedIntent\.getComponent\(\)/);
  assert.match(pickerResult, /Intent\.makeMainActivity\(selectedComponent\)/);
  assert.match(pickerResult, /getActivity\(\)\.startActivity\(launchIntent\)/);
  assert.doesNotMatch(pickerResult, /SharedPreferences|putString|console|Log\.|fetch\(|http|server/);
  assert.doesNotMatch(nativeCamera, /private (?:static )?ComponentName/);
});

test("picker cancellation and unsupported OEM paths fall back without guessing a photo", () => {
  assert.match(pickerMethod, /catch \(Exception error\)[\s\S]*EXTERNAL_APP_PICKER_UNAVAILABLE/);
  assert.match(pickerResult, /result\.getResultCode\(\) != Activity\.RESULT_OK[\s\S]*EXTERNAL_APP_PICKER_CANCELLED/);
  assert.match(pickerResult, /selectedComponent == null[\s\S]*앨범에서 사진을 선택해 주세요/);
  assert.match(photoSheet, /EXTERNAL_APP_PICKER_CANCELLED[\s\S]*setExternalAppFlowStarted\(false\)/);
  assert.match(photoSheet, /앱 선택기를 열 수 없습니다\. 아래에서 앨범 사진을 선택해 주세요/);
  assert.doesNotMatch(nativeCamera, /MediaStore\.Images|DATE_ADDED|DATE_TAKEN|LATEST|latest/i);
  assert.doesNotMatch(photoSheet, /최근 사진|최신 사진|자동 선택/);
});

test("external app return emphasizes explicit album selection with truthful copy", () => {
  assert.match(cameraBridge, /openExternalCameraAppPicker\(\): Promise<void>/);
  assert.match(photoSheet, /다른 촬영 앱 선택/);
  assert.match(photoSheet, /시스템 앱 선택기에서 촬영 앱을 골라 사진을 저장하세요/);
  assert.match(photoSheet, /이 경로는 촬영 결과를 바로 받을 수 없어 돌아온 뒤 앨범에서 선택해야 합니다/);
  assert.match(photoSheet, /externalAppFlowStarted \? "촬영한 사진을 앨범에서 선택" : "앨범에서 선택"/);
  assert.match(photoSheet, /externalAppFlowStarted \? "border-\[#7aa7e8\] bg-\[#f0f6ff\]/);
});

test("direct system camera keeps FileProvider output and temporary URI grants", () => {
  assert.match(nativeCamera, /new Intent\(MediaStore\.ACTION_IMAGE_CAPTURE\)/);
  assert.match(nativeCamera, /putExtra\(MediaStore\.EXTRA_OUTPUT, outputUri\)/);
  assert.match(nativeCamera, /setClipData\(ClipData\.newRawUri\("petmanager-photo", outputUri\)\)/);
  assert.match(nativeCamera, /FLAG_GRANT_WRITE_URI_PERMISSION \| Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(nativeCamera, /Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)/);
  assert.match(nativeCamera, /chooserIntent\.setClipData\(cameraIntent\.getClipData\(\)\)/);
});
