// Walks a page's content through its form XObjects and reports where images,
// placed PDF pages, and rectangle paths land on the page. The Wasm Recipe
// tests use the same walker (packages/wasm/tests/recipe/image-placement.mjs),
// so both ends assert the same numbers although they nest their XObjects
// differently.
var muhammara = require("@muhammara/native-with-source");

/**
 * Multiplies two PDF matrices: `m` applied first, then `n`.
 * @param {number[]} m - First [a, b, c, d, e, f] matrix.
 * @param {number[]} n - Second matrix.
 * @returns {number[]} The product.
 */
function multiply(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

/**
 * Maps the corners of a box through a matrix, rounded to hundredths.
 * @param {number[]} m - The matrix.
 * @param {number[]} box - [left, bottom, right, top].
 * @returns {number[][]} Bottom-left, bottom-right, top-right, top-left.
 */
function corners(m, box) {
  return [
    [box[0], box[1]],
    [box[2], box[1]],
    [box[2], box[3]],
    [box[0], box[3]],
  ].map(([x, y]) =>
    [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]].map(round),
  );
}

/**
 * Rounds to hundredths, without negative zero.
 * @param {number} value - The value.
 * @returns {number} The rounded value.
 */
function round(value) {
  return Math.round(value * 100) / 100 + 0;
}

/**
 * Reads a stream's decoded bytes as latin1 text.
 * @param {object} reader - The PDF reader.
 * @param {object} stream - The PDF stream.
 * @returns {string} The content.
 */
function streamText(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  var bytes = [];
  while (input.notEnded()) bytes.push(...input.read(4096));
  return Buffer.from(bytes).toString("latin1");
}

/**
 * Reads the numbers of a PDF array.
 * @param {object} array - The PDF array object.
 * @returns {number[]} Its values.
 */
function numbers(array) {
  return array
    .toPDFArray()
    .toJSArray()
    .map((item) => item.value);
}

/**
 * Resolves a named entry of a resource category, such as an XObject.
 * @param {object} reader - The PDF reader.
 * @param {object} resources - The resources dictionary.
 * @param {string} category - The category key.
 * @param {string} name - The resource name.
 * @returns {object} The resolved object.
 */
function resource(reader, resources, category, name) {
  var dictionary = reader
    .queryDictionaryObject(resources, category)
    .toPDFDictionary();
  return reader.queryDictionaryObject(dictionary, name);
}

// Device color operators and the color space they select; a lowercase
// operator sets the fill color, an uppercase one the stroke color.
var COLOR_OPERATORS = {
  g: "gray",
  G: "gray",
  rg: "rgb",
  RG: "rgb",
  k: "cmyk",
  K: "cmyk",
};

/**
 * Walks one content stream, appending placements to `out`.
 * @param {object} reader - The PDF reader.
 * @param {string} content - The content stream text.
 * @param {object} resources - The resources dictionary.
 * @param {object} inherited - The graphics state the content starts with:
 *   `ctm`, line width, cap, join, dash, and fill and stroke color and opacity.
 * @param {object} context - Page boxes and the output list.
 * @param {boolean} inPage - Whether this content belongs to a placed page.
 * @returns {void}
 */
