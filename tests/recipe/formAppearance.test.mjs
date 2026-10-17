import assert from "node:assert/strict";
import {
  appearanceBox,
  buildButtonAppearances,
  buildTextAppearance,
  parseDefaultAppearance,
  wrapLines,
} from "@muhammara/shared/recipe/form-appearance.js";
import { FormFieldFlag, FormFieldKind } from "@muhammara/shared/value-sets.js";

/**
 * Measure text in a test font: every character is half the font size wide,
 * and glyphs reach from -0.2 to 0.7 of the size.
 * @param {string} text - The text.
 * @param {number} size - The font size.
 * @returns {{xMin: number, xMax: number, yMin: number, yMax: number}} The
 *   dimensions.
 */
function measure(text, size) {
  return {
    xMin: 0,
    xMax: text.length * size * 0.5,
    yMin: -0.2 * size,
    yMax: 0.7 * size,
  };
}

var WIDGET = { rect: [10, 20, 110, 40] };

/**
 * @param {object} field - Field properties over a single-line text field.
 * @param {object} [widget] - Widget properties over WIDGET.
 * @returns {object} The built appearance.
 */
function build(field, widget) {
  return buildTextAppearance(
    Object.assign({}, WIDGET, widget),
    Object.assign(
      {
        kind: FormFieldKind.TEXT,
        flags: 0,
        maxLength: null,
        da: "/Helv 10 Tf 0 g",
      },
      field,
    ),
    measure,
  );
}

/**
 * @param {Array<Array>} operations - Drawing operations.
 * @param {string} operator - An operator.
 * @returns {Array<Array>} The operations with that operator.
 */
function only(operations, operator) {
  return operations.filter((operation) => operation[0] === operator);
}

