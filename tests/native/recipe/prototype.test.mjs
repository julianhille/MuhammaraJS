import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("native", "Recipe prototype", function (end) {
  it("binds each Recipe class to its addon and keeps its layout classes", function () {
    // Column, Line and Word are the text layout classes native Recipe has
    // always exposed; the getters its instance state.
    assert.deepEqual(Object.getOwnPropertyNames(end.Recipe.prototype).sort(), [
      "Column",
      "Line",
      "Word",
      "constructor",
      "isBufferSrc",
      "logFile",
      "muhammara",
      "outStream",
      "output",
      "platform",
      "src",
    ]);
    assert.equal(end.Recipe.prototype.muhammara, end.muhammara);
  });

  it("adds only the Source constant to the shared statics", function () {
    var shared = Object.getPrototypeOf(end.Recipe);
    assert.deepEqual(
      Object.getOwnPropertyNames(end.Recipe).filter(
        (name) => !Object.prototype.hasOwnProperty.call(shared, name),
      ),
      ["Source"],
    );
    assert.deepEqual(end.Recipe.Source, { NEW: "new" });
    assert.ok(Object.isFrozen(end.Recipe.Source));
  });
});
