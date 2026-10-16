// Text helpers for the shared Recipe specs: where text lands on the page,
// whatever an end drew it into (page content or a form XObject), plus font
// I/O that differs by end (paths on native, bytes on Wasm).
import { readFileSync } from "node:fs";
import path from "node:path";
import { MATERIALS, fixture } from "./ends.mjs";
import { withReader } from "./pdf.mjs";

/** The fonts native bundles, also usable as fixtures on Wasm. */
export var BUNDLED_FONTS = path.join(MATERIALS, "../../../native-core/fonts");

var IDENTITY = [1, 0, 0, 1, 0, 0];

/**
 * Multiply two PDF matrices, `first` applied before `second`.
 * @param {number[]} first - [a, b, c, d, e, f].
 * @param {number[]} second - [a, b, c, d, e, f].
 * @returns {number[]} The product.
 */
export function multiply(first, second) {
  var [a, b, c, d, e, f] = first;
  var [A, B, C, D, E, F] = second;
  return [
    a * A + b * C,
    a * B + b * D,
    c * A + d * C,
    c * B + d * D,
    e * A + f * C + E,
    e * B + f * D + F,
  ];
}

/**
 * Apply a PDF matrix to a point.
 * @param {number[]} matrix - [a, b, c, d, e, f].
 * @param {number[]} point - [x, y].
 * @returns {number[]} The transformed point.
 */
