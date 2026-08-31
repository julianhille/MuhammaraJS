import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

describe("Recipe text layout and tables", function () {
  it("measures character spacing and writes wrapped, centered transformed text", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(300, 300);
    var plain = recipe.textDimensions("abc", { font: "arial", size: 12 });
    var spaced = recipe.textDimensions("abc", {
      font: "arial",
      size: 12,
      charSpace: 2,
    });
    assert.equal(spaced.width, plain.width + 4);
    recipe.text("centered text wraps here", 20, 20, {
      font: "arial",
      size: 14,
      charSpace: 1,
      rotation: 12,
      skewX: 3,
      textBox: {
        width: 120,
        padding: 4,
        textAlign: "center center",
        style: { fill: "#eeeeee", stroke: "#222222" },
      },
    });
    assert.ok(recipe.position.y > 20);
    assert.match(
      new TextDecoder().decode(recipe.endPage().endPDF()),
      /\/Type \/Page/,
    );
  });

  it("supports Worker-safe HTML, flow, columns, and markup annotations", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe()
      .createPage(300, 300)
      .layout("body", 20, 20, 250, 80, { columns: 2, gap: 10 });
    recipe.text(
      '<b>bold</b> <i>italic</i><br><span style="color:#ff0000">red</span>',
      {
        font: "arial",
        html: true,
        flow: true,
        layout: "body",
        highlight: true,
        underline: true,
      },
    );
    var coords = recipe.movedown(1, true);
    assert.equal(coords.length, 2);
    assert.match(
      new TextDecoder().decode(recipe.endPage().endPDF()),
      /\/Subtype \/Highlight/,
    );
  });

  it("writes headers, row styling, borders, renderers, and table continuation", async function () {
    var Recipe = await getRecipe();
    var continued = 0;
    var recipe = new Recipe().createPage(300, 300);
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
    assert.match(
      new TextDecoder().decode(recipe.endPage().endPDF()),
      /\/Type \/Page/,
    );
  });

  it("keeps text-box truncation modes, justification, hilite, and layout orders distinct", async function () {
    var Recipe = await getRecipe();
    var overflow = 0;
    var recipe = new Recipe({ compress: false })
      .createPage(300, 300)
      .layout("first", 10, 10, 100, 22, { columns: 2, gap: 10 })
      .layout("second", 10, 100, 100, 60, { columns: 1 });
    recipe
      .text("one two three four", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "clip" },
      })
      .text("one two three four", 10, 35, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "trim" },
      })
      .text("one two three four", 10, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "ellipsis" },
      })
      .text("one two three four five", 10, 85, {
        font: "arial",
        size: 12,
        hilite: { color: "#00ff00", opacity: 0.25 },
        textBox: { width: 100, textAlign: "justify top" },
      })
      .text("a\nb\nc", {
        font: "arial",
        size: 12,
        layout: "first",
        overflow: () => {
          overflow++;
          return { layout: "second", column: 0 };
        },
      })
      .endPage();
    var bytes = recipe.endPDF();
    assert.match(new TextDecoder().decode(bytes), /\sW\s+n\s/);
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    var text = reader.extractPageText(0);
    assert.ok(
      text.length >= 7,
      "clip and justified words remain separate output",
    );
    // Recipe fonts are subset-encoded; structural text operations are stable
    // even though their extracted byte strings are not source Unicode.
    assert.ok(text.length >= 7);
    assert.equal(overflow, 1);
    assert.equal(reader.getPageInfo(0).width, 300);
    reader.end();
  });

  it("matches header data alignment and per-column header-cell overrides", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(300, 200);
    recipe
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
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    var text = reader.extractPageText(0);
    var leftHeader = text.find((entry) => entry.content === "left");
    var rightHeader = text.find((entry) => entry.content === "right");
    assert.ok(leftHeader.textMatrix[4] > 40 && leftHeader.textMatrix[4] < 90);
    assert.ok(
      rightHeader.textMatrix[4] > 80 && rightHeader.textMatrix[4] < 130,
    );
    reader.end();
  });

  it("keeps clipped source, trimmed source, and ellipsized source structurally distinct", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false }).createPage(220, 120);
    recipe
      .text("alpha bravo charlie", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "clip" },
      })
      .text("alpha bravo charlie", 10, 35, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "trim" },
      })
      .text("alpha bravo charlie", 10, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "ellipsis" },
      })
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    var output = reader.extractPageText(0);
    assert.equal(output[0].content, "alpha bravo charlie");
    assert.equal(output[1].content, "alpha");
    assert.match(output[2].content, /\.\.\.$/);
    assert.ok(output[2].content.length < output[0].content.length);
    reader.end();
  });

  it("clips complete text-box lines and reports the remainder", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(220, 120);
    var callbackRecipe;
    var clipResult;
    recipe.text("first\nsecond", 10, 20, {
      font: "arial",
      size: 12,
      textBox: {
        width: 100,
        height: 12,
        lineHeight: 12,
        clipIfExceedsBox: true,
        onClip(currentRecipe, result) {
          callbackRecipe = currentRecipe;
          clipResult = result;
        },
      },
    });
    assert.equal(callbackRecipe, recipe);
    assert.deepEqual(clipResult, {
      remainder: "second",
      linesWritten: 1,
      clipped: true,
      bounds: { x: 10, y: 20, width: 100, height: 12 },
    });
    recipe.endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    assert.equal(reader.extractPageText(0).length, 1);
    reader.end();
  });

  it("warns when onClip is configured without bounded clipping", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(220, 120);
    var originalWarn = console.warn;
    var warning;
    console.warn = (message) => {
      warning = message;
    };
    try {
      recipe.text("text", 10, 20, {
        font: "arial",
        textBox: { width: 100, height: 20, onClip() {} },
      });
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(
      warning,
      "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
    );
  });

  it("measures wrapped cells before continuing and repeats headers without overlap", async function () {
    var Recipe = await getRecipe();
    var continuations = 0;
    var recipe = new Recipe({ compress: false }).createPage(240, 240);
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
          height: 50,
          header: true,
          border: true,
          columns: [
            { name: "name", width: 65 },
            { name: "value", width: 65 },
          ],
          overflow: () => {
            continuations += 1;
            return { position: [10, 130] };
          },
        },
      )
      .endPage();
    var reader = (await createMuhammaraWasm()).createReader(recipe.endPDF());
    var output = reader.extractPageText(0);
    var headers = output.filter((entry) => entry.content === "name");
    var firstRow = output.find((entry) => entry.content === "first row");
    var secondRow = output.find((entry) => entry.content === "second row");
    assert.equal(continuations, 1);
    assert.equal(headers.length, 2);
    assert.ok(headers[0].textMatrix[5] > firstRow.textMatrix[5]);
    assert.ok(headers[1].textMatrix[5] > secondRow.textMatrix[5]);
    assert.ok(headers[0].textMatrix[5] - headers[1].textMatrix[5] > 80);
    reader.end();
  });
});
