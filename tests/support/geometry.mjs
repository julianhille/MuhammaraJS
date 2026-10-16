// Reads what a page paints, in page space: every painted path with its
// points after the `cm` transforms and form XObject placements that apply to
// it, every text show and every image, each with the graphics state it was
// painted in. A spec asserts on where and how a shape lands on the page, not
// on whether an end drew it inline or in a form XObject.
import { withReader } from "./pdf.mjs";

var IDENTITY = [1, 0, 0, 1, 0, 0];
var PAINT = new Set(["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"]);
var CLOSING_PAINT = new Set(["s", "b", "b*"]);
var DEVICE_SPACES = { g: "DeviceGray", rg: "DeviceRGB", k: "DeviceCMYK" };

/**
 * Multiply two PDF matrices, `m1 × m2`, so `m1` applies first.
 * @param {number[]} m1 - The first [a b c d e f] matrix.
 * @param {number[]} m2 - The second matrix.
 * @returns {number[]} The product.
 */
export function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

/**
 * Transform a point by a PDF matrix.
 * @param {number[]} matrix - The [a b c d e f] matrix.
 * @param {number} x - The x.
 * @param {number} y - The y.
 * @returns {number[]} The transformed [x, y].
 */
export function transform(matrix, x, y) {
  return [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ];
}

/**
 * Split a content stream into operands and operators. Strings become
 * `{string}`, names `{name}`, arrays and dictionaries nested arrays.
 * @param {string} text - The decoded content stream.
 * @returns {Array<{operator: string, operands: Array}>} The operations.
 */
function operations(text) {
  var result = [];
  var stack = [[]];
  var push = (value) => stack[stack.length - 1].push(value);
  var delimiter = /[\s()<>[\]{}/%]/;
  var i = 0;
  while (i < text.length) {
    var ch = text[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "%") {
      while (i < text.length && text[i] !== "\n" && text[i] !== "\r") i++;
    } else if (ch === "(") {
      var depth = 1;
      var start = ++i;
      while (i < text.length && depth > 0) {
        if (text[i] === "\\") i++;
        else if (text[i] === "(") depth++;
        else if (text[i] === ")") depth--;
        i++;
      }
      push({ string: text.slice(start, i - 1) });
    } else if (ch === "<" && text[i + 1] === "<") {
      stack.push([]);
      i += 2;
    } else if (ch === ">" && text[i + 1] === ">") {
      var dictionary = stack.pop();
      push(dictionary);
      i += 2;
    } else if (ch === "<") {
      var end = text.indexOf(">", i);
      push({ string: text.slice(i + 1, end) });
      i = end + 1;
    } else if (ch === "[") {
      stack.push([]);
      i++;
    } else if (ch === "]") {
      var array = stack.pop();
      push(array);
      i++;
    } else if (ch === "/") {
      var nameStart = ++i;
      while (i < text.length && !delimiter.test(text[i])) i++;
      push({ name: text.slice(nameStart, i) });
    } else {
      var tokenStart = i;
      while (i < text.length && !delimiter.test(text[i])) i++;
      if (i === tokenStart) i++;
      var token = text.slice(tokenStart, i);
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(token)) {
        push(Number(token));
      } else {
        result.push({ operator: token, operands: stack[0] });
        stack = [[]];
        if (token === "ID") {
          // Skip inline image data up to its EI.
          var match = /\sEI(?=\s|$)/g;
          match.lastIndex = i;
          var found = match.exec(text);
          i = found ? found.index + found[0].length : text.length;
        }
      }
    }
  }
  return result;
}

/**
 * Read the PDF objects of one page with the end's reader.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @returns {object} Helpers bound to that reader.
 */
function objects(end, reader) {
  var M = end.muhammara;
  var resolve = (object) =>
    object && object.getType() === M.ePDFObjectIndirectObjectReference
      ? reader.parseNewObject(
          object.toPDFIndirectObjectReference().getObjectID(),
        )
      : object;
  var text = (stream) => {
    var input = reader.startReadingFromStream(stream);
    var result = "";
    while (input.notEnded())
      result += Buffer.from(input.read(65536)).toString("latin1");
    return result;
  };
  var dictionaryOf = (object) => {
    object = resolve(object);
    if (!object) return null;
    return object.getType() === M.ePDFObjectStream
      ? object.toPDFStream().getDictionary()
      : object.toPDFDictionary();
  };
  var entry = (dictionary, key) =>
    dictionary ? resolve(reader.queryDictionaryObject(dictionary, key)) : null;
  var numbers = (array) =>
    array
      .toPDFArray()
      .toJSArray()
      .map((value) => resolve(value).value);
  return { M, resolve, text, dictionaryOf, entry, numbers };
}

