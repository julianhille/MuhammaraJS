// Helpers for the text direction specs. The Hebrew text they draw uses
// Arial, which carries Hebrew glyphs and which every end already registers
// as "arial", so no end needs a font of its own.
import { writeOutput } from "./ends.mjs";
import { textRuns, withReader } from "./pdf.mjs";

/**
 * Draw on a new 400 by 400 page, finish the Recipe, and keep the PDF in
 * tests/output for manual review.
 * @param {object} end - The end.
 * @param {string} name - Output file name.
 * @param {function(object): void} draw - Draws on the page.
 * @param {object} [options] - Recipe options.
 * @returns {Uint8Array} The PDF bytes.
 */
export function drawBytes(end, name, draw, options) {
  var recipe = end.newRecipe(options).createPage(400, 400);
  draw(recipe);
  var bytes = recipe.endPage().endPDF();
  writeOutput(end, name, bytes);
  return bytes;
}

/**
 * Draw on a new 400 by 400 page and read its text runs back.
 * @param {object} end - The end.
 * @param {string} name - Output file name.
 * @param {function(object): void} draw - Draws on the page.
 * @returns {Array<{text: string, x: number, y: number}>} The runs.
 */
export function drawPage(end, name, draw) {
  return textRuns(end, drawBytes(end, name, draw));
}

/**
 * The runs drawn on one line, from left to right.
 * @param {Array<{text: string, x: number, y: number}>} runs - The page's runs.
 * @param {number} [line=0] - The zero-based line, from the first run's.
 * @returns {Array<{text: string, x: number, y: number}>} The line's runs.
 */
export function lineRuns(runs, line = 0) {
  var ys = [...new Set(runs.map((run) => run.y))];
  return runs
    .filter((run) => run.y === ys[line])
    .sort((left, right) => left.x - right.x);
}

var measurers = new Map();

/**
 * Measure text in Arial as the end's Recipe does, in the order given.
 * @param {object} end - The end.
 * @param {string} text - The text.
 * @param {number} size - The font size.
 * @returns {{xMin: number, xMax: number, width: number}} Its dimensions.
 */
export function measure(end, text, size) {
  if (!measurers.has(end)) measurers.set(end, end.newRecipe());
  return measurers.get(end).textDimensions(text, { font: "arial", size });
}

/**
 * Where a drawn run's glyphs end, without its trailing spaces.
 * @param {object} end - The end.
 * @param {{text: string, x: number}} run - A drawn run.
 * @param {number} size - Its font size.
 * @returns {number} The x of its right glyph edge.
 */
export function inkRight(end, run, size) {
  return run.x + measure(end, run.text.trimEnd(), size).xMax;
}

/**
 * Follow an indirect reference.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {object} object - A PDF object or reference.
 * @returns {object} The referenced object.
 */
function resolve(end, reader, object) {
  return object &&
    object.getType() === end.muhammara.ePDFObjectIndirectObjectReference
    ? reader.parseNewObject(object.toPDFIndirectObjectReference().getObjectID())
    : object;
}

/**
 * Decode a stream as latin1 text.
 * @param {object} reader - The reader.
 * @param {object} stream - A PDF stream.
 * @returns {string} The decoded stream.
 */
function streamText(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  var text = "";
  while (input.notEnded())
    text += Buffer.from(input.read(65536)).toString("latin1");
  return text;
}

/**
 * Multiply two PDF matrices, `inner` applied first.
 * @param {number[]} inner - [a b c d e f].
 * @param {number[]} outer - [a b c d e f].
 * @returns {number[]} The product.
 */
function multiply(inner, outer) {
  var [a, b, c, d, e, f] = inner;
  var [A, B, C, D, E, F] = outer;
  return [
    a * A + b * C,
    a * B + b * D,
    c * A + d * C,
    c * B + d * D,
    e * A + f * C + E,
    e * B + f * D + F,
  ];
}

var PAINTS = new Set(["f", "F", "f*", "S", "s", "B", "B*", "b", "b*", "n"]);
var TOKENS =
  /\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>|\[|\]|\/[^\s/[\]()<>]+|[^\s/[\]()<>]+/g;

