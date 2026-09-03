var muhammara = require("@muhammara/native-with-source");
var assert = require("assert");

function testBasicFileModification(inFileName, throws) {
  describe(inFileName, function () {
    it(throws ? "should error" : "should complete without error", function () {
      var sourcePath = __dirname + "/TestMaterials/" + inFileName + ".pdf";
      var outputPath = __dirname + "/output/Modified" + inFileName + ".pdf";
      if (throws) {
        var protectedWriter = muhammara.createWriterToModify(sourcePath, {
          modifiedFilePath: outputPath,
        });
        var protectedPage = protectedWriter.createPage(0, 0, 595, 842);
        protectedWriter.writePage(protectedPage);
        assert.throws(function () {
          protectedWriter.end();
        }, /Unable to end PDF/);
        return;
      }

      var sourceReader = muhammara.createReader(sourcePath);
      var sourcePageCount = sourceReader.getPagesCount();
      sourceReader.end();
      var pdfWriter = muhammara.createWriterToModify(sourcePath, {
        modifiedFilePath: outputPath,
      });

      var page = pdfWriter.createPage(0, 0, 595, 842);
      pdfWriter
        .startPageContentContext(page)
        .BT()
        .k(0, 0, 0, 1)
        .Tf(
          pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/Courier.dfont",
            0,
          ),
          1,
        )
        .Tm(30, 0, 0, 30, 78.4252, 662.8997)
        .Tj("about")
        .ET();

      pdfWriter.writePage(page);
      pdfWriter.end();

      var outputReader = muhammara.createReader(outputPath);
      try {
        assert.equal(outputReader.getPagesCount(), sourcePageCount + 1);
        assert.deepEqual(
          outputReader.parsePage(sourcePageCount).getMediaBox(),
          [0, 0, 595, 842],
        );
      } finally {
        outputReader.end();
      }
    });
  });
}

describe("BasicModification2", function () {
  testBasicFileModification("Linearized");
  testBasicFileModification("MultipleChange");
  testBasicFileModification("RemovedItem");
  testBasicFileModification("Protected", true);
  testBasicFileModification("ObjectStreams");
  testBasicFileModification("ObjectStreamsModified");
});