describe("form appearances", function () {
  it("reads the font size and colour of /DA", function () {
    assert.deepEqual(parseDefaultAppearance("/Helv 12 Tf 0 g"), {
      size: 12,
      color: { operator: "g", values: [0] },
    });
    assert.deepEqual(parseDefaultAppearance("0 0 1 rg /Helv 0 Tf"), {
      size: 0,
      color: { operator: "rg", values: [0, 0, 1] },
    });
    assert.deepEqual(parseDefaultAppearance("/F1 9.5 Tf 0.1 0.2 0.3 0.4 k"), {
      size: 9.5,
      color: { operator: "k", values: [0.1, 0.2, 0.3, 0.4] },
    });
    assert.deepEqual(parseDefaultAppearance(null), {
      size: 0,
      color: { operator: "g", values: [0] },
    });
  });

  it("turns the box of a rotated widget", function () {
    var rect = [0, 0, 30, 100];
    assert.deepEqual(appearanceBox(rect, 0), {
      width: 30,
      height: 100,
      bboxWidth: 30,
      bboxHeight: 100,
      matrix: null,
    });
    assert.deepEqual(appearanceBox(rect, 90).matrix, [0, 1, -1, 0, 30, 0]);
    assert.equal(appearanceBox(rect, 90).width, 100);
    assert.deepEqual(appearanceBox(rect, 180).matrix, [-1, 0, 0, -1, 30, 100]);
    assert.deepEqual(appearanceBox(rect, 270).matrix, [0, -1, 1, 0, 0, 100]);
    assert.deepEqual(appearanceBox(rect, -90), appearanceBox(rect, 270));
  });

  it("wraps text at spaces, and long words between characters", function () {
    var end = (text) => text.length;
    assert.deepEqual(wrapLines("one two three", 8, end), ["one two", "three"]);
    assert.deepEqual(wrapLines("abcdefghij", 4, end), ["abcd", "efgh", "ij"]);
    assert.deepEqual(wrapLines("a\nb", 10, end), ["a", "b"]);
    // A character is not split, and a long word costs about one line of
    // measured characters per character.
    assert.deepEqual(wrapLines("\u{1F600}\u{1F600}", 1, end), [
      "\u{1F600}",
      "\u{1F600}",
    ]);
    var measured = 0;
    var counted = (text) => ((measured += text.length), text.length);
    assert.equal(wrapLines("x".repeat(4000), 10, counted).length, 400);
    assert.ok(measured < 60000);
  });

  it("clips the text to the box inside marked content", function () {
    var { width, height, operations } = build({ text: "Hi" });
    assert.equal(width, 100);
    assert.equal(height, 20);
    assert.deepEqual(operations.slice(0, 5), [
      ["free", "/Tx BMC\n"],
      ["q"],
      ["re", 2, 2, 96, 16],
      ["W"],
      ["n"],
    ]);
    assert.deepEqual(operations.slice(-3), [["ET"], ["Q"], ["free", "EMC\n"]]);
    assert.deepEqual(only(operations, "Tj"), [["Tj", "Hi"]]);
    assert.deepEqual(only(operations, "font"), [["font", 10]]);
  });

  it("aligns a line by /Q and centres it vertically", function () {
    // "Hi" is 10 wide at size 10; the line is 94 wide from x 3.
    var x = (quadding) =>
      only(build({ text: "Hi", quadding }).operations, "Td")[0][1];
    assert.equal(x(0), 3);
    assert.equal(x(1), 3 + (94 - 10) / 2);
    assert.equal(x(2), 3 + 94 - 10);
    var y = only(build({ text: "Hi" }).operations, "Td")[0][2];
    assert.ok(Math.abs(y - (2 + (16 - 9) / 2 + 2)) < 1e-9);
  });

  it("fits an automatic size to the height and the width", function () {
    var size = (text) =>
      only(build({ text, da: "/Helv 0 Tf 0 g" }).operations, "font")[0][1];
    assert.equal(size("Hi"), 12);
    // 40 characters at 12 are 240 wide; the text has 94 of the 96 inside.
    assert.ok(Math.abs(size("x".repeat(40)) - 4.7) < 1e-9);
    assert.equal(size("x".repeat(400)), 4);
    // The fitted line keeps 1pt inside the clip at 2, also right-aligned.
    var right = build({
      text: "x".repeat(40),
      da: "/Helv 0 Tf 0 g",
      quadding: 2,
    }).operations;
    assert.ok(Math.abs(only(right, "Td")[0][1] - 3) < 1e-9);
  });

  it("draws the colour, background and border of the widget", function () {
    var { operations } = build(
      { text: "Hi", da: "/Helv 10 Tf 1 0 0 rg" },
      { background: [1, 1, 0], borderColor: [0, 0, 1], borderWidth: 2 },
    );
    assert.deepEqual(operations.slice(0, 7), [
      ["rg", 1, 1, 0],
      ["re", 0, 0, 100, 20],
      ["f"],
      ["RG", 0, 0, 1],
      ["w", 2],
      ["re", 1, 1, 98, 18],
      ["S"],
    ]);
    assert.deepEqual(only(operations, "rg").pop(), ["rg", 1, 0, 0]);
  });

  it("draws one character per comb cell", function () {
    var { operations } = build({
      text: "ab",
      flags: FormFieldFlag.COMB,
      maxLength: 4,
    });
    // Cells are 25 wide; each 5 wide character is centred in its cell.
    var moves = only(operations, "Td");
    assert.deepEqual(
      moves.map((move) => move[1]),
      [10, 25],
    );
    assert.deepEqual(only(operations, "Tj"), [
      ["Tj", "a"],
      ["Tj", "b"],
    ]);
  });

  it("hides a password", function () {
    assert.deepEqual(
      only(
        // One star per character, also outside the Basic Multilingual Plane.
        build({ text: "secre\u{1F600}", flags: FormFieldFlag.PASSWORD })
          .operations,
        "Tj",
      ),
      [["Tj", "******"]],
    );
  });

  it("wraps multi-line text from the top", function () {
    var { operations } = build(
      { text: "one two three", flags: FormFieldFlag.MULTILINE },
      { rect: [0, 0, 44, 100] },
    );
    // 38 wide for text: "one two" is 35 wide at 10, "one two three" is 65.
    assert.deepEqual(only(operations, "Tj"), [
      ["Tj", "one two"],
      ["Tj", "three"],
    ]);
    var moves = only(operations, "Td");
    assert.ok(Math.abs(moves[0][2] - (100 - 2 - 7 - 0.75)) < 1e-9);
    assert.deepEqual(moves[1], ["Td", 0, -11.5]);
    // Right-aligned lines end at the same x: "one two" at 6, "three" at 16.
    moves = only(
      build(
        { text: "one two three", flags: FormFieldFlag.MULTILINE, quadding: 2 },
        { rect: [0, 0, 44, 100] },
      ).operations,
      "Td",
    );
    assert.deepEqual(
      moves.map((move) => move[1]),
      [6, 10],
    );
    // An automatic size in a multi-line field is the default size.
    var multiline = build({
      text: "x",
      flags: FormFieldFlag.MULTILINE,
      da: "/Helv 0 Tf 0 g",
    }).operations;
    assert.deepEqual(only(multiline, "font"), [["font", 12]]);
  });

  it("highlights the selected options of a list box", function () {
    var { operations } = build(
      {
        kind: FormFieldKind.LIST_BOX,
        // An option with a line break is still one row.
        options: ["a\nz", "b", "c"],
        selected: [1],
        topIndex: 0,
      },
      { rect: [0, 0, 100, 60] },
    );
    var highlight = operations.findIndex(
      (operation) => operation[0] === "rg" && operation[1] === 0.6,
    );
    assert.deepEqual(operations[highlight + 1], [
      "re",
      2,
      60 - 2 - 2 * 11.5,
      96,
      11.5,
    ]);
    assert.deepEqual(only(operations, "Tj"), [
      ["Tj", "a\nz"],
      ["Tj", "b"],
      ["Tj", "c"],
    ]);
  });

  it("draws a check mark for a checkbox without appearances", function () {
    var checkbox = buildButtonAppearances({
      rect: [0, 0, 16, 16],
      borderColor: [0],
      borderWidth: 1,
    });
    assert.equal(checkbox.width, 16);
    assert.deepEqual(checkbox.off, [
      ["G", 0],
      ["w", 1],
      ["re", 0.5, 0.5, 15, 15],
      ["S"],
    ]);
    assert.deepEqual(checkbox.on.slice(0, 4), checkbox.off);
    assert.equal(only(checkbox.on, "l").length, 2);
  });
});
