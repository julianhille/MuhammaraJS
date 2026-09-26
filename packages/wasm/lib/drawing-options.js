import { DeviceColorSpace, DrawingPathType } from "./value-sets.js";

/**
 * Rejects overflowing derived geometry before any operator is emitted.
 * @param {number[]} values - Derived coordinates.
 * @returns {void}
 * @throws {TypeError} If a value is not finite.
 */
export function validateDrawingGeometry(values) {
  if (!values.every(Number.isFinite))
    throw new TypeError("Drawing geometry must be finite");
}

/**
 * Reads each path coordinate once, before validation and output.
 * @param {Iterable<number[]>} points - Coordinate pairs.
 * @returns {Array} Copies of the points.
 */
export function snapshotDrawingPoints(points) {
  return Array.from(points, function (point) {
    return Array.isArray(point) ? Array.from(point) : point;
  });
}

/** Snapshot color conversion before a content context emits any operators. */
function readColor(options, colorValue) {
  var value = options.color;
  if (value === undefined) return {};
  var color = colorValue(value) >>> 0;
  var colorspace = options.colorspace || DeviceColorSpace.RGB;
  if (!Object.values(DeviceColorSpace).includes(colorspace)) {
    throw new TypeError("colorspace must be rgb, gray, or cmyk");
  }
  return { color, colorspace };
}

/** Read all path options before geometry or graphics state is written. */
export function readDrawingOptions(
  options,
  colorValue,
  widthError = "w requires finite numeric arguments",
) {
  options = options || {};
  var setupType = options.type;
  var stroke = setupType === undefined || setupType === DrawingPathType.STROKE;
  var color = readColor(options, colorValue);
  var width = stroke ? options.width : undefined;
  if (width !== undefined && !Number.isFinite(width)) {
    throw new TypeError(widthError);
  }
  // Preserve the second getter read, but do not turn an explicit null into stroke.
  var type = options.type;
  if (type === undefined) type = DrawingPathType.STROKE;
  var close = Boolean(options.close);
  return { ...color, width, type, close, stroke };
}

/** Finish a validated path; clipping ends the path without painting it. */
export function finishDrawingPath(context, options) {
  if (options.type === DrawingPathType.CLIP) {
    if (options.close) context.h();
    return context.W().n();
  }
  if (options.type === DrawingPathType.FILL) return context.f();
  if (options.type === DrawingPathType.STROKE) {
    return options.close ? context.s() : context.S();
  }
  return context.n();
}

/** Snapshot text options, including underline accessors, before BT. */
export function readTextOptions(options, colorValue) {
  if (!options || typeof options !== "object") return options;
  var font = options.font;
  var size = options.size;
  var color = readColor(options, colorValue);
  var underline = Boolean(options.underline);
  return { ...color, font, size, underline };
}

/**
 * Emit the fill or stroke color from snapshotted drawing options.
 * @param {object} context - Content context receiving the color operator.
 * @param {object} options - Options read by readDrawingOptions or readTextOptions.
 * @param {boolean} stroke - Whether to set the stroking color instead of the fill color.
 * @returns {void}
 */
export function applyDrawingColor(context, options, stroke) {
  if (!options || options.color === undefined) return;
  var color = options.color;
  if (options.colorspace === DeviceColorSpace.GRAY) {
    var gray = (color & 0xff) / 255;
    if (stroke) context.G(gray);
    else context.g(gray);
    return;
  }
  if (options.colorspace === DeviceColorSpace.CMYK) {
    var components = [
      ((color >> 24) & 0xff) / 255,
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    ];
    if (stroke) context.K(...components);
    else context.k(...components);
    return;
  }
  var red = ((color >> 16) & 0xff) / 255;
  var green = ((color >> 8) & 0xff) / 255;
  var blue = (color & 0xff) / 255;
  if (stroke) context.RG(red, green, blue);
  else context.rg(red, green, blue);
}

/**
 * Rejects an operand outside a PDF operator's integer range.
 * @param {string} name - Operator name for the error message.
 * @param {*} value - Operand to check.
 * @param {number} max - Largest allowed value; the smallest is 0.
 * @param {string} label - What the operand selects, for the error message.
 * @returns {void}
 * @throws {TypeError} If `value` is not an integer.
 * @throws {RangeError} If `value` is below 0 or above `max`.
 */
