var assert = require("node:assert/strict");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");

describe("Recipe annotation", function () {
  var output = path.join(__dirname, "../output/annotations.pdf");
  var reader;

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
  });

  it("writes flag names and bit masks and rejects unknown flags", function () {
    var flagOutput = path.join(__dirname, "../output/annotation-flags.pdf");
    var recipe = new muhammara.Recipe("new", flagOutput).createPage(200, 200);
    assert.throws(
      () => recipe.annot(20, 20, "Square", { flag: "bogus" }),
      /Unknown annotation flag \(bogus\)/,
    );
    recipe
      .annot(20, 20, "Square", { width: 10, height: 10, flag: 4 })
      .annot(20, 60, muhammara.Recipe.AnnotSubtype.SQUARE, {
        width: 10,
        height: 10,
        flag: muhammara.Recipe.AnnotFlag.LOCKED_CONTENTS,
      })
      .endPage()
      .endPDF();
    var bytes = require("node:fs").readFileSync(flagOutput, "latin1");
    assert.match(bytes, /\/F 4\b/);
    assert.match(bytes, /\/F 512\b/);
  });

  it("resolves annotation colors and rejects unknown ones", function () {
    var colorOutput = path.join(__dirname, "../output/annotation-colors.pdf");
    var recipe = new muhammara.Recipe("new", colorOutput).createPage(200, 200);
    recipe.chroma("brand", "#336699");
    [
      "bogus",
      "ff0000",
      "#ff00",
      "#ff00001",
      "%1,2",
      "%101,0,0",
      0xff0000,
    ].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message: `Unknown annotation color (${color})`,
      });
    });
    assert.throws(() => recipe.comment("note", 20, 20, { color: "bogus" }), {
      name: "TypeError",
      message: "Unknown annotation color (bogus)",
    });
    [[1, 2], [256, 0, 0], [-1, 0, 0], [Number.NaN]].forEach(function (color) {
      assert.throws(() => recipe.annot(20, 20, "Square", { color }), {
        name: "TypeError",
        message:
          "Annotation colors need one, three, or four numbers from 0 to 255",
      });
    });
    [
      "#FF0000",
      "%0,100,0",
      "NaVy",
      "green",
      "brand",
      [255, 255, 0],
      [128],
      [0, 255, 0, 0],
      [1, 0, 0],
    ].forEach(function (color, index) {
      recipe.annot(20, 10 + index * 20, "Square", {
        width: 10,
        height: 10,
        color,
      });
    });
    recipe.comment("note", 150, 20, { color: "DarkMagenta" });
    recipe.endPage().endPDF();
    var bytes = require("node:fs").readFileSync(colorOutput, "latin1");
    var colors = Array.from(bytes.matchAll(/\/C\s*\[\s*([^\]]*?)\s*\]/g), (m) =>
      m[1].split(/\s+/).map((part) => Math.round(Number(part) * 255)),
    );
    assert.deepEqual(colors, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 128],
      [0, 255, 0],
      [0x33, 0x66, 0x99],
      [255, 255, 0],
      [128],
      [0, 255, 0, 0],
      [1, 0, 0],
      [0x8b, 0, 0x8b],
    ]);
  });

  it("rejects invalid text markup before drawing the text", function () {
    /** Renders "Kept", after rejected markup calls when `reject` is set. */
    var render = function (reject) {
      var file = path.join(
        __dirname,
        `../output/annotation-markup-${reject ? "rejected" : "plain"}.pdf`,
      );
      var recipe = new muhammara.Recipe("new", file).createPage(200, 200);
      if (reject) {
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { underline: { color: "bogus" } }),
          { name: "TypeError", message: "Unknown annotation color (bogus)" },
        );
        assert.throws(
          () =>
            recipe.text("Rejected", 20, 20, { highlight: true, flag: "bogus" }),
          /Unknown annotation flag \(bogus\)/,
        );
      }
      recipe.text("Kept", 20, 60).endPage().endPDF();
      reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(
          require("node:fs").readFileSync(file),
        ),
      );
      var page = reader.parsePage(0).getDictionary();
      assert.equal(page.exists("Annots"), false);
      var contents = reader.queryDictionaryObject(page, "Contents");
      var streams =
        contents.getType() === muhammara.ePDFObjectArray
          ? contents
              .toPDFArray()
              .toJSArray()
              .map((entry) =>
                reader
                  .parseNewObject(
                    entry.toPDFIndirectObjectReference().getObjectID(),
                  )
                  .toPDFStream(),
              )
          : [contents.toPDFStream()];
      var content = streams
        .map((stream) => {
          var readStream = reader.startReadingFromStream(stream);
          var chunks = [];
          while (readStream.notEnded())
            chunks.push(Buffer.from(readStream.read(4096)));
          return Buffer.concat(chunks).toString("latin1");
        })
        .join("");
      reader.end();
      reader = undefined;
      return content;
    };
    var kept = render(false);
    assert.match(kept, /Tj/);
    assert.equal(render(true), kept);
  });

  it("writes links, comments, and square annotations", async function () {
    var recipe = new muhammara.Recipe("new", output)
      .createPage(595, 842)
      .link("https://example.com", 50, 300, 160, 24)
      .text("Linked text", 50, 250, { link: "https://text.example.com" })
      .text('<a href="https://html.example.com">HTML link</a>', 180, 250, {
        html: true,
      })
      .image(
        path.join(__dirname, "../TestMaterials/images/png/pnglogo-grr.png"),
        50,
        275,
        {
          width: 40,
          height: 40,
          keepAspectRatio: false,
          align: "center center",
          link: "https://image.example.com",
        },
      )
      .rectangle(110, 300, 100, 24, {
        fill: "#dbeafe",
        link: "https://shape.example.com",
      })
      .rectangle(250, 100, 40, 40, {
        fill: "#dbeafe",
        useGivenCoords: true,
        link: "https://pdf-coordinates.example.com",
      })
      .comment("A browser comment", 250, 300, { title: "Muhammara" })
      .annot(350, 300, "Square", {
        width: 60,
        height: 30,
        text: "A square",
      });
    await new Promise(function (resolve) {
      recipe.endPage().endPDF(resolve);
    });

    reader = muhammara.createReader(output);
    var page = reader.parsePage(0).getDictionary();
    var annotations = reader
      .queryDictionaryObject(page, "Annots")
      .toPDFArray()
      .toJSArray()
      .map(function (reference) {
        return reader
          .parseNewObject(
            reference.toPDFIndirectObjectReference().getObjectID(),
          )
          .toPDFDictionary()
          .toJSObject();
      });
    var link = annotations.find(function (annotation) {
      return annotation.Subtype.toString() === "Link";
    });

    assert.equal(
      link.A.toPDFDictionary().toJSObject().URI.toText(),
      "https://example.com",
    );
    assert.deepEqual(
      link.Rect.toPDFArray()
        .toJSArray()
        .map(function (value) {
          return value.toNumber();
        }),
      [50, 518, 210, 542],
    );
    assert.ok(
      annotations.some(function (annotation) {
        return annotation.Subtype.toString() === "Text";
      }),
    );
    assert.ok(
      annotations.some(function (annotation) {
        return annotation.Subtype.toString() === "Square";
      }),
    );
    assert.deepEqual(
      annotations
        .filter(function (annotation) {
          return annotation.Subtype.toString() === "Link";
        })
        .map(function (annotation) {
          return annotation.A.toPDFDictionary().toJSObject().URI.toText();
        })
        .sort(),
      [
        "https://example.com",
        "https://html.example.com",
        "https://image.example.com",
        "https://pdf-coordinates.example.com",
        "https://shape.example.com",
        "https://text.example.com",
      ],
    );
    const imageLink = annotations.find(function (annotation) {
      return (
        annotation.A.toPDFDictionary().toJSObject().URI.toText() ===
        "https://image.example.com"
      );
    });
    assert.deepEqual(
      imageLink.Rect.toPDFArray()
        .toJSArray()
        .map(function (value) {
          return value.toNumber();
        }),
      [30, 547, 70, 587],
    );
  });
});
