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
    link: function (url, x, y, width, height) {
      var point = this._calibrateCoordinate(x, y, 0, -height);
      if (this._sourceMode) {
        return (
          this.writer.attachURLLinktoCurrentPage(
            url,
            point.nx,
            point.ny,
            point.nx + width,
            point.ny + height,
          ) && this
        );
      }
      return withString(url, (urlPointer) => {
        if (
          !module._muhammara_wasm_recipe_link(
            this._recipe,
            urlPointer,
            point.nx,
            point.ny,
            width,
            height,
          )
        )
          throw new Error(
            "Muhammara WebAssembly operation failed: _muhammara_wasm_recipe_link",
          );
        return this;
      });
    },
    comment: function (text = "", x, y, options = {}) {
      return this.annot(x, y, "Text", { icon: "Comment", ...options, text });
    },
    annot: function (x, y, subtype, options = {}) {
      if (!this._pageHeight)
        throw new Error("Annotations require an active page");
      if (typeof subtype !== "string" || !subtype)
        throw new TypeError("Annotation subtype is required");
      this._annotations.push({ x, y, subtype, options: { ...options } });
      return this;
    },
    _flushAnnotations: function () {
      var annotations = this._annotations;
      this._annotations = [];
      annotations.forEach((annotation) => {
        var options = annotation.options;
        var width = options.width || 0;
        var height = options.height || 0;
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
          var source = reply || options;
          var contents = source.text || source.contents || "";
          var useRichText = Boolean(source.richText);
          if (this._sourceMode) {
            return this._page.createAnnotation(
              annotation.subtype,
              left,
              bottom,
              left + width,
              bottom + height,
              {
                contents: useRichText ? richText(contents) : contents,
                title: source.title || "",
                name: source.icon || source.name || "",
                color,
                borderWidth: Math.max(0, borderWidth),
                borderDash,
                quadPoints,
                flags: annotationFlags(source.flag ?? source.flags),
                open: Boolean(source.open),
                opacity: source.opacity ?? 1,
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
                                  annotationFlags(source.flag ?? source.flags),
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