export function transform(matrix, [x, y]) {
  var [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

/**
 * Turn a point clockwise around a pivot, as Recipe's `rotation` turns.
 * @param {number[]} point - [x, y] in PDF space.
 * @param {number[]} pivot - [x, y] in PDF space.
 * @param {number} degrees - The clockwise angle.
 * @returns {number[]} The turned point.
 */
export function turnClockwise([x, y], [px, py], degrees) {
  var radians = (degrees * Math.PI) / 180;
  var cos = Math.cos(radians);
  var sin = Math.sin(radians);
  var dx = x - px;
  var dy = y - py;
  return [px + cos * dx + sin * dy, py - sin * dx + cos * dy];
}

/**
 * Split a content stream into operands and operators.
 * @param {string} content - The latin1 content.
 * @returns {Array<{op?: string, value?: *}>} The tokens.
 */
function tokenize(content) {
  var tokens = [];
  var word = /[^\s/<>[\]()%{}]+/y;
  var name = /\/[^\s/<>[\]()%{}]*/y;
  var index = 0;
  while (index < content.length) {
    var char = content[index];
    if (/\s/.test(char)) {
      index++;
    } else if (char === "%") {
      while (index < content.length && !/[\r\n]/.test(content[index])) index++;
    } else if (char === "(") {
      var depth = 1;
      var text = "";
      index++;
      while (index < content.length && depth) {
        var next = content[index++];
        if (next === "\\") {
          var escaped = content[index++];
          if (/[0-7]/.test(escaped)) {
            var octal = escaped;
            while (octal.length < 3 && /[0-7]/.test(content[index]))
              octal += content[index++];
            text += String.fromCharCode(parseInt(octal, 8) & 255);
          } else if (escaped === "\r") {
            if (content[index] === "\n") index++;
          } else if (escaped !== "\n") {
            text +=
              { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[escaped] ??
              escaped;
          }
        } else if (next === "(") {
          depth++;
          text += next;
        } else if (next === ")") {
          if (--depth) text += next;
        } else {
          text += next;
        }
      }
      tokens.push({ value: text });
    } else if (
      content.startsWith("<<", index) ||
      content.startsWith(">>", index)
    ) {
      index += 2;
    } else if (char === "<") {
      var close = content.indexOf(">", index);
      var hex = content.slice(index + 1, close).replace(/\s/g, "");
      tokens.push({
        value: Buffer.from(hex.length % 2 ? hex + "0" : hex, "hex").toString(
          "latin1",
        ),
      });
      index = close + 1;
    } else if (char === "[" || char === "]") {
      tokens.push({ op: char });
      index++;
    } else if (char === "/") {
      name.lastIndex = index;
      var match = name.exec(content);
      tokens.push({ value: { name: match[0].slice(1) } });
      index = name.lastIndex;
    } else {
      word.lastIndex = index;
      var token = word.exec(content);
      if (!token) {
        index++;
        continue;
      }
      var number = Number(token[0]);
      tokens.push(Number.isNaN(number) ? { op: token[0] } : { value: number });
      index = word.lastIndex;
    }
  }
  return tokens;
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
 * The numbers of a PDF array.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {object} array - The array or a reference to it.
 * @returns {number[]} The values.
 */
function numbers(end, reader, array) {
  return resolve(end, reader, array)
    .toPDFArray()
    .toJSArray()
    .map((item) => resolve(end, reader, item).value);
}

/**
 * The four corners of a rectangle under a matrix.
 * @param {number[]} rect - [x, y, width, height].
 * @param {number[]} matrix - The CTM.
 * @returns {number[][]} The corners, starting at (x, y) and running along
 *   the width first.
 */
function corners([x, y, width, height], matrix) {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ].map((point) => transform(matrix, point));
}

/**
 * Every text run a page shows, wherever an end drew it, with the matrix
 * that places it on the page and the clip regions it is drawn inside.
 * Form XObjects are entered with their matrix, and their bounding box is a
 * clip region, as a viewer draws them.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{text: string, matrix: number[], x: number, y: number,
 *   size: number, charSpace: number, clips: number[][][]}>} The runs in
 *   drawing order; `text` holds the shown string's bytes as latin1, and each
 *   clip is the four page-space corners of a clipping rectangle.
 */
export function placedRuns(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var runs = [];
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
    var state = { ctm: IDENTITY, clips: [], charSpace: 0, leading: 0 };
    run(
      streams.map((stream) => streamText(reader, stream)).join("\n"),
      reader.queryDictionaryObject(page, "Resources"),
      state,
      0,
    );
    return runs;

    /**
     * Interpret one content stream.
     * @param {string} content - The content.
     * @param {object} resources - Its resource dictionary.
     * @param {object} graphics - The graphics state it starts with.
     * @param {number} depth - How deep in forms it is.
     * @returns {void}
     */
    function run(content, resources, graphics, depth) {
      var stack = [];
      var operands = [];
      var array = null;
      var rect = null;
      var clipNext = false;
      var tm = IDENTITY;
      var tlm = IDENTITY;
      var size = 0;
      /**
       * Record a shown string as a run.
       * @param {string} text - The string's bytes as latin1.
       * @returns {void}
       */
      var show = (text) =>
        runs.push({
          text,
          matrix: multiply(tm, graphics.ctm),
          x: multiply(tm, graphics.ctm)[4],
          y: multiply(tm, graphics.ctm)[5],
          size,
          charSpace: graphics.charSpace,
          clips: graphics.clips,
        });
      /**
       * Start a new text line offset from the current one.
       * @param {number} tx - The x offset.
       * @param {number} ty - The y offset.
       * @returns {void}
       */
      var moveLine = (tx, ty) => {
        tlm = multiply([1, 0, 0, 1, tx, ty], tlm);
        tm = tlm;
      };
      for (var token of tokenize(content)) {
        if (token.op === "[") {
          array = [];
          continue;
        }
        if (token.op === "]") {
          operands.push(array);
          array = null;
          continue;
        }
        if (!token.op) {
          (array || operands).push(token.value);
          continue;
        }
        var args = operands;
        operands = [];
        switch (token.op) {
          case "q":
            stack.push(graphics);
            graphics = { ...graphics };
            break;
          case "Q":
            graphics = stack.pop() || graphics;
            break;
          case "cm":
            graphics.ctm = multiply(args, graphics.ctm);
            break;
          case "re":
            rect = args;
            break;
          case "W":
          case "W*":
            clipNext = true;
            break;
          case "n":
          case "f":
          case "F":
          case "f*":
          case "S":
          case "s":
          case "B":
          case "B*":
          case "b":
          case "b*":
            if (clipNext && rect)
              graphics.clips = [...graphics.clips, corners(rect, graphics.ctm)];
            clipNext = false;
            rect = null;
            break;
          case "BT":
            tm = tlm = IDENTITY;
            break;
          case "Tm":
            tm = tlm = args;
            break;
          case "Td":
            moveLine(args[0], args[1]);
            break;
          case "TD":
            graphics.leading = -args[1];
            moveLine(args[0], args[1]);
            break;
          case "T*":
            moveLine(0, -graphics.leading);
            break;
          case "TL":
            graphics.leading = args[0];
            break;
          case "Tc":
            graphics.charSpace = args[0];
            break;
          case "Tf":
            size = args[1];
            break;
          case "Tj":
            show(args[0]);
            break;
          case "'":
            moveLine(0, -graphics.leading);
            show(args[0]);
            break;
          case '"':
            moveLine(0, -graphics.leading);
            show(args[2]);
            break;
          case "TJ":
            show(args[0].filter((item) => typeof item === "string").join(""));
            break;
          case "Do":
            drawForm(args[0].name, resources, graphics, depth);
            break;
        }
      }
    }

    /**
     * Draw a form XObject the content names; other XObjects show no text.
     * @param {string} name - The resource name.
     * @param {object} resources - The resources that name it.
     * @param {object} graphics - The graphics state at the `Do`.
     * @param {number} depth - How deep in forms the `Do` is.
     * @returns {void}
     */
    function drawForm(name, resources, graphics, depth) {
      resources = resolve(end, reader, resources);
      if (!resources || depth > 16) return;
      var xobjects = resolve(
        end,
        reader,
        reader.queryDictionaryObject(resources, "XObject"),
      );
      if (!xobjects) return;
      var stream = resolve(
        end,
        reader,
        reader.queryDictionaryObject(xobjects.toPDFDictionary(), name),
      );
      if (!stream || stream.getType() !== end.muhammara.ePDFObjectStream)
        return;
      var dictionary = stream.toPDFStream().getDictionary();
      var subtype = reader.queryDictionaryObject(dictionary, "Subtype");
      if (!subtype || subtype.value !== "Form") return;
      var matrix = reader.queryDictionaryObject(dictionary, "Matrix");
      var ctm = multiply(
        matrix ? numbers(end, reader, matrix) : IDENTITY,
        graphics.ctm,
      );
      var [left, bottom, right, top] = numbers(
        end,
        reader,
        reader.queryDictionaryObject(dictionary, "BBox"),
      );
      run(
        streamText(reader, stream.toPDFStream()),
        reader.queryDictionaryObject(dictionary, "Resources") || resources,
        {
          ...graphics,
          ctm,
          clips: [
            ...graphics.clips,
            corners([left, bottom, right - left, top - bottom], ctm),
          ],
        },
        depth + 1,
      );
    }
  });
}

/**
 * The page-space bounds of a clip region.
 * @param {number[][]} clip - Its four corners.
 * @returns {{left: number, bottom: number, right: number, top: number}} The
 *   bounds.
 */
export function clipBounds(clip) {
  var xs = clip.map(([x]) => x);
  var ys = clip.map(([, y]) => y);
  return {
    left: Math.min(...xs),
    bottom: Math.min(...ys),
    right: Math.max(...xs),
    top: Math.max(...ys),
  };
}

var arialFonts = new WeakMap();

/**
 * The end's low-level Arial font, for measuring glyphs independently of the
 * Recipe.
 * @param {object} end - The loaded end.
 * @returns {object} The font, with `calculateTextDimensions(text, size)`.
 */
export function arialFont(end) {
  if (!arialFonts.has(end)) {
    var file = fixture("fonts/arial.ttf");
    var writer;
    var font;
    if (end.name === "native") {
      writer = end.muhammara.createWriter(
        new end.muhammara.PDFWStreamForBuffer(),
      );
      font = writer.getFontForFile(file);
    } else {
      end.muhammara.registerFont("arial", readFileSync(file));
      writer = end.muhammara.createWriter();
      font = writer.getFontForBytes("arial");
    }
    // The writer is kept with its font: a collected writer ends, and its
    // fonts stop measuring.
    arialFonts.set(end, { writer, font });
  }
  return arialFonts.get(end).font;
}

/**
 * Register a font file with a Recipe through the end's own I/O: its path on
 * native, its bytes on Wasm.
 * @param {object} end - The end.
 * @param {object} recipe - The Recipe.
 * @param {string} family - The family name.
 * @param {string} file - The font file, absolute or below TestMaterials.
 * @param {string} [style] - The style the file provides.
 * @returns {object} The Recipe.
 */
export function registerFont(end, recipe, family, file, style) {
  var source =
    end.name === "native" ? fixture(file) : readFileSync(fixture(file));
  return recipe.registerFont(family, source, style);
}

/**
 * The text runs of a page with the PostScript name of the font each is shown
 * in, without the subset prefix. Only reads the page content itself.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{text: string, font: string}>} The runs.
 */
export function runFonts(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var page = reader.parsePageDictionary(pageIndex);
    var fonts = resolve(
      end,
      reader,
      reader.queryDictionaryObject(
        resolve(end, reader, reader.queryDictionaryObject(page, "Resources")),
        "Font",
      ),
    ).toPDFDictionary();
    return reader.extractPageText(pageIndex).map((run) => ({
      text: run.text,
      font: reader
        .queryDictionaryObject(
          resolve(
            end,
            reader,
            reader.queryDictionaryObject(fonts, run.fontResource),
          ),
          "BaseFont",
        )
        .value.replace(/^[A-Z]{6}\+/, ""),
    }));
  });
}

/**
 * The straight stroked segments (`x y m x y l S`) of drawn content.
 * @param {string} content - The drawn content of a page without transforms.
 * @returns {Array<{x1: number, y1: number, x2: number, y2: number}>} The
 *   segments.
 */
export function strokedSegments(content) {
  return [
    ...content.matchAll(
      /(-?[\d.]+) (-?[\d.]+) m\s+(-?[\d.]+) (-?[\d.]+) l\s+S\b/g,
    ),
  ].map(([, x1, y1, x2, y2]) => ({
    x1: Number(x1),
    y1: Number(y1),
    x2: Number(x2),
    y2: Number(y2),
  }));
}
