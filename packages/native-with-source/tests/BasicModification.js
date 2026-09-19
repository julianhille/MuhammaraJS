var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");
var assert = require("node:assert/strict");

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
  it("retains every context when a page modifier is resumed before writing", function () {
    var sourceOutput = new muhammara.PDFWStreamForBuffer();
    var sourceWriter = muhammara.createWriter(sourceOutput);
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 200, 200));
    sourceWriter.end();
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriterToModify(
      new muhammara.PDFRStreamForBuffer(sourceOutput.buffer),
      output,
    );
    var pageModifier = new muhammara.PDFPageModifier(writer, 0, true);
    [1, 3, 5].forEach((x) => {
      pageModifier
        .startContext()
        .getContext()
        .m(x, x + 1)
        .l(10, 10)
        .S();
      pageModifier.endContext();
      assert.throws(
        () => writer.startPageContentContext(null),
        "a missing new page must not resume a paused page modifier",
      );
    });
    pageModifier.writePage();
    writer.end();
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    try {
      var resources = reader
        .queryDictionaryObject(reader.parsePage(0).getDictionary(), "Resources")
        .toPDFDictionary();
      var forms = reader
        .queryDictionaryObject(resources, "XObject")
        .toPDFDictionary();
      var streams = Object.keys(forms.toJSObject()).map((name) => {
        var input = reader.startReadingFromStream(
          reader.queryDictionaryObject(forms, name).toPDFStream(),
        );
        var bytes = [];
        while (input.notEnded()) bytes.push(...input.read(4096));
        return Buffer.from(bytes).toString("latin1");
      });
      assert.equal(streams.length, 3);
      [1, 3, 5].forEach((x) =>
        assert.match(
          streams.join("\n"),
          new RegExp(`(^|\\s)${x} ${x + 1} m\\b`),
        ),
      );
    } finally {
      reader.end();
    }
  });

  testInPlaceFileModification("Linearized");
  testInPlaceFileModification("MultipleChange");
  testInPlaceFileModification("RemovedItem");
  testInPlaceFileModification("ObjectStreams");
  testInPlaceFileModification("ObjectStreamsModified");
});
