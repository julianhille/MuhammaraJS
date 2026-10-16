// The table cases of the Wasm tests/recipe/text-layout-table.test.mjs; its
// text and layout cases moved to text, text-charSpace, text-clip and layout.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { withReader } from "../support/pdf.mjs";

describeEnds("Recipe text layout tables", function (end) {
  it("writes headers, row styling, borders, renderers and table continuation", function () {
    var continued = 0;
    var recipe = end.newRecipe().createPage(300, 300);
    recipe.table(
      20,
      20,
      [
        { name: "one", value: "long value" },
        { name: "two", value: "another value" },
      ],
      {
        height: 100,
        header: true,
        border: true,
        row: { nth: "even", color: "#ff0000" },
        columns: [
          { name: "name", width: 80 },
          { name: "value", width: 120, renderer: () => ({ bold: true }) },
        ],
        overflow: () => {
          continued++;
          return { position: [20, 150] };
        },
        font: "arial",
        size: 12,
      },
    );
    assert.equal(continued, 0);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-layout-table-headers-borders", bytes);
    var texts = withReader(end, bytes, (reader) =>
      reader.extractPageText(0).map((entry) => entry.content),
    );
    ["name", "value", "one", "long value", "two", "another value"].forEach(
      (text) => assert.ok(texts.includes(text), `${text}: ${texts}`),
    );
  });

  it("matches header data alignment and per-column header-cell overrides", function () {
    var bytes = end
      .newRecipe()
      .createPage(300, 200)
      .table(10, 10, [{ left: "a", right: "b" }], {
        font: "arial",
        size: 12,
        header: { alignToData: true, cell: { padding: 3 } },
        columns: [
          { name: "left", width: 80, cell: { textAlign: "right top" } },
          {
            name: "right",
            width: 80,
            cell: { textAlign: "left top" },
            hcell: { textAlign: "center top", style: { fill: "#ff0000" } },
          },
        ],
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-layout-table-header-alignment", bytes);
    withReader(end, bytes, (reader) => {
      var text = reader.extractPageText(0);
      var leftHeader = text.find((entry) => entry.content === "left");
      var rightHeader = text.find((entry) => entry.content === "right");
      assert.ok(leftHeader.textMatrix[4] > 40 && leftHeader.textMatrix[4] < 90);
      assert.ok(
        rightHeader.textMatrix[4] > 80 && rightHeader.textMatrix[4] < 130,
      );
    });
  });

  it("measures wrapped cells before continuing and repeats headers without overlap", function () {
    var continuations = 0;
    // Both segments must fit above the page's 72pt bottom margin.
    var recipe = end.newRecipe().createPage(240, 320);
    recipe
      .table(
        10,
        10,
        [
          { name: "first row wraps", value: "one two three four" },
          { name: "second row wraps", value: "five six seven eight" },
        ],
        {
          font: "arial",
          size: 12,
          height: 60,
          header: true,
          border: true,
          columns: [
            { name: "name", width: 65 },
            { name: "value", width: 65 },
          ],
          overflow: function (currentRecipe) {
            assert.equal(this, recipe);
            assert.equal(currentRecipe, recipe);
            continuations += 1;
            return { position: [10, 130] };
          },
        },
      )
      .endPage();
    var bytes = recipe.endPDF();
    writeOutput(end, "text-layout-table-continuation", bytes);
    withReader(end, bytes, (reader) => {
      var output = reader.extractPageText(0);
      var headers = output.filter((entry) => entry.content === "name");
      var firstRow = output.find((entry) => entry.content === "first row");
      // "second row wraps" breaks after "second" in the 65 point column.
      var secondRow = output.find((entry) => entry.content === "second");
      assert.equal(continuations, 1);
      assert.equal(headers.length, 2);
      assert.ok(headers[0].textMatrix[5] > firstRow.textMatrix[5]);
      assert.ok(headers[1].textMatrix[5] > secondRow.textMatrix[5]);
      assert.ok(headers[0].textMatrix[5] - headers[1].textMatrix[5] > 80);
      assert.ok(output.every((entry) => entry.textMatrix[5] >= 72));
    });
  });

  it("measures wrapped HTML table cells without overlapping the next row", function () {
    var bytes = end
      .newRecipe()
      .createPage(240, 240)
      .table(
        10,
        10,
        [
          { value: "<b>alpha bravo</b> charlie delta" },
          { value: "second row" },
        ],
        {
          font: "arial",
          size: 12,
          html: true,
          columns: [{ name: "value", width: 60 }],
        },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "text-layout-table-html-wrap", bytes);
    withReader(end, bytes, (reader) => {
      var output = reader.extractPageText(0);
      var firstRowY = new Set(
        output
          .filter((entry) => /(alpha|bravo|charlie|delta)/.test(entry.content))
          .map((entry) => entry.textMatrix[5]),
      );
      var secondRow = output.find((entry) => /second/.test(entry.content));
      assert.ok(
        firstRowY.size > 1,
        "the HTML cell must wrap onto multiple lines",
      );
      assert.ok(Math.min(...firstRowY) > secondRow.textMatrix[5]);
    });
  });
});