function walk(reader, content, resources, inherited, context, inPage) {
  var tokens =
    content.match(
      /\((?:\\.|[^\\()])*\)|<[\dA-Fa-f\s]*>|\/[^\s/[\]<>()]+|[-+]?(?:\d+\.?\d*|\.\d+)|[A-Za-z'"*]+|\[|\]/g,
    ) || [];
  // A form XObject starts with the graphics state it is drawn in.
  var state = { ...inherited };
  var saved = [];
  var operands = [];
  var rectangle = null;
  tokens.forEach((token) => {
    // Strings, hex strings, names, numbers, and array brackets are operands.
    if (/^[-+/.\d[\]<(]/.test(token)) {
      operands.push(token);
      return;
    }
    var values = operands.filter((value) => !/[[\]/<(]/.test(value[0]));
    if (token === "q") saved.push({ ...state });
    else if (token === "Q") state = saved.pop();
    else if (token === "cm")
      state.ctm = multiply(values.slice(-6).map(Number), state.ctm);
    else if (token === "w") state.lineWidth = Number(values[0]);
    else if (COLOR_OPERATORS[token])
      state[token === token.toLowerCase() ? "fillColor" : "strokeColor"] = {
        space: COLOR_OPERATORS[token],
        values: values.map((value) => Math.round(Number(value) * 1000) / 1000),
      };
    else if (token === "J") state.cap = Number(values[0]);
    else if (token === "j") state.join = Number(values[0]);
    else if (token === "d") {
      state.dash = values.slice(0, -1).map(Number);
    } else if (token === "gs") {
      var gs = resource(reader, resources, "ExtGState", operands[0].slice(1));
      var alphas = gs.toPDFDictionary();
      if (alphas.exists("ca"))
        state.fillOpacity = alphas.queryObject("ca").value;
      if (alphas.exists("CA"))
        state.strokeOpacity = alphas.queryObject("CA").value;
    } else if (token === "re") {
      var [x, y, width, height] = values.slice(-4).map(Number);
      rectangle = [x, y, x + width, y + height];
    } else if (/^(f|f\*|S)$/.test(token) && rectangle) {
      if (!inPage && token === "S")
        context.out.push({
          kind: "stroke",
          corners: corners(state.ctm, rectangle),
          lineWidth: round(state.lineWidth),
          cap: state.cap,
          join: state.join,
          dash: state.dash,
          color: state.strokeColor,
          opacity: state.strokeOpacity,
        });
      else if (!inPage)
        context.out.push({
          kind: "fill",
          corners: corners(state.ctm, rectangle),
          color: state.fillColor,
          opacity: state.fillOpacity,
        });
      rectangle = null;
    } else if (token === "Do") {
      var xObject = resource(
        reader,
        resources,
        "XObject",
        operands[0].slice(1),
      );
      var dictionary = xObject.toPDFStream().getDictionary();
      if (dictionary.queryObject("Subtype").value === "Image") {
        if (!inPage)
          context.out.push({
            kind: "image",
            corners: corners(state.ctm, [0, 0, 1, 1]),
            opacity: state.fillOpacity,
          });
      } else {
        var matrix = dictionary.exists("Matrix")
          ? numbers(dictionary.queryObject("Matrix"))
          : [1, 0, 0, 1, 0, 0];
        var inner = multiply(matrix, state.ctm);
        var box = numbers(dictionary.queryObject("BBox"));
        var isPage = context.pageBoxes.some(
          (pageBox) => pageBox.join() === box.join(),
        );
        if (isPage && !inPage)
          context.out.push({
            kind: "page",
            corners: corners(inner, box),
            opacity: state.fillOpacity,
          });
        walk(
          reader,
          streamText(reader, xObject.toPDFStream()),
          dictionary.exists("Resources")
            ? reader.queryDictionaryObject(dictionary, "Resources")
            : resources,
          { ...state, ctm: inner },
          context,
          inPage || isPage,
        );
      }
    }
    operands = [];
  });
}

/**
 * Lists where a page draws images, placed PDF pages, and rectangles.
 * A form XObject whose BBox equals one of `pageBoxes` is a placed PDF page;
 * its own content is not listed. Native wraps each image in a form of the
 * drawn size, so keep drawn sizes different from the page boxes.
 * @param {Uint8Array} bytes - The PDF bytes.
 * @param {object} [options] - Walk options.
 * @param {number} [options.pageIndex=0] - The page to walk.
 * @param {number[][]} [options.pageBoxes=[]] - BBoxes of placed PDF pages.
 * @returns {object[]} Placements in drawing order, with page-space corners.
 */
function imagePlacements(bytes, { pageIndex = 0, pageBoxes = [] } = {}) {
  var reader = muhammara.createReader(
    new muhammara.PDFRStreamForBuffer(Buffer.from(bytes)),
  );
  try {
    var page = reader.parsePage(pageIndex).getDictionary().toPDFDictionary();
    var resources = reader.queryDictionaryObject(page, "Resources");
    // A page that draws nothing may have no content stream at all.
    if (!page.exists("Contents")) return [];
    var contents = reader.queryDictionaryObject(page, "Contents");
    var streams =
      contents.getType() === muhammara.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((entry) =>
              reader
                .parseNewObject(
                  entry.toPDFIndirectObjectReference().getObjectID(),
                )
                .toPDFStream(),
            )
        : [contents.toPDFStream()];
    var context = { pageBoxes, out: [] };
    walk(
      reader,
      streams.map((stream) => streamText(reader, stream)).join("\n"),
      resources,
      {
        ctm: [1, 0, 0, 1, 0, 0],
        lineWidth: 1,
        cap: 0,
        join: 0,
        dash: [],
        fillOpacity: 1,
        strokeOpacity: 1,
        fillColor: { space: "gray", values: [0] },
        strokeColor: { space: "gray", values: [0] },
      },
      context,
      false,
    );
    return context.out;
  } finally {
    reader.end();
  }
}

/**
 * Counts the distinct placed-page form XObjects a page's resources name,
 * directly or through the forms it draws.
 * @param {Uint8Array} bytes - The PDF bytes.
 * @param {number[][]} pageBoxes - BBoxes of placed PDF pages.
 * @returns {number} The number of distinct page forms.
 */
function placedPageForms(bytes, pageBoxes) {
  var reader = muhammara.createReader(
    new muhammara.PDFRStreamForBuffer(Buffer.from(bytes)),
  );
  var ids = new Set();
  try {
    for (var id = 1; id < reader.getXrefSize(); id++) {
      var object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      var dictionary = object.toPDFStream().getDictionary();
      var box = dictionary.exists("BBox")
        ? numbers(dictionary.queryObject("BBox")).join()
        : "";
      if (pageBoxes.some((pageBox) => pageBox.join() === box)) ids.add(id);
    }
    return ids.size;
  } finally {
    reader.end();
  }
}

module.exports = { imagePlacements, placedPageForms };
