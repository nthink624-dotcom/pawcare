import assert from "node:assert/strict";
import test from "node:test";

import { matchesKoreanSearch } from "../../src/lib/korean-text-search.ts";

const breeds = ["말티즈", "믹스", "말티푸", "푸들", "포메라니안", "시츄"];
const findBreeds = (query) => breeds.filter((breed) => matchesKoreanSearch(breed, query));

test("filters breeds while Korean consonants and vowels are being composed", () => {
  assert.deepEqual(findBreeds("ㅁ"), ["말티즈", "믹스", "말티푸"]);
  assert.deepEqual(findBreeds("마"), ["말티즈", "말티푸"]);
  assert.deepEqual(findBreeds("ㅁㅏ"), ["말티즈", "말티푸"]);
  assert.deepEqual(findBreeds("ㅍ"), ["푸들", "포메라니안"]);
  assert.deepEqual(findBreeds("시"), ["시츄"]);
});
