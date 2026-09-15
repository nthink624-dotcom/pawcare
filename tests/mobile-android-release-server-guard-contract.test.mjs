import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gradle = await readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8");

test("Android release packaging fails closed without a production Capacitor endpoint", () => {
  assert.match(gradle, /tasks\.register\('verifyReleaseServerUrl'/);
  assert.match(gradle, /config\?\.server\?\.url/);
  assert.match(gradle, /Refusing to package the offline placeholder/);
  assert.match(gradle, /parsedServerUrl\.scheme\?\.toLowerCase\(\) != 'https'/);
  assert.match(gradle, /hostname == 'localhost'/);
  assert.match(gradle, /hostname == '127\.0\.0\.1'/);
  assert.match(gradle, /parsedServerUrl\.port == 3000/);
  assert.match(gradle, /parsedServerUrl\.port == 3100/);
  assert.match(gradle, /tasks\.named\('preReleaseBuild'\)\.configure/);
  assert.match(gradle, /dependsOn tasks\.named\('verifyReleaseServerUrl'\)/);
});
