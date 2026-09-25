var expect = require("chai").expect;
var path = require("path");
var muhammara = require("..");

describe("PDFReader stream byte readers", function () {
  // appendbreaks.pdf object 19 has an indirect /Length resolving to a dictionary.
  [
    {
      method: "startReadingFromStream",
      read: function (reader, stream) {
        var streamReader = reader.startReadingFromStream(stream);
        while (streamReader.notEnded()) streamReader.read(65536);
      },
      message: "Unable to read PDF stream",
    },
    {
      method: "startReadingFromStreamForPlainCopying",
      read: function (reader, stream) {
        var streamReader = reader.startReadingFromStreamForPlainCopying(stream);
        while (streamReader.notEnded()) streamReader.read(65536);
      },
      message: "Unable to read PDF stream",
    },
    {
      method: "startReadingObjectsFromStream",
      read: function (reader, stream) {
        var parser = reader.startReadingObjectsFromStream(stream);
        while (parser.parseNewObject()) {}
      },
      message: "Unable to read PDF stream objects",
    },
  ].forEach(function (testCase) {
    it(
      testCase.method +
        " throws instead of crashing on a stream whose indirect Length is not a number",
      function () {
        var reader = muhammara.createReader(
          path.join(__dirname, "TestMaterials/appendbreaks.pdf"),
        );
        expect(function () {
          testCase.read(reader, reader.parseNewObject(19));
        })
          .to.throw(Error)
          .with.property("message", testCase.message);
      },
    );
  });
});
