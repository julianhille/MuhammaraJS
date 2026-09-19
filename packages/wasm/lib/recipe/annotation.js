function annotationFlags(flag) {
  var bits = {
    invisible: 1,
    hidden: 2,
    print: 4,
    nozoom: 8,
    norotate: 16,
    noview: 32,
    readonly: 64,
    locked: 128,
    togglenoview: 256,
  };
  if (flag === undefined || flag === "") return 0;
  if (Number.isSafeInteger(flag) && flag >= 0) return flag;
  if (typeof flag !== "string" || !bits[flag.toLowerCase()])
    throw new Error(`Unknown annotation flag (${flag})`);
  return bits[flag.toLowerCase()];
}

function annotationDate(value) {
  if (!value) return "";
  var date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return `D:${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
}

function richText(value) {
  if (value.startsWith("<?xml")) return value;
  return `<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml">${value.replace(/&nbsp;/g, " ").replace(/\r?\n|\r|\t/g, "")}</body>`;
}

/**
 * Rejects annotation geometry and appearance values that cannot be written as
 * a valid PDF annotation, identically for new and edited pages.
 */
function assertAnnotationValues(
  rectangle,
  borderWidth,
  borderDash,
  quadPoints,
  opacity,
) {
  var [left, bottom, right, top] = rectangle;
  if (
    !rectangle.every(Number.isFinite) ||
    right < left ||
    top < bottom ||
    !Number.isFinite(borderWidth) ||
    !Array.isArray(borderDash) ||
    !borderDash.every(Number.isFinite) ||
    !Array.isArray(quadPoints) ||
    quadPoints.length % 8 !== 0 ||
    !quadPoints.every(Number.isFinite) ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1
  )
    throw new TypeError("Invalid annotation options");
}

/**
 * Converts annotation text fields to strings as native Recipe does: empty,
 * `null`, and other falsy values are omitted, and anything else is stringified.
 */
function annotationText(options) {
  var result = { ...options };
  ["text", "contents", "title", "subject", "icon", "name"].forEach((key) => {
    result[key] = options[key] ? String(options[key]) : undefined;
  });
  return result;
}

/** Writes Recipe metadata and reply relationships through the modifier's object API. */
function writeSourceAnnotation(writer, subtype, rectangle, options) {
  var opacity = options.opacity ?? 1;
  var flags = annotationFlags(options.flag ?? options.flags);
  var objects = writer.getObjectsContext();
  var id = objects.startNewIndirectObject();
  var dictionary = objects.startDictionary();
  dictionary.writeKey("Type").writeNameValue("Annot");
  dictionary.writeKey("Subtype").writeNameValue(subtype);
  /** Writes a numeric array in the annotation dictionary. */
  function writeArray(key, values) {
    dictionary.writeKey(key);
    objects.startArray();
    values.forEach((value) => objects.writeNumber(value));
    objects.endArray();
  }
  writeArray("Rect", rectangle);
  var strings = {
    T: options.title || "",
    Subj: options.subject || "",
    M: annotationDate(options.date),
  };
  var contents = options.text || options.contents || "";
  strings[options.richText ? "RC" : "Contents"] = options.richText
    ? richText(contents)
    : contents;
  Object.entries(strings).forEach(([key, value]) => {
    if (!value) return;
    // Dates are ASCII; the other entries are PDFDocEncoding or UTF-16BE text.
    dictionary
      .writeKey(key)
      .writeLiteralStringValue(
        key === "M"
          ? value
          : new Uint8Array(writer.createPDFTextString(value).toBytesArray()),
      );
  });
  dictionary.writeKey("Open").writeBooleanValue(Boolean(options.open));
  dictionary.writeKey("F").writeNumberValue(flags);
  if (opacity !== 1) dictionary.writeKey("CA").writeNumberValue(opacity);
  if (options.replyTo) {
    dictionary.writeKey("IRT").writeObjectReferenceValue(options.replyTo);
    dictionary.writeKey("RT").writeNameValue("R");
  }
  var name = options.icon || options.name;
  if (name) dictionary.writeKey("Name").writeNameValue(name);
  if (options.color.length) writeArray("C", options.color);
  if (options.quadPoints.length) writeArray("QuadPoints", options.quadPoints);
  if (options.borderWidth >= 0) {
    dictionary.writeKey("Border");
    objects
      .startArray()
      .writeNumber(0)
      .writeNumber(0)
      .writeNumber(options.borderWidth);
    if (options.borderDash.length) {
      objects.startArray();
      options.borderDash.forEach((value) => objects.writeNumber(value));
      objects.endArray();
    }
    objects.endArray();
  }
  objects.endDictionary(dictionary).endIndirectObject();
  writer.registerAnnotationReferenceForNextPageWrite(id);
  return id;
}

