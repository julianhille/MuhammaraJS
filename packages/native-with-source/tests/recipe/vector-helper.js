const assert = require("assert");
const { _getDistance } = require("@muhammara/shared/recipe/vector.helper.js");

describe("Vector helpers", () => {
  it("measures vertical and diagonal distances", () => {
    assert.equal(_getDistance([0, 0], [0, 3]), 3);
    assert.equal(_getDistance([0, 0], [4, 3]), 5);
  });
});