/**
 * The rectangles a page paints, in drawing order and page coordinates,
 * wherever the end put them: in the page content or in a form it draws.
 * Paint is the operator that ends the path: "f" for a fill, "S" for a
 * stroke, "n" for a clip.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{x: number, y: number, width: number, height: number, paint: string}>} The rectangles.
 */
export function paintedRects(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var rects = [];
    /**
     * Walk one content stream with its resources and starting matrix.
     * @param {string} content - The decoded content.
     * @param {object} resources - Its resources dictionary, or undefined.
     * @param {number[]} start - The matrix it starts with.
     * @returns {void}
     */
    var walk = (content, resources, start) => {
      var ctm = start;
      var stack = [];
      var operands = [];
      var pending = [];
      for (var token of content.match(TOKENS) || []) {
        if (/^[-+.\d]/.test(token) || /^[/(<[\]]/.test(token)) {
          operands.push(token);
          continue;
        }
        if (token === "q") stack.push(ctm);
        else if (token === "Q") ctm = stack.pop() || start;
        else if (token === "cm") ctm = multiply(operands.map(Number), ctm);
        else if (token === "re") {
          var [x, y, width, height] = operands.map(Number);
          var corners = [
            [x, y],
            [x + width, y + height],
          ].map(([px, py]) => [
            px * ctm[0] + py * ctm[2] + ctm[4],
            px * ctm[1] + py * ctm[3] + ctm[5],
          ]);
          var xs = corners.map((corner) => corner[0]);
          var ys = corners.map((corner) => corner[1]);
          pending.push({
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          });
        } else if (PAINTS.has(token)) {
          pending.forEach((rect) => rects.push({ ...rect, paint: token }));
          pending = [];
        } else if (token === "Do") draw(operands[0].slice(1), resources, ctm);
        operands = [];
      }
    };
    /**
     * Walk a form XObject drawn by name.
     * @param {string} name - Its resource name.
     * @param {object} resources - The resources it is named in.
     * @param {number[]} ctm - The matrix it is drawn with.
     * @returns {void}
     */
    var draw = (name, resources, ctm) => {
      var xobjects = resolve(
        end,
        reader,
        resources && reader.queryDictionaryObject(resources, "XObject"),
      );
      var stream = resolve(
        end,
        reader,
        xobjects && reader.queryDictionaryObject(xobjects, name),
      );
      if (!stream || stream.getType() !== end.muhammara.ePDFObjectStream) {
        return;
      }
      var dictionary = stream.toPDFStream().getDictionary();
      var subtype = reader.queryDictionaryObject(dictionary, "Subtype");
      if (!subtype || subtype.value !== "Form") return;
      var matrix = resolve(
        end,
        reader,
        reader.queryDictionaryObject(dictionary, "Matrix"),
      );
      walk(
        streamText(reader, stream.toPDFStream()),
        resolve(
          end,
          reader,
          reader.queryDictionaryObject(dictionary, "Resources"),
        ) || resources,
        matrix
          ? multiply(
              matrix
                .toPDFArray()
                .toJSArray()
                .map((value) => value.value),
              ctm,
            )
          : ctm,
      );
    };
    var page = reader.parsePageDictionary(pageIndex);
    var contents = resolve(
      end,
      reader,
      reader.queryDictionaryObject(page, "Contents"),
    );
    var streams = !contents
      ? []
      : contents.getType() === end.muhammara.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((entry) => resolve(end, reader, entry).toPDFStream())
        : [contents.toPDFStream()];
    walk(
      streams.map((stream) => streamText(reader, stream)).join("\n"),
      resolve(end, reader, reader.queryDictionaryObject(page, "Resources")),
      [1, 0, 0, 1, 0, 0],
    );
    return rects;
  });
}

/**
 * The horizontal extents of the filled rectangles a page paints, such as
 * text hilites, in drawing order.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number[][]} Each fill's [left, right].
 */
export function fills(end, bytes) {
  return paintedRects(end, bytes)
    .filter((rect) => rect.paint === "f")
    .map((rect) => [rect.x, rect.x + rect.width]);
}
