var assert = require("node:assert/strict");
var fs = require("node:fs");
var muhammara = require("@muhammara/native-with-source");

describe("ModifyExistingPageContent", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriterToModify(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
      {
        modifiedFilePath:
          __dirname + "/output/BasicJPGImagesTestPageModified.pdf",
      },
    );

    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier
      .startContext()
      .getContext()
      .writeText("Test Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf",
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });

    pageModifier.endContext().writePage();
    pdfWriter.end();
  });

  it("keeps content from every restarted page context", function () {
    var output = __dirname + "/output/ModifyExistingPageContentRestarted.pdf";
    var pdfWriter = muhammara.createWriterToModify(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
      { modifiedFilePath: output, compress: false },
    );
    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier.startContext().getContext().re(10, 10, 5, 5).f();
    pageModifier.endContext();
    pageModifier.startContext().getContext().re(30, 30, 5, 5).f();
    pageModifier.endContext().writePage();
    pdfWriter.end();

    var bytes = fs.readFileSync(output, "latin1");
    assert.match(bytes, /10 10 5 5 re/);
    assert.match(bytes, /30 30 5 5 re/);
  });

  it("rejects a page modifier on a writer that does not modify a PDF", function () {
    var pdfWriter = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    assert.throws(function () {
      new muhammara.PDFPageModifier(pdfWriter, 0, true);
    }, /^Error: PDFPageModifier is only available when modifying a PDF$/);
    pdfWriter.end();
  });

  describe("unwritten page modifiers", function () {
    var { collectGarbage } = require("./helpers/gc");
    var source = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");

    /**
     * Starts drawing on the first page and never writes the modifier.
     *
     * @param {object} pdfWriter The writer modifying the source.
     * @returns {object} The page modifier.
     */
    function startUnwrittenModifier(pdfWriter) {
      var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0, true);
      pageModifier.startContext().getContext().re(10, 10, 20, 20).f();
      return pageModifier;
    }

    /**
     * Creates a writer that modifies the source into a buffer.
     *
     * @returns {{writer: object, output: object}} The writer and its output.
     */
    function modifyingWriter() {
      var output = new muhammara.PDFWStreamForBuffer();
      var writer = muhammara.createWriterToModify(
        new muhammara.PDFRStreamForBuffer(source),
        output,
      );
      return { writer: writer, output: output };
    }

    it("releases a modifier collected before its writer", async function () {
      var modified = modifyingWriter();
      (function () {
        startUnwrittenModifier(modified.writer);
      })();
      await collectGarbage();
      modified.writer.end();
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(modified.output.buffer),
      );
      assert.equal(reader.getPagesCount(), 2);
      reader.end();
    });

    it("releases modifiers collected with or after their writers", async function () {
      var modifiers = [];
      (function () {
        for (var i = 0; i < 10; i++) {
          startUnwrittenModifier(modifyingWriter().writer);
          modifiers.push(startUnwrittenModifier(modifyingWriter().writer));
        }
      })();
      await collectGarbage();
      modifiers = null;
      await collectGarbage();
    });
  });
});
