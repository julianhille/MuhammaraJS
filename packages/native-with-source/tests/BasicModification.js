var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");

function testInPlaceFileModification(inFileName) {
  describe(inFileName, function () {
    it("should complete without error", function () {
      return new Promise(function (resolve, reject) {
        var ws = fs.createWriteStream(
          __dirname + "/output/InPlaceModified" + inFileName + ".pdf",
        );
        var rs = fs.createReadStream(
          __dirname + "/TestMaterials/" + inFileName + ".pdf",
        );

        ws.on("error", reject);
        rs.on("error", reject);
        ws.on("close", function () {
          try {
            var pdfWriter = muhammara.createWriterToModify(
              __dirname + "/output/InPlaceModified" + inFileName + ".pdf",
            );
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
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        rs.pipe(ws);
      });
    });
  });
}

describe("BasicModification", function () {
  testInPlaceFileModification("Linearized");
  testInPlaceFileModification("MultipleChange");
  testInPlaceFileModification("RemovedItem");
  testInPlaceFileModification("ObjectStreams");
  testInPlaceFileModification("ObjectStreamsModified");
});
