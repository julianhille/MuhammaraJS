var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;
var malformed = require("./helpers/malformedInputs");

describe("MergePDFPages", function () {
  describe("OnlyMerge", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/TestOnlyMerge.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 0]] },
      );

      pdfWriter.writePage(page).end();
    });
  });

  describe("PrefixGraphicsMerge", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/TestPrefixGraphicsMerge.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter
        .startPageContentContext(page)
        .BT()
        .k(0, 0, 0, 1)
        .Tf(
          pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          30,
        )
        .Tm(1, 0, 0, 1, 10, 600)
        .Tj("Testing file merge")
        .ET()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 0]] },
      );

      pdfWriter.writePage(page).end();
    });
  });

  describe("SuffixGraphicsMerge", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/TestSuffixGraphicsMerge.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 0]] },
      );

      pdfWriter
        .startPageContentContext(page)
        .BT()
        .k(0, 0, 0, 1)
        .Tf(
          pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          30,
        )
        .Tm(1, 0, 0, 1, 10, 600)
        .Tj("Testing file merge")
        .ET()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      pdfWriter.writePage(page).end();
    });
  });

  describe("BothGraphicsMerge", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/TestBothGraphicsMerge.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      var contentContext = pdfWriter
        .startPageContentContext(page)
        .BT()
        .k(0, 0, 0, 1)
        .Tf(
          pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          30,
        )
        .Tm(1, 0, 0, 1, 10, 600)
        .Tj("Testing file merge")
        .ET()
        .q()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 0]] },
      );

      contentContext
        .Q()
        .q()
        .cm(1, 0, 0, 1, 30, 500)
        .k(0, 100, 100, 0)
        .re(0, 0, 200, 100)
        .f()
        .Q();

      pdfWriter.writePage(page).end();
    });
  });

  describe("TwoPageInSeparatePhases", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/MergeTwoPageInSeparatePhases.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);
      var contentContext = pdfWriter
        .startPageContentContext(page)
        .q()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 0]] },
      );

      contentContext.Q().q().cm(0.5, 0, 0, 0.5, 0, 421);

      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[1, 1]] },
      );

      contentContext.Q();

      pdfWriter.writePage(page).end();
    });
  });

  describe("TwoPageWithCallback", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/MergeTwoPageWithCallback.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);
      var contentContext = pdfWriter
        .startPageContentContext(page)
        .q()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      var pageIndex = 0;
      pdfWriter.mergePDFPagesToPage(
        page,
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 1]] },
        function () {
          "use strict";
          assert.strictEqual(this, globalThis);
          assert.strictEqual(arguments.length, 0);
          if (0 == pageIndex) {
            contentContext.Q().q().cm(0.5, 0, 0, 0.5, 0, 421);
          }
          ++pageIndex;
        },
      );

      contentContext.Q();
      pdfWriter.writePage(page).end();
      assert.strictEqual(pageIndex, 2);
    });

    it("stops merging when the callback throws", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/MergeCallbackFailure.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      assert.throws(function () {
        pdfWriter.mergePDFPagesToPage(
          page,
          __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
          { type: muhammara.eRangeTypeSpecific, specificRanges: [[0, 1]] },
          function () {
            throw new Error("stop merging");
          },
        );
      }, "stop merging");
      pdfWriter._abort();
    });
  });

  describe("PagesUsingCopyingContext", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/MergePagesUsingCopyingContext.pdf",
      );
      var copyingContext = pdfWriter.createPDFCopyingContext(
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
      );
      var formObjectId = copyingContext.createFormXObjectFromPDFPage(
        0,
        muhammara.ePDFPageBoxMediaBox,
      );

      var page = pdfWriter.createPage(0, 0, 595, 842);

      var pageContent = pdfWriter
        .startPageContentContext(page)
        .q()
        .cm(0.5, 0, 0, 0.5, 0, 0);
      copyingContext.mergePDFPageToPage(page, 1);

      pageContent
        .Q()
        .q()
        .cm(0.5, 0, 0, 0.5, 297.5, 421)
        .doXObject(
          page.getResourcesDictionary().addFormXObjectMapping(formObjectId),
        )
        .Q();

      pdfWriter.writePage(page);

      var page = pdfWriter.createPage(0, 0, 595, 842);
      var pageContent = pdfWriter
        .startPageContentContext(page)
        .q()
        .cm(0.5, 0, 0, 0.5, 0, 0);

      copyingContext.mergePDFPageToPage(page, 2);
      pageContent
        .Q()
        .q()
        .cm(0.5, 0, 0, 0.5, 297.5, 421)
        .doXObject(
          page.getResourcesDictionary().addFormXObjectMapping(formObjectId),
        )
        .Q();

      pdfWriter.writePage(page);
      copyingContext.end();
      pdfWriter.end();
    });

    it("defaults the dash phase to 0", function () {
      var outputPath = __dirname + "/output/DashPhaseDefault.pdf";
      var pdfWriter = muhammara.createWriter(outputPath, { compress: false });
      var page = pdfWriter.createPage(0, 0, 100, 100);
      pdfWriter.startPageContentContext(page).d([3, 1]);
      pdfWriter.writePage(page).end();
      assert.match(
        require("fs").readFileSync(outputPath, "latin1"),
        /\[ 3 1 \] 0 d/,
      );
    });

    it("places a form XObject by its object ID", function () {
      var outputPath = __dirname + "/output/DoXObjectById.pdf";
      var pdfWriter = muhammara.createWriter(outputPath, { compress: false });
      var formIds = pdfWriter.createFormXObjectsFromPDF(
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        muhammara.ePDFPageBoxMediaBox,
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);
      var context = pdfWriter.startPageContentContext(page);
      context.doXObject(formIds[0]);
      assert.throws(function () {
        context.doXObject(1.5);
      }, /positive integer/);
      pdfWriter.writePage(page).end();
      assert.match(
        require("fs").readFileSync(outputPath, "latin1"),
        /\/Fm1 Do/,
      );
    });

    it("defaults the copied page box to the media box", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/FormFromPageDefaultBox.pdf",
      );
      var copyingContext = pdfWriter.createPDFCopyingContext(
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
      );
      assert.isAbove(copyingContext.createFormXObjectFromPDFPage(0), 0);
      copyingContext.end();
      pdfWriter.end();
    });
  });

  describe("MergeFromStream", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/TestStreamMerge.pdf",
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      var inStream = new muhammara.PDFRStreamForFile(
        __dirname + "/TestMaterials/AddedPage.pdf",
      );

      pdfWriter.mergePDFPagesToPage(page, inStream, {
        type: muhammara.eRangeTypeSpecific,
        specificRanges: [[0, 0]],
      });

      pdfWriter.writePage(page).end();
    });
  });

  // A token of decoded content grew without bound while merging scanned the
  // content for resource names; it now keeps 32 MiB of it.
  it("renames resources after a name longer than 32 MiB", function () {
    var source = malformed.pdfWithFlateContent(
      Buffer.concat([
        Buffer.from("q /"),
        Buffer.alloc(40 << 20, 0x61),
        Buffer.from(" gs Q q /G1 gs Q"),
      ]),
      "<< /ExtGState << /G1 << /CA 0.5 >> >> >>",
    );
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(stream, { compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .createPDFCopyingContext(new muhammara.PDFRStreamForBuffer(source))
      .mergePDFPageToPage(page, 0);
    writer.writePage(page);
    writer.end();

    var output = stream.buffer.toString("latin1");
    // The long name is copied as it is, and /G1 after it is renamed to the
    // name the merged page's ExtGState dictionary gives it.
    var renamed = /a gs Q q \/(\S+) gs Q/.exec(output);
    assert.isNotNull(renamed);
    assert.notEqual(renamed[1], "G1");
    assert.match(
      output,
      new RegExp("/ExtGState <<\\s*/" + renamed[1] + " \\d+ 0 R"),
    );
  });

  // Each /ProcSet entry was read as a name, whatever its type.
  describe("a page whose /ProcSet holds a number", function () {
    var source = malformed.pdfWith([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]" +
        " /Resources << /ProcSet [1 /PDF] >> /Contents 4 0 R >>",
      "<< /Length 8 >>\nstream\n0 0 m S\n\nendstream",
    ]);

    /**
     * Runs `action` on a copying context of the source and ends the writer.
     * @param {Function} action - Receives the writer and copying context.
     */
    function merge(action) {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var copying = writer.createPDFCopyingContext(
        new muhammara.PDFRStreamForBuffer(source),
      );
      action(writer, copying);
      writer.end();
    }

    it("merges into a page", function () {
      merge(function (writer, copying) {
        var page = writer.createPage(0, 0, 200, 200);
        copying.mergePDFPageToPage(page, 0);
        writer.writePage(page);
      });
    });

    it("merges into a form", function () {
      merge(function (writer, copying) {
        var form = writer.createFormXObject(0, 0, 200, 200);
        copying.mergePDFPageToFormXObject(form, 0);
        writer.endFormXObject(form);
      });
    });
  });
});
