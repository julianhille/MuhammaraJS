var assert = require("node:assert/strict");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

describe("Recipe text default-size parity", function () {
  [false, true].forEach(function (editing) {
    it(`uses 14pt by default and preserves explicit sizes when ${editing ? "editing" : "creating"}`, function () {
      var recipe = new Recipe(Buffer.from("new"));
      if (editing) {
        var source = recipe
          .createPage("letter")
          .endPage()
          .endPDF((bytes) => bytes);
        recipe = new Recipe(source).editPage(1);
      } else {
        recipe.createPage("letter");
      }
      recipe.registerFont(
        "arial",
        path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
      );
      assert.deepEqual(
        recipe.textDimensions("Hello", { font: "arial" }),
        recipe.textDimensions("Hello", { font: "arial", size: 14 }),
      );
      assert.notDeepEqual(
        recipe.textDimensions("Hello", { font: "arial" }),
        recipe.textDimensions("Hello", { font: "arial", size: 12 }),
      );
      [{}, { size: 12 }, { fontSize: 18 }, {}].forEach(
        function (options, index) {
          recipe.text("Hello", 72, 72 + index * 30, {
            font: "arial",
            ...options,
          });
        },
      );
      var bytes = recipe.endPage().endPDF((output) => output);
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      try {
        var sizes;
        if (editing) {
          // Native edits put text in Form XObjects, outside extractPageText's scope.
          var page = reader.parsePage(0).getDictionary();
          var resources = reader
            .queryDictionaryObject(page, "Resources")
            .toPDFDictionary();
          var forms = reader
            .queryDictionaryObject(resources, "XObject")
            .toPDFDictionary();
          sizes = Object.keys(forms.toJSObject()).flatMap(function (name) {
            var stream = reader.startReadingFromStream(
              reader.queryDictionaryObject(forms, name).toPDFStream(),
            );
            var chunks = [];
            while (stream.notEnded())
              chunks.push(Buffer.from(stream.read(4096)));
            return Array.from(
              Buffer.concat(chunks)
                .toString("latin1")
                .matchAll(/\/\S+\s+([\d.]+)\s+Tf\b/g),
              (match) => Number(match[1]),
            );
          });
        } else {
          sizes = reader.extractPageText(0).map((item) => item.fontSize);
        }
        assert.deepEqual(sizes, [14, 12, 18, 14]);
      } finally {
        reader.end();
      }
    });
  });

  it("lays out wrapped text and table rows like explicit 14pt", function () {
    var recipe = new Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    [{}, { size: 14 }].forEach(function (options) {
      recipe
        .createPage("letter")
        .text("Hello world wraps across several lines", 150, 72, {
          font: "arial",
          ...options,
          align: "center",
          textBox: { width: 90, wrap: "auto" },
        })
        .text("Centered", 150, 160, {
          font: "arial",
          ...options,
          align: "center",
        })
        .table(
          72,
          200,
          [
            { value: "Hello world wraps across several lines" },
            { value: "Next row" },
          ],
          {
            font: "arial",
            ...options,
            columns: [{ name: "value", width: 90 }],
          },
        )
        .endPage();
    });
    var bytes = recipe.endPDF((output) => output);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      var output = reader.extractPageText(0);
      assert.ok(
        output.length > 3,
        "text and table cells wrap into multiple lines",
      );
      assert.ok(output.every((item) => item.fontSize === 14));
      assert.deepEqual(output, reader.extractPageText(1));
    } finally {
      reader.end();
    }
  });
});
