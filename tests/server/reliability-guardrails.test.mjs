import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("the database overlap guard remains transaction-serialized", () => {
  const migration = readProjectFile(
    "supabase/migrations/20260803145206_serialize_staff_appointment_overlap_checks.sql",
  );

  assert.match(migration, /prevent_overlapping_staff_appointments/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /'confirmed', 'in_progress', 'almost_done'/);
  assert.match(migration, /errcode = '23P01'/);
});

test("Supabase development and production identities stay explicit", () => {
  const agents = readProjectFile("AGENTS.md");
  const environmentGuide = readProjectFile("docs/supabase-environment-separation.md");
  const releaseChecklist = readProjectFile("docs/release-checklist.md");
  const gitignore = readProjectFile(".gitignore");
  const operatingRules = `${agents}\n${environmentGuide}\n${releaseChecklist}`;

  assert.match(operatingRules, /Development:[^\n]*qefxdtmdtvnzgupmjlom/);
  assert.match(operatingRules, /Production:[^\n]*ysxykikqnneuhypybjry/);
  assert.match(environmentGuide, /https:\/\/qefxdtmdtvnzgupmjlom\.supabase\.co/);
  assert.match(environmentGuide, /https:\/\/ysxykikqnneuhypybjry\.supabase\.co/);
  assert.doesNotMatch(operatingRules, /Do not (?:use or maintain|operate) a separate Supabase Dev project/);
  assert.match(gitignore, /supabase\/\*\*\/\.temp\//);
});

test("photo list surfaces keep using the batch signed URL client", () => {
  const mediaPanel = readProjectFile("src/components/owner-web/media-upload-panel.tsx");
  const settingsScreen = readProjectFile("src/components/owner-web/settings-management-screen.tsx");

  assert.match(mediaPanel, /getOwnerMediaSignedUrls/);
  assert.doesNotMatch(mediaPanel, /\/api\/owner\/media\/signed-url\?/);
  assert.match(settingsScreen, /getOwnerMediaSignedUrls/);
});

test("the owner application retains a route error recovery boundary", () => {
  const errorBoundary = readProjectFile("src/app/error.tsx");

  assert.match(errorBoundary, /reset/);
  assert.match(errorBoundary, /관리자 메인/);
  assert.match(errorBoundary, /\[petmanager-ui\]/);
});
