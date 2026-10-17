// Reads the text runs a page draws, where it draws them, for the flow and
// HTML specs: every run in drawing order, with its origin on the page, its
// fill color and font size, wherever an end put it (page content or a form
// XObject, with or without a transformation).
import { writeOutput } from "./ends.mjs";
import { withReader } from "./pdf.mjs";

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
 * Split content into operands and operators. Strings become
 * `{ string }`, names `{ name }`, arrays nested arrays.
 * @param {string} content - Decoded content.
 * @returns {Array<*>} The tokens.
 */
function tokenize(content) {
  var tokens = [];
  var stack = [tokens];
  var index = 0;
  /**
   * Add a token to the innermost open array.
   * @param {*} token - The token.
   * @returns {number} The array's new length.
   */
  var push = (token) => stack[stack.length - 1].push(token);
  while (index < content.length) {
    var char = content[index];
    if (/\s/.test(char)) {
      index++;
    } else if (char === "%") {
      while (index < content.length && !/[\r\n]/.test(content[index])) index++;
    } else if (char === "(") {
      var depth = 1;
      var value = "";
      index++;
      while (index < content.length && depth > 0) {
        char = content[index++];
        if (char === "\\") {
          var next = content[index++];
          var octal = /^[0-7]{1,3}/.exec(content.slice(index - 1, index + 2));
          if (octal) {
            value += String.fromCharCode(parseInt(octal[0], 8));
            index += octal[0].length - 1;
          } else {
            value +=
              { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[next] ?? next;
          }
        } else if (char === "(") {
          depth++;
          value += char;
        } else if (char === ")") {
          if (--depth) value += char;
        } else {
          value += char;
        }
      }
      push({ string: value });
    } else if (char === "<" && content[index + 1] !== "<") {
      var end = content.indexOf(">", index);
      var hex = content.slice(index + 1, end).replace(/\s/g, "");
      push({ string: Buffer.from(hex, "hex").toString("latin1") });
      index = end + 1;
    } else if (char === "[") {
      var array = [];
      push(array);
      stack.push(array);
      index++;
    } else if (char === "]") {
      stack.pop();
      index++;
    } else if (char === "/") {
      var name = /^\/[^\s/[\]()<>]*/.exec(content.slice(index))[0];
      push({ name: name.slice(1) });
      index += name.length;
    } else {
      var word = /^[^\s/[\]()<>%]+/.exec(content.slice(index));
      if (!word) {
        // Dictionaries only appear in inline images and marked content.
        index++;
        continue;
      }
      push(isNaN(Number(word[0])) ? { operator: word[0] } : Number(word[0]));
      index += word[0].length;
    }
  }
  return tokens;
}

/**
 * Multiply two PDF matrices: first `a`, then `b`.
 * @param {number[]} a - The inner matrix.
 * @param {number[]} b - The outer matrix.
 * @returns {number[]} The product.
 */
function multiply(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/**
 * Read a ToUnicode CMap into a map from character code to text.
 * @param {string} cmap - The decoded CMap stream.
 * @returns {Map<string, string>} Hex code (upper case) to text.
 */
function readCMap(cmap) {
  var map = new Map();
  /**
   * Decode a CMap destination.
   * @param {string} hex - UTF-16BE hex digits.
   * @returns {string} The text.
   */
  var text = (hex) => Buffer.from(hex, "hex").swap16().toString("utf16le");
  for (var block of cmap.matchAll(/beginbfchar([^]*?)endbfchar/g)) {
    for (var pair of block[1].matchAll(/<(\w+)>\s*<(\w+)>/g))
      map.set(pair[1].toUpperCase(), text(pair[2]));
  }
  for (var block of cmap.matchAll(/beginbfrange([^]*?)endbfrange/g)) {
    for (var range of block[1].matchAll(
      /<(\w+)>\s*<(\w+)>\s*(?:<(\w+)>|\[([^\]]*)\])/g,
    )) {
      var low = parseInt(range[1], 16);
      var high = parseInt(range[2], 16);
      var width = range[1].length;
      var listed = range[4] && [...range[4].matchAll(/<(\w+)>/g)];
      for (var code = low; code <= high; code++) {
        var key = code.toString(16).toUpperCase().padStart(width, "0");
        if (listed) {
          map.set(key, text(listed[code - low][1]));
        } else {
          var start = Buffer.from(range[3], "hex");
          start.writeUInt16BE(
            start.readUInt16BE(start.length - 2) + code - low,
            start.length - 2,
          );
          map.set(key, text(start.toString("hex")));
        }
      }
    }
  }
  return map;
}

/**
 * Round away floating point noise from composing matrices.
 * @param {number} value - A coordinate.
 * @returns {number} The coordinate to six decimals.
 */
function round(value) {
  return Math.round(value * 1e6) / 1e6 + 0;
}

/**
 * The text runs and filled rectangles a page draws, in drawing order.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {{runs: Array<{text: string, x: number, y: number, color: string,
 *   size: number, matrix: number[]}>, rects: Array<{x: number, y: number,
 *   width: number, height: number}>}} Runs with their origin on the page,
 *   the fill color operands as written and the font size; rectangles with
 *   their page bounding box.
 */
export function drawn(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var runs = [];
    var rects = [];
    /**
     * Interpret one content stream.
     * @param {string} content - The decoded content.
     * @param {object} resources - Its resource dictionary.
     * @param {object} start - The graphics state it starts with.
     * @returns {void}
     */
    var run = (content, resources, start) => {
      var state = { ...start };
      var saved = [];
      var operands = [];
      var textMatrix = [1, 0, 0, 1, 0, 0];
      for (var token of tokenize(content)) {
        if (!token || token.operator === undefined) {
          operands.push(token);
          continue;
        }
        var op = token.operator;
        if (op === "q") saved.push({ ...state });
        else if (op === "Q") state = saved.pop() || state;
        else if (op === "cm") state.ctm = multiply(operands, state.ctm);
        else if (op === "rg") state.color = operands.join(" ");
        else if (op === "Tf") {
          state.size = operands[1];
          state.decode = decoder(resources, operands[0].name);
        } else if (op === "BT") textMatrix = [1, 0, 0, 1, 0, 0];
        else if (op === "Tm") textMatrix = operands.slice(0, 6);
        else if (op === "Td" || op === "TD")
          textMatrix = multiply(
            [1, 0, 0, 1, operands[0], operands[1]],
            textMatrix,
          );
        else if (op === "Tj" || op === "TJ" || op === "'" || op === '"') {
          var shown = operands[operands.length - 1];
          var text = state.decode(
            Array.isArray(shown)
              ? shown.map((part) => part.string ?? "").join("")
              : shown.string,
          );
          var matrix = multiply(textMatrix, state.ctm).map(round);
          runs.push({
            text,
            x: matrix[4],
            y: matrix[5],
            color: state.color,
            size: state.size,
            matrix,
          });
        } else if (op === "re") {
          var [x, y, w, h] = operands;
          var corners = [
            [x, y],
            [x + w, y],
            [x, y + h],
            [x + w, y + h],
          ].map(([cx, cy]) => [
            cx * state.ctm[0] + cy * state.ctm[2] + state.ctm[4],
            cx * state.ctm[1] + cy * state.ctm[3] + state.ctm[5],
          ]);
          var xs = corners.map((corner) => corner[0]);
          var ys = corners.map((corner) => corner[1]);
          rects.push({
            x: round(Math.min(...xs)),
            y: round(Math.min(...ys)),
            width: round(Math.max(...xs) - Math.min(...xs)),
            height: round(Math.max(...ys) - Math.min(...ys)),
          });
        } else if (op === "Do") {
          var form = xobject(resources, operands[0].name);
          if (form) {
            var dictionary = form.getDictionary();
            var formMatrix = reader.queryDictionaryObject(dictionary, "Matrix");
            var ctm = formMatrix
              ? multiply(
                  formMatrix
                    .toPDFArray()
                    .toJSArray()
                    .map((item) => item.value),
                  state.ctm,
                )
              : state.ctm;
            run(
              streamText(reader, form),
              reader.queryDictionaryObject(dictionary, "Resources"),
              { ...state, ctm },
            );
          }
        }
        operands = [];
      }
    };
    /**
     * A form XObject of a resource dictionary.
     * @param {object} resources - The resources.
     * @param {string} name - The XObject name.
     * @returns {object|null} The form stream, or null.
     */
    var xobject = (resources, name) => {
      resources = resolve(end, reader, resources);
      var xobjects =
        resources &&
        resolve(
          end,
          reader,
          reader.queryDictionaryObject(resources, "XObject"),
        );
      var stream =
        xobjects &&
        resolve(end, reader, reader.queryDictionaryObject(xobjects, name));
      if (!stream || stream.getType() !== end.muhammara.ePDFObjectStream)
        return null;
      stream = stream.toPDFStream();
      var subtype = reader.queryDictionaryObject(
        stream.getDictionary(),
        "Subtype",
      );
      return subtype && subtype.value === "Form" ? stream : null;
    };
    /**
     * How to read the strings a font shows: two-byte codes through its
     * ToUnicode CMap for a composite font, bytes as latin1 otherwise.
     * @param {object} resources - The resources.
     * @param {string} name - The font resource name.
     * @returns {function(string): string} The decoder.
     */
    var decoder = (resources, name) => {
      resources = resolve(end, reader, resources);
      var fonts =
        resources &&
        resolve(end, reader, reader.queryDictionaryObject(resources, "Font"));
      var font =
        fonts &&
        resolve(end, reader, reader.queryDictionaryObject(fonts, name));
      var subtype = font && reader.queryDictionaryObject(font, "Subtype");
      var cmap = font && reader.queryDictionaryObject(font, "ToUnicode");
      if (!subtype || subtype.value !== "Type0" || !cmap) return (text) => text;
      var map = readCMap(
        streamText(reader, resolve(end, reader, cmap).toPDFStream()),
      );
      return (text) => {
        var hex = Buffer.from(text, "latin1").toString("hex").toUpperCase();
        var decoded = "";
        for (var index = 0; index < hex.length; index += 4)
          decoded += map.get(hex.slice(index, index + 4)) ?? "\ufffd";
        return decoded;
      };
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
    run(
      streams.map((stream) => streamText(reader, stream)).join("\n"),
      reader.queryDictionaryObject(page, "Resources"),
      {
        ctm: [1, 0, 0, 1, 0, 0],
        color: undefined,
        size: undefined,
        decode: (text) => text,
      },
    );
    return { runs, rects };
  });
}