/** Creates Recipe annotation methods. */
export function createAnnotationMethods({
  module,
  withString,
  withDoubles,
  colorValue,
}) {
  function annotationColor(value) {
    if (value === undefined) return [];
    if (Array.isArray(value)) {
      if (![1, 3, 4].includes(value.length) || !value.every(Number.isFinite))
        throw new TypeError(
          "Annotation colors need one, three, or four numbers",
        );
      return value.map((part) => (Math.abs(part) > 1 ? part / 255 : part));
    }
    var packed = colorValue(value);
    return [
      (packed >> 16) / 255,
      ((packed >> 8) & 255) / 255,
      (packed & 255) / 255,
    ];
  }

  return {
    /**
     * Adds a clickable URL link rectangle to the active page.
     * Coordinates use Recipe's top-left origin.
     *
     * @name link
     * @function
     * @memberof Recipe#
     * @param {string} url URL to open.
     * @param {number} x Left coordinate in Recipe coordinates.
     * @param {number} y Top coordinate in Recipe coordinates.
     * @param {number} width Link width.
     * @param {number} height Link height.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active page or the underlying PDF operation fails.
     */
    link: function (url, x, y, width, height) {
      var point = this._calibrateCoordinate(x, y, 0, -height);
      return this._linkPdf(url, point.nx, point.ny, width, height);
    },
    /**
     * Adds a URL link using native PDF coordinates.
     *
     * @name _linkPdf
     * @function
     * @memberof Recipe#
     * @private
     */
    _linkPdf: function (url, left, bottom, width, height) {
      if (!this._pageHeight) throw new Error("Links require an active page");
      // A link is an indirect object, so it is written with the queued
      // annotations once endPage() has closed the page content stream.
      this._links.push({ url, left, bottom, width, height });
      return this;
    },
    /**
     * Writes and clears links queued for the active page.
     *
     * @name _flushLinks
     * @function
     * @memberof Recipe#
     * @private
     */
    _flushLinks: function () {
      var links = this._links;
      this._links = [];
      links.forEach(({ url, left, bottom, width, height }) => {
        if (this._sourceMode) {
          this.writer.attachURLLinktoCurrentPage(
            url,
            left,
            bottom,
            left + width,
            bottom + height,
          );
          return;
        }
        withString(url, (urlPointer) => {
          if (
            !module._muhammara_wasm_recipe_link(
              this._recipe,
              urlPointer,
              left,
              bottom,
              width,
              height,
            )
          )
            throw new Error(
              "Muhammara WebAssembly operation failed: _muhammara_wasm_recipe_link",
            );
        });
      });
    },
    /**
     * Queues a text comment annotation on the active page.
     * Coordinates use Recipe's top-left origin.
     *
     * @name comment
     * @function
     * @memberof Recipe#
     * @param {string} text Comment contents.
     * @param {RecipeCoordinate} x Left coordinate in Recipe coordinates.
     * @param {RecipeCoordinate} y Top coordinate in Recipe coordinates.
     * @param {RecipeAnnotationOptions} [options={}] Annotation options. The
     * `text` argument supplies the contents and the default icon is `Comment`.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active page or a flag is unknown.
     * @throws {TypeError} If the options cannot form a valid PDF annotation.
     */
    comment: function (text = "", x, y, options = {}) {
      return this.annot(x, y, "Text", { icon: "Comment", ...options, text });
    },
    /**
     * Queues an annotation on the active page.
     * Coordinates use Recipe's top-left origin; `center` centers that axis.
     *
     * @name annot
     * @function
     * @memberof Recipe#
     * @param {RecipeCoordinate} x Left coordinate in Recipe coordinates.
     * @param {RecipeCoordinate} y Top coordinate in Recipe coordinates.
     * @param {string} subtype PDF annotation subtype.
     * @param {RecipeAnnotationOptions} [options={}] Annotation appearance,
     * contents, replies, dimensions, flags, and rotation handling.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active page or a flag is unknown.
     * @throws {TypeError} If `subtype` is not a non-empty string or the
     * options cannot form a valid PDF annotation.
     */
    annot: function (x, y, subtype, options = {}) {
      if (!this._pageHeight)
        throw new Error("Annotations require an active page");
      if (typeof subtype !== "string" || !subtype)
        throw new TypeError("Annotation subtype is required");
      var annotation = { x, y, subtype, options: { ...options } };
      // Reject invalid options here, so they never enter the queue and block
      // every later endPage() call.
      this._flushAnnotations(true, [annotation]);
      this._annotations.push(annotation);
      return this;
    },
    /**
     * Writes and clears annotations queued for the active page.
     *
     * @name _flushAnnotations
     * @function
     * @memberof Recipe#
     * @private
     * @param {boolean} [validateOnly=false] Check the queue without writing or clearing it.
     * @param {Object[]} [annotations=this._annotations] Queued annotations to process.
     */
    _flushAnnotations: function (
      validateOnly = false,
      annotations = this._annotations,
    ) {
      if (!validateOnly) this._flushLinks();
      if (!validateOnly) this._annotations = [];
      annotations.forEach((annotation) => {
        var options = annotation.options;
        var width = options.width ?? 0;
        var height = options.height ?? 0;
        var point = this._calibrateCoordinateForAnnots(
          annotation.x,
          annotation.y,
        );
        var left = point.nx;
        var bottom = point.ny;
        var page = this.getCurrentPageInfo();
        if (!options.followOriginalPageRotation) {
          if (page.rotate === 90)
            [left, width, height] = [left - height, height, width];
          if (page.rotate === 180)
            [left, bottom] = [left - width, bottom - height];
          if (page.rotate === 270)
            [bottom, width, height] = [bottom - width, height, width];
        }
        var markup = [
          "highlight",
          "underline",
          "strikeout",
          "squiggly",
        ].includes(annotation.subtype.toLowerCase());
        var color = annotationColor(options.color);
        if (markup && !color.length)
          color = annotationColor(
            annotation.subtype === "Highlight"
              ? [255, 255, 0]
              : annotation.subtype === "StrikeOut"
                ? [255, 0, 0]
                : [0, 255, 0],
          );
        var quadPoints =
          options.quadPoints ||
          (markup
            ? [
                left,
                bottom + height,
                left + width,
                bottom + height,
                left,
                bottom,
                left + width,
                bottom,
              ]
            : []);
        var border = options.border || {};
        var borderWidth =
          typeof border === "number"
            ? border
            : (options.borderWidth ?? border.width ?? -1);
        var borderDash = options.borderDash ?? border.dash ?? [];
        var write = (replyTo, reply) => {
          // Native replies inherit metadata, but keep their own contents,
          // rich-text mode, and opacity (opaque by default).
          var source = annotationText(
            reply
              ? {
                  ...reply,
                  title: reply.title || options.title,
                  subject: reply.subject || options.subject,
                  date: reply.date || options.date,
                  // Like native, an empty or zero reply flag keeps the parent's.
                  flag:
                    reply.flag || reply.flags || options.flag || options.flags,
                  open: reply.open ?? options.open,
                  icon: reply.icon ?? options.icon,
                  name: reply.name ?? options.name,
                }
              : options,
          );
          var contents = source.text || source.contents || "";
          var useRichText = Boolean(source.richText);
          assertAnnotationValues(
            [left, bottom, left + width, bottom + height],
            borderWidth,
            borderDash,
            quadPoints,
            source.opacity ?? 1,
          );
          var flags = annotationFlags(source.flag ?? source.flags);
          if (validateOnly) return 0;
          if (this._sourceMode) {
            return writeSourceAnnotation(
              this.writer,
              annotation.subtype,
              [left, bottom, left + width, bottom + height],
              {
                ...source,
                color,
                borderWidth,
                borderDash,
                quadPoints,
                replyTo,
              },
            );
          }
          return withString(annotation.subtype, (subtype) =>
            withString(useRichText ? richText(contents) : contents, (text) =>
              withString(source.title || "", (title) =>
                withString(source.subject || "", (subject) =>
                  withString(annotationDate(source.date), (date) =>
                    withString(source.icon || source.name || "", (name) =>
                      withDoubles(color, (colorPointer) =>
                        withDoubles(borderDash, (dashPointer) =>
                          withDoubles(quadPoints, (quadPointer) => {
                            var idPointer = module._malloc(4);
                            try {
                              if (
                                !module._muhammara_wasm_recipe_annotation_full(
                                  this._recipe,
                                  subtype,
                                  text,
                                  title,
                                  subject,
                                  date,
                                  name,
                                  left,
                                  bottom,
                                  left + width,
                                  bottom + height,
                                  colorPointer,
                                  color.length,
                                  borderWidth,
                                  dashPointer,
                                  borderDash.length,
                                  quadPointer,
                                  quadPoints.length,
                                  flags,
                                  source.open ? 1 : 0,
                                  source.opacity ?? 1,
                                  useRichText ? 1 : 0,
                                  reply ? 1 : 0,
                                  replyTo || 0,
                                  idPointer,
                                )
                              )
                                throw new Error("Unable to create annotation");
                              return module.HEAPU32[idPointer >>> 2];
                            } finally {
                              module._free(idPointer);
                            }
                          }),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        };
        var id = write(0);
        (options.replies || []).forEach((reply) => write(id, reply));
      });
    },
  };
}