/**
 * The family of a named color space resource, with the ink of a Separation.
 * @param {object} pdf - The reader helpers.
 * @param {object} resources - The resource dictionary in effect.
 * @param {string} name - The color space name.
 * @returns {string} Such as "DeviceRGB" or "Separation:SpotOrange".
 */
function colorSpaceName(pdf, resources, name) {
  if (DEVICE_SPACES[name] || /^Device/.test(name)) return name;
  var space = pdf.entry(pdf.entry(resources, "ColorSpace"), name);
  if (!space) return name;
  if (space.getType() === pdf.M.ePDFObjectName) return space.value;
  var parts = space
    .toPDFArray()
    .toJSArray()
    .map((part) => pdf.resolve(part));
  var family = parts[0].value;
  return family === "Separation" ? `${family}:${parts[1].value}` : family;
}

/**
 * The fill (`ca`) and stroke (`CA`) alpha an ExtGState resource sets.
 * @param {object} pdf - The reader helpers.
 * @param {object} resources - The resource dictionary in effect.
 * @param {string} name - The ExtGState name.
 * @returns {{fill?: number, stroke?: number}} The alphas it sets.
 */
function extGStateAlpha(pdf, resources, name) {
  var state = pdf.entry(pdf.entry(resources, "ExtGState"), name);
  var alpha = {};
  var fill = pdf.entry(state, "ca");
  var stroke = pdf.entry(state, "CA");
  if (fill) alpha.fill = fill.value;
  if (stroke) alpha.stroke = stroke.value;
  return alpha;
}

/**
 * Everything a page paints, in page space, in painting order.
 *
 * - paths: `{kind: "path", paint, points, anchors, ops, closed, lineWidth,
 *   lineCap, lineJoin, miterLimit, dash, fill, stroke, fillAlpha,
 *   strokeAlpha, ctm}`; `points` holds every point including Bézier control
 *   points, `anchors` only the segment end points, `ops` the segment
 *   operators (`m`, `l`, `c`, `re`), `paint` the painting operator (`S`,
 *   `f`, `B`, ...). Clipping paths ended with `n` are left out.
 * - text: `{kind: "text", fill, fillAlpha, ctm}` per text show operator.
 * - images: `{kind: "image", points, fillAlpha, ctm}`, `points` being the
 *   corners of the image's unit square.
 *
 * Every item also carries `clips`: the bounding boxes of the forms it is
 * drawn in, as page-space quadrilaterals; see `outsideClips()`.
 *
 * The returned array also carries `streams`: the decoded page content and
 * the content of each form XObject as it is drawn, one entry per stream.
 *
 * Colors are `{space, values}`, such as `{space: "DeviceRGB", values: [1, 0,
 * 0]}` or `{space: "Separation:Spot", values: [1]}`.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {object[]} The painted items.
 */
export function painted(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var pdf = objects(end, reader);
    var page = reader.parsePageDictionary(pageIndex);
    var items = [];
    // The decoded streams, page first, then each form as it is drawn.
    Object.defineProperty(items, "streams", { value: [] });
    var initial = {
      ctm: IDENTITY,
      lineWidth: 1,
      lineCap: 0,
      lineJoin: 0,
      miterLimit: 10,
      dash: [[], 0],
      fill: { space: "DeviceGray", values: [0] },
      stroke: { space: "DeviceGray", values: [0] },
      fillAlpha: 1,
      clips: [],
      strokeAlpha: 1,
    };
    var contents = pdf.entry(page, "Contents");
    var streams = !contents
      ? []
      : contents.getType() === pdf.M.ePDFObjectArray
        ? contents
            .toPDFArray()
            .toJSArray()
            .map((item) => pdf.resolve(item).toPDFStream())
        : [contents.toPDFStream()];
    run(
      pdf,
      streams.map((stream) => pdf.text(stream)).join("\n"),
      pdf.entry(page, "Resources"),
      initial,
      items,
      0,
    );
    return items;
  });
}

/**
 * Interpret one content stream, recursing into the form XObjects it draws.
 * @param {object} pdf - The reader helpers.
 * @param {string} content - The decoded content.
 * @param {object} resources - The resource dictionary in effect.
 * @param {object} start - The graphics state the stream starts in.
 * @param {object[]} items - Collects the painted items.
 * @param {number} depth - The form nesting depth.
 * @returns {void}
 */
