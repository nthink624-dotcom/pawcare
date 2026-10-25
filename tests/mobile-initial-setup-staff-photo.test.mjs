import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/initial-setup-staff-photo.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: api });
const plain = value => JSON.parse(JSON.stringify(value));
test('unresolved assets cannot be accidentally removed or replaced by filtered URL index', () => {
  for (const urls of [[], ['url-B']]) {
    const member = { profileImageAssetIds: ['A', 'B'], profileImageUrls: urls };
    assert.equal(api.canEditSetupStaffPhoto(member), false);
    assert.throws(() => api.removeSetupStaffPhoto(member));
    assert.throws(() => api.replaceSetupStaffPhoto(member, 'C', 'url-C'));
    assert.deepEqual(member.profileImageAssetIds, ['A', 'B']);
  }
});
test('replacement and removal preserve additional photos and do not mutate original', () => {
  const member = { profileImageAssetIds: ['A', 'B', 'C'], profileImageUrls: ['url-A', 'url-B', 'url-C'], profileImageUrl: 'url-A' };
  const changed = api.replaceSetupStaffPhoto(member, 'D', 'url-D');
  assert.deepEqual(plain(changed.profileImageAssetIds), ['D', 'B', 'C']);
  assert.deepEqual(plain(changed.profileImageUrls), ['url-D', 'url-B', 'url-C']);
  const removed = api.removeSetupStaffPhoto(member);
  assert.deepEqual(plain(removed.profileImageAssetIds), ['B', 'C']);
  assert.equal(removed.profileImageUrl, 'url-B');
  assert.deepEqual(member.profileImageAssetIds, ['A', 'B', 'C']);
});
test('first uploaded profile retains a durable asset id and replaces preset', () => {
  const changed = api.replaceSetupStaffPhoto({ profileImageFallbackKey: 'preset' }, 'A', 'url-A');
  assert.deepEqual(plain(changed.profileImageAssetIds), ['A']);
  assert.equal(changed.profileImageFallbackKey, null);
});
test('legacy galleries cannot be silently converted into asset-only galleries', () => {
  const member = { profileImageAssetIds: [], profileImageUrls: ['legacy-A', 'legacy-B'] };
  assert.equal(api.canEditSetupStaffPhoto(member), false);
  assert.throws(() => api.replaceSetupStaffPhoto(member, 'C', 'url-C'));
  assert.deepEqual(member.profileImageUrls, ['legacy-A', 'legacy-B']);
});