/**
 * The text runs a page draws, in drawing order.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{text: string, x: number, y: number, color: string,
 *   size: number, matrix: number[]}>} The runs.
 */
export function drawnRuns(end, bytes, pageIndex = 0) {
  return drawn(end, bytes, pageIndex).runs;
}

/**
 * Draw on one 400 x 400 page, write the PDF for review and return its runs.
 * @param {object} end - The end.
 * @param {string} name - Output file name without extension.
 * @param {function(object): void} draw - Draws on the page.
 * @returns {Array<{text: string, x: number, y: number, color: string,
 *   size: number}>} The drawn runs.
 */
export function drawRuns(end, name, draw) {
  var recipe = end.newRecipe().createPage(400, 400);
  draw(recipe);
  var bytes = recipe.endPage().endPDF();
  writeOutput(end, name, bytes);
  return drawnRuns(end, bytes);
}

/**
 * Where the run after a run starts: at its right edge, plus the width of an
 * "o" when it ends with a space.
 * @param {object} recipe - Recipe that measures.
 * @param {string} text - The run before.
 * @param {object} options - Its options.
 * @returns {number} The distance between the two runs' starts.
 */
export function runAdvance(recipe, text, options) {
  return (
    recipe.textDimensions(text, options).xMax +
    (text.endsWith(" ") ? recipe.textDimensions("o", options).width : 0)
  );
}

