var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// A page tree whose /Count is 1 but whose /Kids holds 4096 null entries.
var source = path.join(__dirname, "../TestMaterials/NullKidsOverCount.pdf");

describe("GHSA-8j62-hp3j-vp33", function () {
  it("rejects more null Kids entries than the page tree Count", function () {
    assert.throws(function () {
      muhammara.createReader(source);
    }, /Unable to start parsing PDF file/);
  });
});
