import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

function loadModule(relativePath, imports = {}) {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  });
  return module.exports;
}

const shared = loadModule("../../../shared/lib/reservation-chip-colors.ts");
const imports = { "@petmanager/shared/lib/reservation-chip-colors": shared };
const web = loadModule("../../src/lib/reservation-chip-colors.ts", imports);
const mobile = loadModule("../../../mobile/src/lib/appointment-identity-colors.ts", imports);
const services = Array.from({ length: 100 }, (_, index) => ({
  id: `service-${index}`,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
}));

test("24 base pastels extend to 100 distinct service backgrounds", () => {
  assert.equal(shared.reservationServiceChipPalette.length, 24);
  const tones = shared.buildServiceReservationChipTones(services);
  assert.equal(new Set(Object.values(tones).map((tone) => tone.background)).size, 100);
  for (const tone of Object.values(tones)) {
    assert.equal(tone.border, tone.background);
    assert.match(tone.background, /^#[A-F0-9]{6}$/);
  }
});

test("menu order, inactive services, renaming and new services preserve existing colors", () => {
  const original = services.slice(0, 12);
  const before = shared.buildServiceReservationChipTones(original);
  const reordered = original.toReversed().map((service) => ({ ...service, name: "renamed", is_active: false }));
  assert.deepEqual(shared.buildServiceReservationChipTones(reordered), before);
  const after = shared.buildServiceReservationChipTones(services);
  for (const service of original) assert.deepEqual(after[service.id], before[service.id]);
});

test("PC and mobile resolve the same service independently of pet and staff", () => {
  const tones = shared.buildServiceReservationChipTones(services);
  for (const service of services) {
    const pc = web.getReservationChipTone(service.id, tones);
    const phone = mobile.getAppointmentIdentityTone(service.id, tones);
    assert.equal(pc.background, phone.background);
    assert.equal(pc.border, phone.border);
  }
  assert.equal(web.getReservationChipTone("unknown", tones).background, shared.reservationChipSurfaces.neutral.background);
  assert.equal(mobile.getAppointmentIdentityTone("unknown", tones).background, shared.reservationChipSurfaces.neutral.background);
});

function luminance(hex) {
  const channels = hex.match(/[A-F0-9]{2}/gi).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("primary and secondary chip text retain at least 4.5:1 contrast for 100 services", () => {
  for (const tone of Object.values(shared.buildServiceReservationChipTones(services))) {
    for (const ink of [tone.text, "#526174"]) {
      const contrast = (luminance(tone.background) + 0.05) / (luminance(ink) + 0.05);
      assert.ok(contrast >= 4.5, `${tone.background} / ${ink}: ${contrast}`);
    }
  }
});

test("duplicate service inputs do not consume another color", () => {
  const source = services.slice(0, 3);
  assert.deepEqual(shared.buildServiceReservationChipTones([...source, source[0]]), shared.buildServiceReservationChipTones(source));
});
