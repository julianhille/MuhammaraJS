import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe prototype", function (end) {
  it("adds only the byte-first and lifecycle methods to the shared prototype", function () {
    // split() and structure() return bytes and summaries here instead of
    // writing files, so the Wasm platform replaces the shared ones.
    assert.deepEqual(Object.getOwnPropertyNames(end.Recipe.prototype).sort(), [
      "constructor",
      "dispose",
      "htmlToTextObjects",
      "metadata",
      "muhammara",
      "platform",
      "readAsync",
      "registerFontAsync",
      "split",
      "structure",
    ]);
  });

  it("adds the asset registry, inspection and StructureFormat statics", function () {
    var shared = Object.getPrototypeOf(end.Recipe);
    assert.deepEqual(
      Object.getOwnPropertyNames(end.Recipe)
        .filter((name) => !Object.prototype.hasOwnProperty.call(shared, name))
        .sort(),
      [
        "StructureFormat",
        "disposeAssets",
        "inspectPdf",
        "permission",
        "registerFont",
        "registerFontAsync",
        "registerImage",
        "registerImageAsync",
        "registerPdf",
        "registerPdfAsync",
        "splitPdf",
        "thirdPartyLicenses",
        "unregisterFont",
        "unregisterImage",
        "unregisterPdf",
      ],
    );
    assert.ok(Object.isFrozen(end.Recipe.StructureFormat));
  });
});
