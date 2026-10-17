// Builds the normal appearance of a form field widget as a list of drawing
// operations, without touching a writer. The Wasm Recipe keeps a copy of this
// file that differs only in its module syntax and JSDoc type casing.

import { FormFieldFlag, FormFieldKind } from "../value-sets.js";

// The default font size of multi-line text and list boxes, and the largest
// automatic size of a single line (ISO 32000-1, 12.7.3.3, size 0 is auto).
var AUTO_SIZE = 12;
var MIN_AUTO_SIZE = 4;
var LINE_HEIGHT = 1.15;
// The highlight Acrobat draws behind the selected options of a list box.
var SELECTION_COLOR = [0.6, 0.75, 0.86];

/**
 * Read the default appearance string `/DA`: the font size of its last `Tf`
 * and its last colour operator. The font name is not used; the appearance
 * draws with the font Recipe embeds.
 * @param {string|null} da - The `/DA` string.
 * @returns {{size: number, color: {operator: string, values: number[]}}}
 *   The font size, 0 for automatic, and the fill colour.
 */
export function parseDefaultAppearance(da) {
  var result = { size: 0, color: { operator: "g", values: [0] } };
  var operands = [];
  String(da || "")
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      if (token === "Tf") {
        var size = Number(operands[operands.length - 1]);
        result.size = Number.isFinite(size) && size > 0 ? size : 0;
      } else if (["g", "rg", "k"].includes(token)) {
        var count = { g: 1, rg: 3, k: 4 }[token];
        var values = operands.slice(-count).map(Number);
        if (values.length === count && values.every(Number.isFinite)) {
          result.color = { operator: token, values };
        }
      }
      operands = /^[-+.\d]/.test(token) ? operands.concat(token) : [];
    });
  return result;
}

/**
 * The box the appearance is drawn in: the widget rectangle, turned by the
 * widget rotation `/MK /R`. A rotated widget draws in a turned box.
 * @param {number[]} rect - The widget `/Rect`.
 * @param {number} rotation - `/MK /R`: 0, 90, 180 or 270.
 * @returns {{width: number, height: number, bboxWidth: number,
 *   bboxHeight: number, matrix: number[]|null}} The box.
 */
export function appearanceBox(rect, rotation) {
  var bboxWidth = Math.abs(rect[2] - rect[0]);
  var bboxHeight = Math.abs(rect[3] - rect[1]);
  var turn = ((Math.round(rotation / 90) % 4) + 4) % 4;
  var matrix = [
    null,
    [0, 1, -1, 0, bboxWidth, 0],
    [-1, 0, 0, -1, bboxWidth, bboxHeight],
    [0, -1, 1, 0, 0, bboxHeight],
  ][turn];
  return {
    width: turn % 2 ? bboxHeight : bboxWidth,
    height: turn % 2 ? bboxWidth : bboxHeight,
    bboxWidth,
    bboxHeight,
    matrix,
  };
}

/**
 * @param {number[]|null} color - Gray, RGB or CMYK components.
 * @param {boolean} stroke - Whether it is a stroke colour.
 * @returns {Array|null} The colour operation, or null for no colour.
 */
function colorOperation(color, stroke) {
  var operator = { 1: "g", 3: "rg", 4: "k" }[color?.length];
  return operator
    ? [stroke ? operator.toUpperCase() : operator, ...color]
    : null;
}

/**
 * Start the appearance of a widget: turn it by its rotation, then fill its
 * background and stroke its border.
 * @param {object} widget - The widget: `rect`, `rotation`, `background`,
 *   `borderColor` and `borderWidth`.
 * @returns {{box: object, border: number, operations: Array<Array>}} The
 *   box of appearanceBox(), the border width drawn and the operations.
 */
function widgetFrame(widget) {
  var box = appearanceBox(widget.rect, widget.rotation || 0);
  var { width, height } = box;
  var operations = [];
  if (box.matrix) operations.push(["cm", ...box.matrix]);
  var background = colorOperation(widget.background, false);
  if (background)
    operations.push(background, ["re", 0, 0, width, height], ["f"]);
  var border = widget.borderColor ? widget.borderWidth : 0;
  var stroke = colorOperation(widget.borderColor, true);
  if (border > 0 && stroke) {
    operations.push(
      stroke,
      ["w", border],
      ["re", border / 2, border / 2, width - border, height - border],
      ["S"],
    );
  }
  return { box, border, operations };
}

/**
 * Break text into the lines that fit a width, at spaces where possible and
 * between characters otherwise. Line breaks in the text are kept.
 * @param {string} text - The text.
 * @param {number} width - The available width.
 * @param {function(string): number} glyphsEnd - Where the glyphs of a text
 *   end, at the font size used.
 * @returns {string[]} The lines.
 */
export function wrapLines(text, width, glyphsEnd) {
  var lines = [];
  text.split(/\r\n|\r|\n/).forEach((paragraph) => {
    var line = "";
    paragraph.split(/(?<= )/).forEach((word) => {
      if (glyphsEnd((line + word).trimEnd()) <= width || !line) {
        line += word;
      } else {
        lines.push(line.trimEnd());
        line = word;
      }
      // A word wider than the line breaks between characters.
      if (glyphsEnd(line.trimEnd()) > width) {
        var piece = "";
        Array.from(line).forEach((character) => {
          if (piece && glyphsEnd((piece + character).trimEnd()) > width) {
            lines.push(piece);
            piece = character;
          } else {
            piece += character;
          }
        });
        line = piece;
      }
    });
    lines.push(line.trimEnd());
  });
  return lines;
}

