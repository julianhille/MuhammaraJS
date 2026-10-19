// Merges packages/native-with-source/tests/recipe/text-defaults.js and the
// Wasm tests/recipe/text-defaults.test.mjs, which were identical.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, withReader } from "../support/pdf.mjs";
import { placedRuns } from "../support/text.mjs";

/**
 * The fill-color operators drawn on a page, in its content and its forms.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} pageIndex - The zero-based page.
 * @returns {string[]} The operators with their operands.
 */
function fillOperators(end, bytes, pageIndex) {
  return Array.from(
    drawnContent(end, bytes, pageIndex).matchAll(
      /(?:^|\s)((?:[\d.]+ ){1,4}(?:g|rg|k))(?=\s)/g,
    ),
    (match) => match[1],
  );
}

describeEnds("Recipe text default size", function (end) {
  [false, true].forEach(function (editing) {
    it(`uses 14pt by default and preserves explicit sizes when ${editing ? "editing" : "creating"}`, function () {
      var recipe;
      if (editing) {
        var source = end.newRecipe().createPage("letter").endPage().endPDF();
        recipe = end.openRecipe(source).editPage(1);
      } else {
        recipe = end.newRecipe().createPage("letter");
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
        end,
        `text-defaults-sizes-${editing ? "editing" : "creating"}`,
        bytes,
      );
      assert.deepEqual(
        placedRuns(end, bytes).map((run) => run.size),
        [14, 12, 18, 14],
      );
    });
  });

  it("lays out wrapped text and table rows like explicit 14pt", function () {
    var recipe = end.newRecipe();
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
    writeOutput(end, "text-defaults-wrapped-table", bytes);
    withReader(end, bytes, (reader) => {
      var output = reader.extractPageText(0);
      assert.ok(
        output.length > 3,
        "text and table cells wrap into multiple lines",
      );
      assert.ok(output.every((item) => item.fontSize === 14));
      assert.deepEqual(output, reader.extractPageText(1));
    });
  });
});

describeEnds("Recipe text color", function (end) {
  var cases = [
    [{}, "0.090196 0.466667 0.819608 rg"],
    [{ color: "#ff0000" }, "1 0 0 rg"],
    [{ color: "#80" }, "0.501961 g"],
    [{ color: "#ff000000" }, "1 0 0 0 k"],
    [{ color: "%100,0,0" }, "1 0 0 rg"],
    [{ color: [0, 0, 255] }, "0 0 1 rg"],
    [{ color: "nosuchcolor" }, "0.090196 0.466667 0.819608 rg"],
    // Only `color` sets the color; `colour` is no option.
    [{ colour: "brand" }, "0.090196 0.466667 0.819608 rg"],
  ];

  [false, true].forEach(function (editing) {
    it(`resolves text colors when ${editing ? "editing" : "creating"}`, function () {
      var recipe = end.newRecipe();
      if (editing) {
        cases.forEach(function () {
          recipe.createPage(200, 200).endPage();
        });
        recipe = end.openRecipe(recipe.endPDF());
      }
      recipe.chroma("brand", "#00ff00");
      cases.forEach(function ([options], index) {
        if (editing) recipe.editPage(index + 1);
        else recipe.createPage(200, 200);
        recipe.text("Hello", 20, 20, options).endPage();
      });
      var bytes = recipe.endPDF();
      writeOutput(
        end,
        `text-defaults-color-${editing ? "editing" : "creating"}`,
        bytes,
      );
      cases.forEach(function ([options, expected], index) {
        assert.deepEqual(
          fillOperators(end, bytes, index),
          [expected],
          JSON.stringify(options),
        );
      });
    });
  });
});

describeEnds("Recipe text size validation", function (end) {
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

  rejected.forEach(function ([size, message], index) {
    it(`rejects ${Object.entries(size).map(([key, value]) => `${key} ${String(value)}`)} on every measuring and drawing path`, function () {
      var recipe = end.newRecipe().createPage("letter");
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
      writeOutput(
        end,
        `text-defaults-rejected-size-${index}`,
        recipe.endPage().endPDF(),
      );
    });
  });

  it("rejects a negative size while editing an existing page", function () {
    var source = end.newRecipe().createPage("letter").endPage().endPDF();
    var recipe = end.openRecipe(source).editPage(1);
    assert.throws(() => recipe.text("Hello", 72, 72, { size: -5 }), {
      name: "RangeError",
    });
    assert.throws(
      () => recipe.text("Hello", 72, 72, { font: "arial", size: -5 }),
      { name: "RangeError" },
    );
    writeOutput(end, "text-defaults-rejected-edit", recipe.endPage().endPDF());
  });

  it("draws nothing for a rejected size and keeps the document usable", function () {
    var recipe = end.newRecipe().createPage("letter");
    assert.throws(() => recipe.text("Rejected", 72, 72, { size: -5 }), {
      name: "RangeError",
    });
    var bytes = recipe
      .text("Kept", 72, 72, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "text-defaults-rejected-leaves-no-output", bytes);
    assert.deepEqual(
      placedRuns(end, bytes).map((run) => run.text),
      ["Kept"],
    );
  });

  it("keeps the 14pt default when no size is given", function () {
    var recipe = end.newRecipe().createPage("letter");
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
    writeOutput(end, "text-defaults-omitted-size", bytes);
    assert.deepEqual(
      placedRuns(end, bytes).map((run) => run.size),
      [14, 14, 14],
    );
  });

  it("measures the fontSize alias like size", function () {
    var recipe = end.newRecipe().createPage("letter");
    assert.deepEqual(
      recipe.textDimensions("Hello", { font: "arial", fontSize: 12 }),
      recipe.textDimensions("Hello", { font: "arial", size: 12 }),
    );
    assert.notDeepEqual(
      recipe.textDimensions("Hello", { font: "arial", fontSize: 12 }),
      recipe.textDimensions("Hello", { font: "arial" }),
    );
    writeOutput(end, "text-defaults-fontSize-alias", recipe.endPage().endPDF());
  });

  it("rejects an infinite size", function () {
    var recipe = end.newRecipe().createPage("letter");
    assert.throws(function () {
      recipe.textDimensions("Hello", { font: "arial", size: Infinity });
    }, /Text size must be a number greater than zero, received Infinity/);
    assert.throws(function () {
      recipe.text("Hello", 72, 72, { font: "arial", fontSize: Infinity });
    }, /Text fontSize must be a number greater than zero, received Infinity/);
    writeOutput(end, "text-defaults-infinite-size", recipe.endPage().endPDF());
  });
});
