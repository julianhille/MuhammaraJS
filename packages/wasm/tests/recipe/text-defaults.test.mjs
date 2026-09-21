import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe text default-size parity", function () {
  [false, true].forEach(function (editing) {
    it(`uses 14pt by default and preserves explicit sizes when ${editing ? "editing" : "creating"}`, async function () {
      var Recipe = await getRecipe();
      var recipe = new Recipe();
      if (editing) {
        var source = recipe.createPage("letter").endPage().endPDF();
        recipe = new Recipe(source).editPage(1);
      } else {
        recipe.createPage("letter");
      }
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
      var bytes = recipe.endPage().endPDF();
      writeOutput(
        `text-defaults-sizes-${editing ? "editing" : "creating"}`,
        bytes,
      );
      var reader = (await createMuhammaraWasm()).createReader(bytes);
      try {
        var sizes;
        if (editing) {
          // Edits put text in Form XObjects, outside extractPageText's scope.
          var page = reader.parsePage(0).getDictionary().toPDFDictionary();
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

  it("lays out wrapped text and table rows like explicit 14pt", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe();
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
    var bytes = recipe.endPDF();
    writeOutput("text-defaults-wrapped-table", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
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

/** Collects fill-color operators from a page and its Form XObjects. */
function fillOperators(muhammara, reader, pageIndex) {
  var page = reader.parsePage(pageIndex).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map((reference) =>
            reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            ),
          )
      : [contents];
  var resources = reader.queryDictionaryObject(page, "Resources");
  if (resources.exists("XObject")) {
    var forms = reader.queryDictionaryObject(resources, "XObject");
    Object.keys(forms.toJSObject()).forEach(function (name) {
      streams.push(reader.queryDictionaryObject(forms, name));
    });
  }
  var content = streams
    .map(function (stream) {
      var input = reader.startReadingFromStream(stream.toPDFStream());
      var bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      return new TextDecoder("latin1").decode(new Uint8Array(bytes));
    })
    .join("\n");
  return Array.from(
    content.matchAll(/(?:^|\s)((?:[\d.]+ ){1,4}(?:g|rg|k))(?=\s)/g),
    (match) => match[1],
  );
}

describe("Recipe text color parity", function () {
  var cases = [
    [{}, "0.090196 0.466667 0.819608 rg"],
    [{ color: "#ff0000" }, "1 0 0 rg"],
    [{ color: "#80" }, "0.501961 g"],
    [{ color: "#ff000000" }, "1 0 0 0 k"],
    [{ color: "%100,0,0" }, "1 0 0 rg"],
    [{ color: [0, 0, 255] }, "0 0 1 rg"],
    [{ color: "nosuchcolor" }, "0.090196 0.466667 0.819608 rg"],
    [{ colour: "brand" }, "0 1 0 rg"],
  ];

  [false, true].forEach(function (editing) {
    it(`resolves text colors like native when ${editing ? "editing" : "creating"}`, async function () {
      var Recipe = await getRecipe();
      var muhammara = await createMuhammaraWasm();
      var recipe = new Recipe();
      if (editing) {
        cases.forEach(function () {
          recipe.createPage(200, 200).endPage();
        });
        recipe = new Recipe(recipe.endPDF());
      }
      recipe.chroma("brand", "#00ff00");
      cases.forEach(function ([options], index) {
        if (editing) recipe.editPage(index + 1);
        else recipe.createPage(200, 200);
        recipe.text("Hello", 20, 20, options).endPage();
      });
      var bytes = recipe.endPDF();
      writeOutput(
        `text-color-parity-${editing ? "editing" : "creating"}`,
        bytes,
      );
      var reader = muhammara.createReader(bytes);
      try {
        cases.forEach(function ([options, expected], index) {
          assert.deepEqual(
            fillOperators(muhammara, reader, index),
            [expected],
            JSON.stringify(options),
          );
        });
      } finally {
        reader.end();
      }
    });
  });
});

describe("Recipe text size validation", function () {
  var rejected = [
    [
      { size: -5 },
      /^Text size must be a number greater than zero, received -5$/,
    ],
    [
      { size: -0.1 },
      /^Text size must be a number greater than zero, received -0\.1$/,
    ],
    [{ size: 0 }, /^Text size must be a number greater than zero, received 0$/],
    [
      { size: NaN },
      /^Text size must be a number greater than zero, received NaN$/,
    ],
    [
      { fontSize: -14 },
      /^Text fontSize must be a number greater than zero, received -14$/,
    ],
    [
      { fontSize: 0 },
      /^Text fontSize must be a number greater than zero, received 0$/,
    ],
  ];

  rejected.forEach(function ([size, message]) {
    it(`rejects ${Object.entries(size).map(([key, value]) => `${key} ${String(value)}`)} on every measuring and drawing path`, async function () {
      var Recipe = await getRecipe();
      var recipe = new Recipe().createPage("letter");
      var options = { font: "arial", ...size };
      var expected = { name: "RangeError", message };
      assert.throws(() => recipe.textDimensions("Hello", options), expected);
      assert.throws(() => recipe.text("Hello", 72, 72, options), expected);
      assert.throws(
        () =>
          recipe.text("Hello world wraps", 72, 72, {
            ...options,
            textBox: { width: 90 },
          }),
        expected,
      );
      assert.throws(
        () => recipe.text("<b>Hello</b>", 72, 72, { ...options, html: true }),
        expected,
      );
      assert.throws(
        () =>
          recipe.table(72, 200, [{ value: "Hello" }], {
            ...options,
            columns: [{ name: "value", width: 90 }],
          }),
        expected,
      );
      recipe.endPage().endPDF();
    });
  });

  it("rejects a negative size while editing an existing page", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe().createPage("letter").endPage().endPDF();
    var recipe = new Recipe(source).editPage(1);
    assert.throws(
      () => recipe.text("Hello", 72, 72, { font: "arial", size: -5 }),
      { name: "RangeError" },
    );
    recipe.endPage().endPDF();
  });

  it("draws nothing for a rejected size and keeps the document usable", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage("letter");
    assert.throws(() => recipe.text("Rejected", 72, 72, { size: -5 }), {
      name: "RangeError",
    });
    var bytes = recipe
      .text("Kept", 72, 72, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput("text-size-rejected-leaves-no-output", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content),
        ["Kept"],
      );
    } finally {
      reader.end();
    }
  });

  it("keeps the 14pt default when no size is given", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage("letter");
    var expected = recipe.textDimensions("Hello", { font: "arial", size: 14 });
    [undefined, null].forEach(function (size) {
      assert.deepEqual(
        recipe.textDimensions("Hello", { font: "arial", size }),
        expected,
        `size ${String(size)}`,
      );
      assert.deepEqual(
        recipe.textDimensions("Hello", { font: "arial", fontSize: size }),
        expected,
        `fontSize ${String(size)}`,
      );
      recipe.text("Hello", 72, 72, { font: "arial", size });
    });
    assert.deepEqual(
      recipe.textDimensions("Hello", { font: "arial" }),
      expected,
    );
    recipe.text("Hello", 72, 72, { font: "arial" });
    var bytes = recipe.endPage().endPDF();
    writeOutput("text-size-omitted-defaults", bytes);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.fontSize),
        [14, 14, 14],
      );
    } finally {
      reader.end();
    }
  });

  it("accepts an infinite size without throwing, as native does", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage("letter");
    assert.doesNotThrow(function () {
      recipe.textDimensions("Hello", { font: "arial", size: Infinity });
      recipe.text("Hello", 72, 72, { font: "arial", size: Infinity });
    });
    writeOutput("text-size-infinite-accepted", recipe.endPage().endPDF());
  });
});