function run(pdf, content, resources, start, items, depth) {
  items.streams.push(content);
  var state = { ...start };
  var saved = [];
  var path = [];
  var closed = false;
  var current = [0, 0];
  var add = (op, coordinates) => {
    var points = [];
    for (var index = 0; index < coordinates.length; index += 2)
      points.push(
        transform(state.ctm, coordinates[index], coordinates[index + 1]),
      );
    path.push({ op, points });
  };
  for (var { operator, operands } of operations(content)) {
    var o = operands;
    switch (operator) {
      case "q":
        saved.push(state);
        state = { ...state };
        break;
      case "Q":
        if (saved.length) state = saved.pop();
        break;
      case "cm":
        state.ctm = multiply(o, state.ctm);
        break;
      case "w":
        state.lineWidth = o[0];
        break;
      case "J":
        state.lineCap = o[0];
        break;
      case "j":
        state.lineJoin = o[0];
        break;
      case "M":
        state.miterLimit = o[0];
        break;
      case "d":
        state.dash = [o[0], o[1]];
        break;
      case "g":
      case "rg":
      case "k":
        state.fill = { space: DEVICE_SPACES[operator], values: o };
        break;
      case "G":
      case "RG":
      case "K":
        state.stroke = {
          space: DEVICE_SPACES[operator.toLowerCase()],
          values: o,
        };
        break;
      case "cs":
        state.fill = {
          space: colorSpaceName(pdf, resources, o[0].name),
          values: [],
        };
        break;
      case "CS":
        state.stroke = {
          space: colorSpaceName(pdf, resources, o[0].name),
          values: [],
        };
        break;
      case "sc":
      case "scn":
        state.fill = { ...state.fill, values: o };
        break;
      case "SC":
      case "SCN":
        state.stroke = { ...state.stroke, values: o };
        break;
      case "gs": {
        var alpha = extGStateAlpha(pdf, resources, o[0].name);
        if (alpha.fill !== undefined) state.fillAlpha = alpha.fill;
        if (alpha.stroke !== undefined) state.strokeAlpha = alpha.stroke;
        break;
      }
      case "m":
        add("m", o);
        current = [o[0], o[1]];
        break;
      case "l":
        add("l", o);
        current = [o[0], o[1]];
        break;
      case "c":
        add("c", o);
        current = [o[4], o[5]];
        break;
      case "v":
        add("c", [current[0], current[1], ...o]);
        current = [o[2], o[3]];
        break;
      case "y":
        add("c", [o[0], o[1], o[2], o[3], o[2], o[3]]);
        current = [o[2], o[3]];
        break;
      case "re": {
        var [x, y, w, h] = o;
        add("re", [x, y, x + w, y, x + w, y + h, x, y + h]);
        current = [x, y];
        closed = true;
        break;
      }
      case "h":
        closed = true;
        break;
      case "Tj":
      case "TJ":
      case "'":
      case '"':
        items.push({
          kind: "text",
          fill: state.fill,
          fillAlpha: state.fillAlpha,
          ctm: state.ctm,
          clips: state.clips,
        });
        break;
      case "Do":
        draw(pdf, resources, o[0].name, state, items, depth);
        break;
      default:
        if (PAINT.has(operator)) {
          if (operator !== "n" && path.length) {
            var points = path.flatMap((segment) => segment.points);
            items.push({
              kind: "path",
              paint: operator,
              points,
              anchors: path.flatMap((segment) =>
                segment.op === "c" ? [segment.points[2]] : segment.points,
              ),
              ops: path.map((segment) => segment.op),
              closed: closed || CLOSING_PAINT.has(operator),
              lineWidth: state.lineWidth,
              lineCap: state.lineCap,
              lineJoin: state.lineJoin,
              miterLimit: state.miterLimit,
              dash: state.dash,
              fill: state.fill,
              stroke: state.stroke,
              fillAlpha: state.fillAlpha,
              strokeAlpha: state.strokeAlpha,
              ctm: state.ctm,
              clips: state.clips,
            });
          }
          path = [];
          closed = false;
        }
    }
  }
}

/**
 * Paint an XObject: recurse into a form, record an image.
 * @param {object} pdf - The reader helpers.
 * @param {object} resources - The resource dictionary in effect.
 * @param {string} name - The XObject name.
 * @param {object} state - The graphics state at the `Do`.
 * @param {object[]} items - Collects the painted items.
 * @param {number} depth - The form nesting depth.
 * @returns {void}
 */