/**
 * Build the normal appearance of a text, combo box or list box widget.
 * @param {object} widget - The widget: `rect`, `rotation`, `background`,
 *   `borderColor` and `borderWidth`.
 * @param {object} field - The field: `kind`, `flags`, `maxLength`, `da`,
 *   `quadding`, `text` (the value to show), and for a list box `options`
 *   (display texts), `selected` (indices) and `topIndex`.
 * @param {function(string, number): object} measure - Measures text at a
 *   size, as `{xMin, xMax, yMin, yMax}`.
 * @returns {{width: number, height: number, operations: Array<Array>}} The
 *   form XObject size and its drawing operations: content operators by name,
 *   ["font", size] to select the font and ["free", code] for raw code.
 */
export function buildTextAppearance(widget, field, measure) {
  var { box, border, operations } = widgetFrame(widget);
  var { width, height } = box;
  var padding = Math.max(border, 1) + 1;
  var innerWidth = Math.max(width - 2 * padding, 0);
  var innerHeight = Math.max(height - 2 * padding, 0);
  // Text keeps 1pt off both sides of the clip.
  var textWidth = Math.max(innerWidth - 2, 0);
  var appearance = parseDefaultAppearance(field.da);
  // Only text fields have the MULTILINE, PASSWORD and COMB flags.
  var textFlags = field.kind === FormFieldKind.TEXT ? field.flags : 0;
  var listBox = field.kind === FormFieldKind.LIST_BOX;
  var multiline = listBox || textFlags & FormFieldFlag.MULTILINE;
  var size = appearance.size;
  var text = field.text ?? "";
  if (textFlags & FormFieldFlag.PASSWORD) {
    text = "*".repeat(Array.from(text).length);
  }
  if (!size) {
    if (multiline) {
      size = AUTO_SIZE;
    } else {
      size = Math.max(
        Math.min(AUTO_SIZE, innerHeight / LINE_HEIGHT),
        MIN_AUTO_SIZE,
      );
      var fullWidth = measure(text, size).xMax;
      if (fullWidth > textWidth) size *= textWidth / fullWidth;
      size = Math.max(size, MIN_AUTO_SIZE);
    }
  }
  var glyphsEnd = (value) => (value ? measure(value, size).xMax : 0);
  var lineHeight = size * LINE_HEIGHT;
  var reference = measure("Hg", size);
  // The baseline that centres a line vertically in the box.
  var middle =
    (height - (reference.yMax - reference.yMin)) / 2 - reference.yMin;
  var lines = listBox
    ? field.options.slice(field.topIndex)
    : multiline
      ? wrapLines(text, textWidth, glyphsEnd)
      : [text.split(/\r\n|\r|\n/).join(" ")];

  operations.push(
    ["free", "/Tx BMC\n"],
    ["q"],
    ["re", padding, padding, innerWidth, innerHeight],
    ["W"],
    ["n"],
  );
  if (listBox) {
    lines.forEach((option, row) => {
      if (!field.selected.includes(row + field.topIndex)) return;
      var top = height - padding - row * lineHeight;
      operations.push(
        ["rg", ...SELECTION_COLOR],
        ["re", padding, top - lineHeight, innerWidth, lineHeight],
        ["f"],
      );
    });
  }
  operations.push(
    ["BT"],
    [appearance.color.operator, ...appearance.color.values],
    ["font", size],
  );
  if (textFlags & FormFieldFlag.COMB && field.maxLength) {
    var cell = width / field.maxLength;
    var previous = 0;
    Array.from(text).forEach((character, index) => {
      var dimensions = measure(character, size);
      var x =
        cell * index +
        (cell - (dimensions.xMax - dimensions.xMin)) / 2 -
        dimensions.xMin;
      operations.push(
        ["Td", x - previous, index ? 0 : middle],
        ["Tj", character],
      );
      previous = x;
    });
  } else {
    // The share of a line's free room left of it, by /Q: 0 left, 1 centred,
    // 2 right.
    var align = [0, 0.5, 1][field.quadding] ?? 0;
    // Td moves from the start of the previous line.
    var x = 0;
    var y = multiline
      ? height - padding - reference.yMax - (lineHeight - size) / 2
      : middle;
    lines.forEach((line, index) => {
      var lineX = padding + 1 + (textWidth - glyphsEnd(line)) * align;
      operations.push(["Td", lineX - x, index ? -lineHeight : y], ["Tj", line]);
      x = lineX;
    });
  }
  operations.push(["ET"], ["Q"], ["free", "EMC\n"]);
  return { width: box.bboxWidth, height: box.bboxHeight, operations };
}

/**
 * Build the on and off appearances of a checkbox widget that has none: a
 * check mark, drawn as a path so no font is needed.
 * @param {object} widget - The widget: `rect`, `rotation`, `background`,
 *   `borderColor` and `borderWidth`.
 * @returns {{width: number, height: number, on: Array<Array>,
 *   off: Array<Array>}} The form XObject size and both states' operations.
 */
export function buildButtonAppearances(widget) {
  var { box, operations: frame } = widgetFrame(widget);
  var { width, height } = box;
  var side = Math.min(width, height);
  var x = (width - side) / 2;
  var y = (height - side) / 2;
  var mark = [
    ["G", 0],
    ["w", Math.max(side / 10, 0.5)],
    ["m", x + side * 0.2, y + side * 0.5],
    ["l", x + side * 0.42, y + side * 0.25],
    ["l", x + side * 0.8, y + side * 0.78],
    ["S"],
  ];
  return {
    width: box.bboxWidth,
    height: box.bboxHeight,
    on: frame.concat([["q"]], mark, [["Q"]]),
    off: frame,
  };
}
