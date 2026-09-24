/** Reject overflowing derived geometry before any operator is emitted. */
export function validateDrawingGeometry(values) {
  if (!values.every(Number.isFinite))
    throw new TypeError("Drawing geometry must be finite");
}

/** Read each path coordinate once, including holes, before validation/output. */
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
  var colorspace = options.colorspace || "rgb";
  if (!["rgb", "gray", "cmyk"].includes(colorspace)) {
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
  var stroke = setupType === undefined || setupType === "stroke";
  var color = readColor(options, colorValue);
  var width = stroke ? options.width : undefined;
  if (width !== undefined && !Number.isFinite(width)) {
    throw new TypeError(widthError);
  }
  // Preserve the second getter read, but do not turn an explicit null into stroke.
  var type = options.type;
  if (type === undefined) type = "stroke";
  var close = Boolean(options.close);
  return { ...color, width, type, close, stroke };
}

/** Finish a validated path; clipping ends the path without painting it. */
export function finishDrawingPath(context, options) {
  if (options.type === "clip") {
    if (options.close) context.h();
    return context.W().n();
  }
  if (options.type === "fill") return context.f();
  if (options.type === "stroke") {
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