function draw(pdf, resources, name, state, items, depth) {
  var object = pdf.entry(pdf.entry(resources, "XObject"), name);
  if (!object || object.getType() !== pdf.M.ePDFObjectStream) return;
  var stream = object.toPDFStream();
  var dictionary = stream.getDictionary();
  var subtype = pdf.entry(dictionary, "Subtype").value;
  if (subtype === "Image") {
    items.push({
      kind: "image",
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([x, y]) => transform(state.ctm, x, y)),
      fillAlpha: state.fillAlpha,
      ctm: state.ctm,
      clips: state.clips,
    });
    return;
  }
  if (subtype !== "Form" || depth > 32) return;
  var matrix = pdf.entry(dictionary, "Matrix");
  var ctm = matrix ? multiply(pdf.numbers(matrix), state.ctm) : state.ctm;
  // A form clips what it draws to its bounding box.
  var box = pdf.entry(dictionary, "BBox");
  var clips = state.clips;
  if (box) {
    var [x1, y1, x2, y2] = pdf.numbers(box);
    clips = [
      ...clips,
      [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ].map(([x, y]) => transform(ctm, x, y)),
    ];
  }
  run(
    pdf,
    pdf.text(stream),
    pdf.entry(dictionary, "Resources") || resources,
    { ...state, ctm, clips },
    items,
    depth + 1,
  );
}

/**
 * The painted paths of a page, see `painted()`.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {object[]} The paths.
 */
export function paths(end, bytes, pageIndex = 0) {
  return painted(end, bytes, pageIndex).filter((item) => item.kind === "path");
}

/**
 * Whether a path fills (`f`, `F`, `f*`, `B`, `B*`, `b`, `b*`).
 * @param {object} path - A painted path.
 * @returns {boolean} True when it fills.
 */
export function fills(path) {
  return /^[fFbB]/.test(path.paint);
}

/**
 * Whether a path strokes (`S`, `s`, `B`, `B*`, `b`, `b*`).
 * @param {object} path - A painted path.
 * @returns {boolean} True when it strokes.
 */
export function strokes(path) {
  return /^[SsBb]/.test(path.paint);
}

/**
 * The bounding box of points, rounded to 1/1000 pt.
 * @param {number[][]} points - [x, y] points.
 * @returns {{left: number, bottom: number, right: number, top: number}} The box.
 */
export function bounds(points) {
  var round = (value) => Math.round(value * 1000) / 1000 + 0;
  var xs = points.map((point) => point[0]);
  var ys = points.map((point) => point[1]);
  return {
    left: round(Math.min(...xs)),
    bottom: round(Math.min(...ys)),
    right: round(Math.max(...xs)),
    top: round(Math.max(...ys)),
  };
}

/**
 * Round every coordinate of points to 1/1000 pt, for deep comparisons.
 * @param {number[][]} points - [x, y] points.
 * @returns {number[][]} The rounded points.
 */
export function rounded(points) {
  return points.map((point) =>
    point.map((value) => Math.round(value * 1000) / 1000 + 0),
  );
}

/**
 * Turn a point clockwise on the page (PDF y up) around a pivot.
 * @param {number[]} point - The [x, y] point in PDF coordinates.
 * @param {number[]} pivot - The [x, y] pivot in PDF coordinates.
 * @param {number} degrees - The clockwise angle.
 * @returns {number[]} The turned point.
 */
export function clockwise(point, pivot, degrees) {
  var radians = (degrees * Math.PI) / 180;
  var dx = point[0] - pivot[0];
  var dy = point[1] - pivot[1];
  return [
    pivot[0] + dx * Math.cos(radians) + dy * Math.sin(radians),
    pivot[1] - dx * Math.sin(radians) + dy * Math.cos(radians),
  ];
}

/**
 * The points of a painted item that the bounding box of an enclosing form
 * clips away, so a spec can assert that a shape is shown whole.
 * @param {object} item - A painted path or image.
 * @param {number} [tolerance=0.001] - How far outside still counts as inside.
 * @returns {number[][]} The clipped points; empty when all are visible.
 */
export function outsideClips(item, tolerance = 0.001) {
  return item.points.filter((point) =>
    item.clips.some((corners) => {
      // Inside a convex quadrilateral, the point is on the same side of
      // every edge.
      var sides = corners.map((corner, index) => {
        var next = corners[(index + 1) % corners.length];
        var length = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
        return (
          ((next[0] - corner[0]) * (point[1] - corner[1]) -
            (next[1] - corner[1]) * (point[0] - corner[0])) /
          (length || 1)
        );
      });
      return !(
        sides.every((side) => side >= -tolerance) ||
        sides.every((side) => side <= tolerance)
      );
    }),
  );
}