export function checkOperatorRange(name, value, max, label) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} requires integer numeric arguments`);
  }
  if (value < 0 || value > max) {
    throw new RangeError(`${name} requires a ${label} from 0 to ${max}`);
  }
}

/**
 * Install drawRectangle, drawSquare, drawCircle, and drawPath on a content
 * context. Color and line width are set before the path is constructed,
 * because PDF forbids graphics-state operators inside a path object.
 * @param {object} context - Content context to extend.
 * @param {function(*): number} colorValue - Converts a color option to a number.
 * @returns {void}
 */
export function installDrawingHelpers(context, colorValue) {
  /** Set color and width, emit the path, and paint it. */
  function drawWithOptions(options, emitPath) {
    applyDrawingColor(context, options, options.stroke);
    if (options.stroke && options.width !== undefined) context.w(options.width);
    emitPath();
    return finishDrawingPath(context, options);
  }

  context.drawRectangle = function (x, y, width, height, options) {
    if (![x, y, width, height].every(Number.isFinite)) {
      throw new TypeError("drawRectangle requires four finite coordinates");
    }
    options = readDrawingOptions(options, colorValue);
    return drawWithOptions(options, () => context.re(x, y, width, height));
  };
  context.drawSquare = function (x, y, edge, options) {
    if (![x, y, edge].every(Number.isFinite)) {
      throw new TypeError("drawSquare requires three finite coordinates");
    }
    return context.drawRectangle(x, y, edge, edge, options);
  };
  context.drawCircle = function (x, y, radius, options) {
    if (![x, y, radius].every(Number.isFinite)) {
      throw new TypeError("drawCircle requires three finite coordinates");
    }
    options = readDrawingOptions(options, colorValue);
    var control = radius * 0.5522847498307936;
    validateDrawingGeometry([x + radius, x - radius, y + radius, y - radius]);
    return drawWithOptions(options, () =>
      context
        .m(x + radius, y)
        .c(x + radius, y + control, x + control, y + radius, x, y + radius)
        .c(x - control, y + radius, x - radius, y + control, x - radius, y)
        .c(x - radius, y - control, x - control, y - radius, x, y - radius)
        .c(x + control, y - radius, x + radius, y - control, x + radius, y),
    );
  };
  context.drawPath = function (...args) {
    var points;
    var options;
    if (Array.isArray(args[0])) {
      if (args.length > 2) {
        throw new TypeError(
          "drawPath accepts coordinate pairs and an optional options object",
        );
      }
      points = args[0];
      options = args[1] ?? {};
    } else {
      var last = args.at(-1);
      var hasOptions =
        last !== null && typeof last === "object" && !Array.isArray(last);
      options = hasOptions ? last : {};
      var coordinates = hasOptions ? args.slice(0, -1) : args;
      if (coordinates.length < 4 || coordinates.length % 2 !== 0) {
        throw new TypeError(
          "drawPath requires coordinate pairs and an optional options object",
        );
      }
      points = [];
      for (var index = 0; index < coordinates.length; index += 2) {
        points.push([coordinates[index], coordinates[index + 1]]);
      }
    }
    points = snapshotDrawingPoints(points);
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      !points.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 2 &&
          point.every(Number.isFinite),
      ) ||
      !options ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        "drawPath requires at least two coordinate pairs of finite numbers",
      );
    }
    options = readDrawingOptions(options, colorValue);
    return drawWithOptions(options, () => {
      context.m(...points[0]);
      for (var index = 1; index < points.length; index += 1) {
        context.l(...points[index]);
      }
    });
  };
}

/**
 * Measure a string or a glyph id list with a font measuring export.
 * @param {object} module - Emscripten module.
 * @param {function(string, function(number): *): *} withString - Copies a string into Wasm memory.
 * @param {string|number[]} text - Text, or glyph ids as native accepts them.
 * @param {number} size - Positive font size.
 * @param {function(number, number): number} measureText - Export call for text: (textPointer, resultPointer).
 * @param {function(number, number, number): number} measureGlyphs - Export call for glyphs: (glyphPointer, count, resultPointer).
 * @returns {{xMin: number, yMin: number, xMax: number, yMax: number, width: number, height: number}} Text bounds.
 * @throws {TypeError} If `text` is not text or glyph ids, or `size` is not positive.
 * @throws {Error} If the font cannot measure the text.
 */
export function measureFontText(
  module,
  withString,
  text,
  size,
  measureText,
  measureGlyphs,
) {
  var glyphs =
    Array.isArray(text) &&
    text.every((glyph) => Number.isInteger(glyph) && glyph >= 0);
  if (
    (typeof text !== "string" && !glyphs) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    throw new TypeError(
      "Text or glyph ids and a positive font size are required",
    );
  }
  var resultPointer = module._malloc(48);
  try {
    var measured;
    if (glyphs) {
      var glyphPointer = module._malloc(Math.max(text.length, 1) * 4);
      try {
        module.HEAPU32.set(text, glyphPointer >>> 2);
        measured = measureGlyphs(glyphPointer, text.length, resultPointer);
      } finally {
        module._free(glyphPointer);
      }
    } else {
      measured = withString(text, (textPointer) =>
        measureText(textPointer, resultPointer),
      );
    }
    if (!measured) throw new Error("Unable to measure text");
    var offset = resultPointer >>> 3;
    return {
      xMin: module.HEAPF64[offset],
      yMin: module.HEAPF64[offset + 1],
      xMax: module.HEAPF64[offset + 2],
      yMax: module.HEAPF64[offset + 3],
      width: module.HEAPF64[offset + 4],
      height: module.HEAPF64[offset + 5],
    };
  } finally {
    module._free(resultPointer);
  }
}

/**
 * Read underline geometry for text drawn with a font.
 * @param {object} module - Emscripten module.
 * @param {function(string, function(number): *): *} withString - Copies a string into Wasm memory.
 * @param {string} text - Text to underline.
 * @param {number} size - Positive font size.
 * @param {function(number, number): number} readUnderline - Export call: (textPointer, resultPointer).
 * @returns {{thickness: number, position: number, advance: number}} Underline geometry in points.
 * @throws {Error} If the font cannot provide underline metrics.
 */
export function readFontUnderline(
  module,
  withString,
  text,
  size,
  readUnderline,
) {
  var resultPointer = module._malloc(24);
  try {
    if (
      !withString(text, (textPointer) =>
        readUnderline(textPointer, resultPointer),
      )
    ) {
      throw new Error("Unable to measure underline");
    }
    var offset = resultPointer >>> 3;
    return {
      thickness: module.HEAPF64[offset],
      position: module.HEAPF64[offset + 1],
      advance: module.HEAPF64[offset + 2],
    };
  } finally {
    module._free(resultPointer);
  }
}

/**
 * Read and validate writeText underline geometry before any operator is emitted.
 * @param {object} options - Options read by readTextOptions.
 * @param {string} text - Text to underline.
 * @param {number} x - Text origin x.
 * @param {number} y - Text baseline y.
 * @param {number} size - Font size.
 * @returns {{thickness: number, lineY: number, endX: number}|null} Underline geometry, or null without underline.
 * @throws {TypeError} If the underline geometry is not finite.
 */
export function prepareUnderline(options, text, x, y, size) {
  if (!options.underline) return null;
  var metrics = options.font._underline(text, size);
  var underline = {
    thickness: metrics.thickness,
    lineY: y + metrics.position,
    endX: x + metrics.advance,
  };
  if (
    ![underline.thickness, underline.lineY, underline.endX].every(
      Number.isFinite,
    )
  ) {
    throw new TypeError("Underline geometry must be finite");
  }
  return underline;
}

/**
 * Stroke a prepared underline in the text color, as native writeText does.
 * @param {object} context - Content context.
 * @param {object} options - Options read by readTextOptions.
 * @param {{thickness: number, lineY: number, endX: number}|null} underline - Prepared geometry.
 * @param {number} x - Text origin x.
 * @returns {void}
 */
export function strokeUnderline(context, options, underline, x) {
  if (!underline) return;
  applyDrawingColor(context, options, true);
  context
    .w(underline.thickness)
    .m(x, underline.lineY)
    .l(underline.endX, underline.lineY)
    .S();
}