/**
 * Group runs into rows of one baseline, top to bottom, each row's runs left
 * to right.
 * @param {Array<{text: string, x: number, y: number}>} runs - The runs.
 * @returns {Array<{y: number, text: string}>} The rows with their joined
 *   text, untrimmed.
 */
export function rows(runs) {
  var grouped = [];
  runs.forEach((item) => {
    var row = grouped.find((candidate) => Math.abs(candidate.y - item.y) < 1);
    if (row) row.parts.push(item);
    else grouped.push({ y: item.y, parts: [item] });
  });
  return grouped
    .sort((a, b) => b.y - a.y)
    .map((row) => ({
      y: row.y,
      text: row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(""),
    }));
}

/**
 * Render HTML with Arial 12 in a 300-point box, write the PDF for review and
 * return its visual lines, top to bottom, trimmed. A first page holding
 * "x<br>x" gives the first line's position and the line pitch, so skipped
 * pitches, including leading ones, become blank "" lines.
 * @param {object} end - The end.
 * @param {string} html - HTML to render.
 * @param {string} name - Output file name without extension.
 * @param {object} [options] - Extra text options.
 * @returns {string[]} The rendered lines.
 */
export function renderLines(end, html, name, options = {}) {
  var text = { font: "arial", size: 12, html: true, textBox: { width: 300 } };
  var bytes = end
    .newRecipe()
    .createPage(400, 400)
    .text("x<br>x", 20, 20, text)
    .endPage()
    .createPage(400, 400)
    .text(html, 20, 20, { ...text, ...options })
    .endPage()
    .endPDF();
  writeOutput(end, name, bytes);
  var [first, second] = rows(drawnRuns(end, bytes, 0));
  var pitch = first.y - second.y;
  var lines = [];
  var previous = first.y + pitch;
  rows(drawnRuns(end, bytes, 1)).forEach((row) => {
    var skipped = Math.round((previous - row.y) / pitch) - 1;
    for (var blank = 0; blank < skipped; blank++) lines.push("");
    lines.push(row.text.trim());
    previous = row.y;
  });
  return lines;
}
