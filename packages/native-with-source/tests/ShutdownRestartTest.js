var assert = require("assert");
var fs = require("fs");
var muhammara = require("@muhammara/native-with-source");

describe("ShutDownRestartState", function () {
  it("should complete without error", function () {
    var pdfWriterA = muhammara.createWriter(
      __dirname + "/output/SimpleContentShutdownRestart.PDF",
    );
    var page = pdfWriterA.createPage(0, 0, 595, 842);
    var font = pdfWriterA.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );

    pdfWriterA
      .startPageContentContext(page)
      .q()
      .k(100, 0, 0, 0)
      .re(100, 500, 100, 100)
      .f()
      .Q()
      .q()
      .k(0, 100, 100, 0)
      .re(200, 600, 200, 100)
      .f()
      .Q()
      .q()
      .G(0.5)
      .w(3)
      .m(200, 600)
      .l(400, 400)
      .S()
      .Q()
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .Tj("hello world")
      .ET();

    pdfWriterA
      .writePage(page)
      .shutdown(__dirname + "/output/ShutDownRestartState.txt");

    // ---

    var pdfWriterB = muhammara.createWriterToContinue(
      __dirname + "/output/SimpleContentShutdownRestart.PDF",
      __dirname + "/output/ShutDownRestartState.txt",
    );
    var page = pdfWriterB.createPage(0, 0, 595, 842);

    var contentContext = pdfWriterB
      .startPageContentContext(page)
      .q()
      .k(100, 0, 0, 0)
      .re(100, 500, 100, 100)
      .f()
      .Q();
    pdfWriterB.pausePageContentContext(contentContext);

    var xobjectForm = pdfWriterB.createFormXObject(0, 0, 200, 100);
    xobjectForm
      .getContentContext()
      .q()
      .k(0, 100, 100, 0)
      .re(0, 0, 200, 100)
      .f()
      .Q();

    pdfWriterB.endFormXObject(xobjectForm);

    contentContext
      .q()
      .cm(1, 0, 0, 1, 200, 600)
      .doXObject(xobjectForm)
      .Q()
      .q()
      .G(0.5)
      .w(3)
      .m(200, 600)
      .l(400, 400)
      .S()
      .Q()
      .q()
      .cm(1, 0, 0, 1, 200, 200)
      .doXObject(xobjectForm)
      .Q();

    pdfWriterB.writePage(page).end();
  });

  describe("a damaged state file", function () {
    var output = __dirname + "/output/";
    var fonts = __dirname + "/TestMaterials/fonts/";
    var state;

    before(function () {
      // 25 pages make a page tree of several nodes, and both fonts are used.
      var writer = muhammara.createWriter(output + "DamagedState.pdf");
      for (var i = 0; i < 25; ++i) {
        var page = writer.createPage(0, 0, 100, 100);
        writer
          .startPageContentContext(page)
          .writeText("Ab", 1, 1, {
            font: writer.getFontForFile(fonts + "arial.ttf"),
            size: 9,
          })
          .writeText("Cd", 1, 20, {
            font: writer.getFontForFile(fonts + "BrushScriptStd.otf"),
            size: 9,
          });
        writer.writePage(page);
      }
      writer.shutdown(output + "DamagedState.txt");
      state = fs.readFileSync(output + "DamagedState.txt", "latin1");
    });

    /**
     * Saves an edited state with its xref rebuilt, so the edit itself is
     * what the reader sees.
     * @param {string} text - The edited state file.
     * @returns {string} The path of the saved state.
     */
    function saveState(text) {
      var end = text.lastIndexOf("\nxref");
      var body = text.slice(0, end);
      var offsets = [];
      var re = /(?:^|\n)(\d+) 0 obj\b/g;
      var match;
      while ((match = re.exec(body)))
        offsets[Number(match[1])] = match.index + match[0].search(/\d/);
      var xref = "xref\n0 " + offsets.length + "\n0000000000 65535 f \n";
      for (var i = 1; i < offsets.length; ++i)
        xref +=
          offsets[i] === undefined
            ? "0000000000 65535 f \n"
            : String(offsets[i]).padStart(10, "0") + " 00000 n \n";
      var trailer = text.slice(text.lastIndexOf("trailer"));
      trailer = trailer.slice(0, trailer.indexOf("startxref"));
      fs.writeFileSync(
        output + "DamagedState.edited.txt",
        body + "\n" + xref + trailer + "startxref\n" + (end + 1) + "\n%%EOF\n",
        "latin1",
      );
      return output + "DamagedState.edited.txt";
    }

    /**
     * Continues the document from an edited state and expects a throw.
     * @param {string} text - The edited state file.
     */
    function rejects(text) {
      assert.notStrictEqual(text, state, "the edit did not apply");
      fs.copyFileSync(output + "DamagedState.pdf", output + "Damaged.pdf");
      assert.throws(function () {
        muhammara
          .createWriterToContinue(output + "Damaged.pdf", saveState(text))
          .end();
      });
    }

    it("is continued when only its xref was rebuilt", function () {
      fs.copyFileSync(output + "DamagedState.pdf", output + "Damaged.pdf");
      muhammara
        .createWriterToContinue(output + "Damaged.pdf", saveState(state))
        .end();
    });

    [
      "Root",
      "mIsModified",
      "mObjectsContext",
      "mCompressStreams",
      "mSequanceString",
      "mReferencesRegistry",
      "mObjectsWritesRegistry",
      "mObjectWritten",
      "mWritePosition",
      "mGenerationNumber",
      "mDocumentContext",
      "mModifiedDocumentIDExists",
      "mTrailerInformation",
      "mPrev",
      "mRootReference",
      "mInfoDictionary",
      "Title",
      "CreationDate",
      "mAdditionalInfoEntries",
      "mCatalogInformation",
      "mCurrentPageTreeNode",
      "mPageTreeID",
      "mIsLeafParent",
      "mKidsNodes",
      "mKidsIDs",
      "mUsedFontsRepository",
      "mEmbedFonts",
      "mOptionaMetricsFiles",
      "mUsedFonts",
      "mAvailablePositionsCount",
      "mFreeList",
      "mAssignedPositions",
      "mIsCID",
      "mGlyphIDToEncodedChar",
      "mWrittenObjectID",
      "mEncodedCharacter",
      "mUnicodeCharacters",
      "mEncryptionHelper",
      "mIsDocumentEncrypted",
      "mPerms",
    ].forEach(function (key) {
      it("is rejected without /" + key, function () {
        rejects(
          state.replace(
            new RegExp("/" + key + "(?=[\\s/<\\[(])"),
            "/X" + key.slice(1),
          ),
        );
      });
    });

    it("is rejected when a page tree node lists itself", function () {
      var root = /\/PageTreeRoot (\d+) 0 R/.exec(state)[1];
      rejects(state.replace(/\/mKidsNodes \[ \d+/, "/mKidsNodes [ " + root));
    });

    it("is rejected when a page tree kid is not a reference", function () {
      rejects(state.replace(/\/mKidsNodes \[ /, "/mKidsNodes [ 5 "));
    });

    it("is rejected when a pair list has an odd length", function () {
      rejects(state.replace(/\/mFreeList \[ \d+ /, "/mFreeList [ "));
    });

    // Values an xref entry cannot hold used to overflow its 20-byte buffer.
    [
      ["generation", /\/mGenerationNumber \d+/, "/mGenerationNumber 9999999"],
      ["write position", /\/mWritePosition \d+/, "/mWritePosition 99999999999"],
      [
        "reference type",
        /\/mObjectReferenceType \d+/,
        "/mObjectReferenceType 7",
      ],
    ].forEach(function (edit) {
      it("is rejected with an out-of-range object " + edit[0], function () {
        rejects(state.replace(edit[1], edit[2]));
      });
    });

    // One-byte fonts used to read an empty character list, or loop past the
    // end of it at code 65535, when writing their widths.
    it("fails to end with a font that has no characters", function () {
      rejects(
        state.replace(
          /\/mGlyphIDToEncodedChar \[[^\]]*\]/,
          "/mGlyphIDToEncodedChar [ ]",
        ),
      );
    });

    it("fails to end with a character code over one byte", function () {
      rejects(
        state.replace(/\/mEncodedCharacter \d+/, "/mEncodedCharacter 65535"),
      );
    });

    it("is rejected with more than 256 CFF positions", function () {
      rejects(
        state.replace(
          "/mAssignedPositions [ ",
          "/mAssignedPositions [ " + "0 ".repeat(1000),
        ),
      );
    });
  });
});
