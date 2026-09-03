var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

describe("Enum values", function () {
  it("exposes descriptive line cap and token separator values", function () {
    assert.deepEqual(muhammara.LineCapStyle, {
      LINECAP_BUTT: 0,
      LINECAP_ROUND: 1,
      LINECAP_SQUARE: 2,
    });
    assert.deepEqual(muhammara.ETokenSeparator, {
      eTokenSeparatorSpace: muhammara.eTokenSeparatorSpace,
      eTokenSeparatorEndLine: muhammara.eTokenSeparatorEndLine,
      eTokenSeparatorNone: muhammara.eTokenSeparatorNone,
    });
    assert.ok(Object.isFrozen(muhammara.LineCapStyle));
    assert.ok(Object.isFrozen(muhammara.ETokenSeparator));
  });
});
