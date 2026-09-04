var assert = require("assert");

describe("Garbage collection", function () {
  it("is exposed to Electron tests", function () {
    assert.equal(typeof global.gc, "function");
  });
});
