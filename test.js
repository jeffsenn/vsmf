// test.js
const assert = require("assert");
const vsmf = require("./vsmf.js");
const Immutable = require('immutable');

console.log("Running tests for vsmf...");

// Test 1: Library should load
assert.ok(vsmf, "Library did not load");
console.log("✔ Test 1 passed: vsmf loaded");

const val = {"":["UFORM", "~012345", { "hi": ["test", 1, 1.01, [], null], "there": vsmf.ERRTOK  }]};
const result = vsmf.serialize(val)
const should_be = new Uint8Array([164, 39, 3, 1, 35, 69, 2, 104, 105, 23, 162, 21, 165, 4, 116, 101, 115, 116, 73, 0, 1, 139, 63, 240, 40, 245, 194, 143, 92, 41, 162, 0, 8, 5, 116, 104, 101, 114, 101, 1, 19]);
assert.deepStrictEqual(result, should_be, "serialize did not return expected result");
console.log("✔ Serialize Test passed");
const result_i = vsmf.serialize(Immutable.fromJS(val))
assert.deepStrictEqual(result_i, should_be, "serialize(i) did not return expected result");
console.log("✔ Serialize(i) Test passed");

const result2 = vsmf.deserialize(result)
assert.deepStrictEqual(result2, val, "deserialize did not return expected result");
console.log("✔ Deserialize Test passed");

const result3 = vsmf.deserialize(result, true);
assert.deepStrictEqual(result3.toJS(), val, "deserialize(i) did not return expected result");
console.log("✔ Deserialize(i) Test passed");

const result3f = vsmf.deserialize(result, false, true);
assert.deepStrictEqual(result3f, val, "deserialize(f) did not return expected result");
console.log("✔ Deserialize(f) Test passed");

const result4 = vsmf.isSpecial(Immutable.fromJS({"":["FOO", 1,2,3]}));
assert.deepStrictEqual(result4, "FOO", "isSpecial(i) did not return expected result");
console.log("✔ isSpecial Test passed");



console.log("All tests passed!");
