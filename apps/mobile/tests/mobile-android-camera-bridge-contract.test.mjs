import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = await readFile(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8",
);
const plugin = await readFile(
  new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url),
  "utf8",
);

function methodBody(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  assert.notEqual(start, -1, `missing method: ${signature}`);
  assert.notEqual(end, -1, `missing following method: ${nextSignature}`);
  return source.slice(start, end);
}

test("camera visibility stays narrowly declared for ACTION_IMAGE_CAPTURE", () => {
  assert.match(manifest, /<uses-permission android:name="android\.permission\.CAMERA"\s*\/>/);
  assert.match(
    manifest,
    /<queries>[\s\S]*?<intent>[\s\S]*?<action android:name="android\.media\.action\.IMAGE_CAPTURE"\s*\/>[\s\S]*?<\/intent>[\s\S]*?<\/queries>/,
  );
  assert.doesNotMatch(manifest, /android\.permission\.QUERY_ALL_PACKAGES/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/);
});

test("capture requests the Capacitor camera permission before the shared launch path", () => {
  assert.match(
    plugin,
    /@CapacitorPlugin\([\s\S]*?@Permission\(alias = "camera", strings = \{ Manifest\.permission\.CAMERA \}\)[\s\S]*?\)/,
  );

  const capture = methodBody(plugin, "public void capture(PluginCall call)", "@PermissionCallback");
  assert.match(capture, /getPermissionState\(CAMERA_PERMISSION_ALIAS\) != PermissionState\.GRANTED/);
  assert.match(
    capture,
    /requestPermissionForAlias\(CAMERA_PERMISSION_ALIAS, call, "cameraPermissionCallback"\);[\s\S]*?return;/,
  );
  assert.match(capture, /launchCamera\(call\);/);

  const callback = methodBody(plugin, "private void cameraPermissionCallback(PluginCall call)", "private void launchCamera");
  assert.match(callback, /getPermissionState\(CAMERA_PERMISSION_ALIAS\) != PermissionState\.GRANTED/);
  assert.match(callback, /call\.reject\([\s\S]*?CAMERA_PERMISSION_DENIED\);/);
  assert.match(callback, /launchCamera\(call\);/);
});

test("chooser and default capture share availability, URI grant, and result cleanup", () => {
  const launch = methodBody(plugin, "private void launchCamera(PluginCall call)", "@ActivityCallback");
  const queryIndex = launch.indexOf("queryIntentActivities(cameraIntent, 0)");
  const fileIndex = launch.indexOf("File.createTempFile");
  const startIndex = launch.indexOf("startActivityForResult");

  assert.ok(queryIndex >= 0 && queryIndex < fileIndex, "camera apps must be checked before creating the output file");
  assert.ok(fileIndex >= 0 && fileIndex < startIndex, "the output file must exist before launching the camera");
  assert.match(launch, /handlers\.isEmpty\(\)[\s\S]*?clearPendingOutput\(\);[\s\S]*?CAMERA_UNAVAILABLE/);
  assert.match(launch, /grantOutputUriToCameraApps\(handlers\)/);
  assert.match(
    launch,
    /call\.getBoolean\("chooser", false\)[\s\S]*?Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)[\s\S]*?: cameraIntent/,
  );
  assert.equal((plugin.match(/startActivityForResult\(/g) ?? []).length, 1);

  assert.match(plugin, /FileProvider\.getUriForFile\(/);
  assert.match(plugin, /grantUriPermission\([\s\S]*?FLAG_GRANT_WRITE_URI_PERMISSION \| Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(plugin, /revokeUriPermission\([\s\S]*?FLAG_GRANT_WRITE_URI_PERMISSION \| Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(plugin, /private void externalCameraResult[\s\S]*?finally \{[\s\S]*?clearPendingOutput\(\);/);
  assert.match(plugin, /Arrays\.fill\(encoded, \(byte\) 0\)/);
  assert.match(plugin, /Arrays\.fill\(bytes, \(byte\) 0\)/);
  assert.match(plugin, /Arrays\.fill\(buffer, \(byte\) 0\)/);
});
