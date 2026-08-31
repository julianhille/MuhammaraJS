import { createChildLifecycle } from "./lifecycle.js";

export function createWriterSupport({
  module,
  normalizeBytes,
  images,
  pdfs,
  state,
  withString,
  withDoubles,
  removeFile,
  assertOutputSize,
}) {
  function imageAssetPath(value, retainedPaths) {
    if (typeof value === "string") {
      var path = images.get(value) || pdfs.get(value);
      if (!path) throw new Error(`Unknown image asset: ${value}`);
      return path;
    }
    var bytes = normalizeBytes(value, "Image bytes");
    var extension;
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      extension = "jpg";
    } else if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      extension = "png";
    } else if (
      bytes.length >= 4 &&
      ((bytes[0] === 0x49 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x2a &&
        bytes[3] === 0) ||
        (bytes[0] === 0x4d &&
          bytes[1] === 0x4d &&
          bytes[2] === 0 &&
          bytes[3] === 0x2a))
    ) {
      extension = "tiff";
    } else if (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      extension = "pdf";
    } else {
      throw new TypeError("Image bytes must be JPEG, PNG, TIFF, or PDF");
    }
    var path = `/images/draw-${state.nextAsset++}.${extension}`;
    module.FS.mkdirTree("/images");
    module.FS.writeFile(path, bytes);
    retainedPaths.push(path);
    return path;
  }

  function imageDrawOptions(options) {
    if (options === undefined) {
      return {
        index: 0,
        method: 0,
        matrix: [1, 0, 0, 1, 0, 0],
        width: 100,
        height: 100,
        proportional: false,
        fit: 1,
      };
    }
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("drawImage options must be an object");
    }
    ["password", "path", "stream"].forEach((key) => {
      if (Object.hasOwn(options, key)) {
        throw new TypeError(`drawImage does not support Node ${key} options`);
      }
    });
    if (
      !Object.keys(options).every((key) =>
        ["index", "transformation"].includes(key),
      )
    ) {
      throw new TypeError(
        "drawImage options support only index and transformation",
      );
    }
    var index = options.index ?? 0;
    if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
      throw new RangeError(
        "drawImage index must be a non-negative 32-bit integer",
      );
    }
    var result = {
      index,
      method: 0,
      matrix: [1, 0, 0, 1, 0, 0],
      width: 100,
      height: 100,
      proportional: false,
      fit: 1,
    };
    if (options.transformation === undefined) return result;
    var transformation = options.transformation;
    if (Array.isArray(transformation)) {
      if (
        transformation.length !== 6 ||
        !transformation.every(Number.isFinite)
      ) {
        throw new TypeError(
          "drawImage transformation matrix requires six finite numbers",
        );
      }
      result.method = 1;
      result.matrix = transformation;
      return result;
    }
    if (!transformation || typeof transformation !== "object") {
      throw new TypeError(
        "drawImage transformation must be a matrix or fit object",
      );
    }
    if (
      !Object.keys(transformation).every((key) =>
        ["width", "height", "proportional", "fit"].includes(key),
      )
    ) {
      throw new TypeError(
        "drawImage fit supports only width, height, proportional, and fit",
      );
    }
    if (
      !Number.isFinite(transformation.width) ||
      transformation.width <= 0 ||
      !Number.isFinite(transformation.height) ||
      transformation.height <= 0
    ) {
      throw new RangeError(
        "drawImage fit requires positive finite width and height",
      );
    }
    if (
      transformation.proportional !== undefined &&
      typeof transformation.proportional !== "boolean"
    ) {
      throw new TypeError("drawImage fit proportional must be a boolean");
    }
    if (
      transformation.fit !== undefined &&
      !["always", "overflow"].includes(transformation.fit)
    ) {
      throw new TypeError("drawImage fit must be always or overflow");
    }
    result.method = 2;
    result.width = transformation.width;
    result.height = transformation.height;
    result.proportional = transformation.proportional || false;
    result.fit = transformation.fit === "always" ? 0 : 1;
    return result;
  }

  function drawImageCall(call, x, y, image, options, retainedPaths) {
    if (![x, y].every(Number.isFinite)) {
      throw new TypeError("drawImage requires finite x and y coordinates");
    }
    var drawOptions = imageDrawOptions(options);
    var path = imageAssetPath(image, retainedPaths);
    var matrixPointer = module._malloc(48);
    try {
      module.HEAPF64.set(drawOptions.matrix, matrixPointer >>> 3);
      if (
        !withString(path, (pointer) =>
          call(pointer, drawOptions, matrixPointer),
        )
      ) {
        throw new Error("Unable to draw image");
      }
    } finally {
      module._free(matrixPointer);
    }
  }

  function removeAssets(paths) {
    paths.forEach(removeFile);
    paths.length = 0;
  }

  function resourcesDictionary(handle, requireOpen) {
    function addMapping(type, objectId) {
      requireOpen();
      if (!Number.isInteger(objectId) || objectId <= 0) {
        throw new RangeError("Resource object ID must be positive");
      }
      var result = module._muhammara_wasm_resources_add_mapping(
        handle,
        type,
        objectId,
      );
      if (!result) throw new Error("Unable to add resource mapping");
      try {
        var length = 0;
        while (module.HEAPU8[result + length]) length += 1;
        return new TextDecoder().decode(
          module.HEAPU8.subarray(result, result + length),
        );
      } finally {
        module._muhammara_wasm_free(result);
      }
    }
    return {
      addProcsetResource: function (name) {
        requireOpen();
        if (typeof name !== "string" || !name) {
          throw new TypeError(
            "Procset resource name must be a non-empty string",
          );
        }
        withString(name, (pointer) => {
          if (!module._muhammara_wasm_resources_add_procset(handle, pointer)) {
            throw new Error("Unable to add procset resource");
          }
        });
      },
      addExtGStateMapping: (objectId) => addMapping(0, objectId),
      addFontMapping: (objectId) => addMapping(1, objectId),
      addColorSpaceMapping: (objectId) => addMapping(2, objectId),
      addPatternMapping: (objectId) => addMapping(3, objectId),
      addPropertyMapping: (objectId) => addMapping(4, objectId),
      addXObjectMapping: (objectId) => addMapping(5, objectId),
      addFormXObjectMapping: (objectId) => addMapping(6, objectId),
      addImageXObjectMapping: (objectId) => addMapping(7, objectId),
      addShadingMapping: (objectId) => addMapping(8, objectId),
    };
  }

  function createAnnotation(
    call,
    subtype,
    left,
    bottom,
    right,
    top,
    options = {},
  ) {
    if (
      typeof subtype !== "string" ||
      !subtype ||
      ![left, bottom, right, top].every(Number.isFinite) ||
      right < left ||
      top < bottom ||
      !options ||
      typeof options !== "object"
    ) {
      throw new TypeError(
        "Annotation requires a subtype and valid PDF rectangle",
      );
    }
    var strings = ["contents", "title", "name"];
    if (
      !strings.every(
        (key) => options[key] === undefined || typeof options[key] === "string",
      )
    ) {
      throw new TypeError("Annotation text options must be strings");
    }
    var color = options.color || [];
    var border = options.border || {};
    var borderWidth = options.borderWidth ?? border.width ?? 0;
    var borderDash = options.borderDash ?? border.dash ?? [];
    var quadPoints = options.quadPoints || [];
    var flags = options.flags ?? 0;
    var open = options.open ?? false;
    var opacity = options.opacity ?? 1;
    if (
      !Array.isArray(color) ||
      ![0, 1, 3, 4].includes(color.length) ||
      !color.every(Number.isFinite) ||
      !Number.isFinite(borderWidth) ||
      borderWidth < 0 ||
      !Array.isArray(borderDash) ||
      !borderDash.every(Number.isFinite) ||
      !Array.isArray(quadPoints) ||
      quadPoints.length % 8 !== 0 ||
      !quadPoints.every(Number.isFinite) ||
      !Number.isInteger(flags) ||
      flags < 0 ||
      !Number.isSafeInteger(flags) ||
      typeof open !== "boolean" ||
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 1
    ) {
      throw new TypeError("Invalid annotation options");
    }
    return withString(subtype, (subtypePointer) =>
      withString(options.contents || "", (contentsPointer) =>
        withString(options.title || "", (titlePointer) =>
          withString(options.name || "", (namePointer) =>
            withDoubles(color, (colorPointer) =>
              withDoubles(borderDash, (borderDashPointer) =>
                withDoubles(quadPoints, (quadPointsPointer) => {
                  var id = call(
                    subtypePointer,
                    contentsPointer,
                    titlePointer,
                    namePointer,
                    left,
                    bottom,
                    right,
                    top,
                    colorPointer,
                    color.length,
                    borderWidth,
                    borderDashPointer,
                    borderDash.length,
                    quadPointsPointer,
                    quadPoints.length,
                    flags,
                    open,
                    opacity,
                  );
                  if (!id) throw new Error("Unable to create annotation");
                  return id;
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }

  return {
    imageAssetPath,
    drawImageCall,
    removeAssets,
    resourcesDictionary,
    createAnnotation,
  };
}

export function createWriterFactory({
  module,
  constants,
  colorValue,
  normalizeBytes,
  normalizeBytesAsync,
  PDFTextString,
  PDFDate,
  PDFPage,
  normalizePDFDate,
  rawObjectsContext,
  copyingObjectOperations,
  createReader,
  fonts,
  images,
  imageTypes,
  pdfs,
  state,
  withString,
  withBytes,
  writeNativeBytes,
  writeFreeCode,
  addStructuredContentOperators,
  withDoubles,
  copiedPageFormArguments,
  textEncoding,
  withGlyphs,
  withTJItems,
  addTextShowingOperators,
  imageAssetPath,
  drawImageCall,
  removeAssets,
  resourcesDictionary,
  createAnnotation,
  removeFile,
  assertOutputSize,
}) {
  function createWriter(options = {}) {
    if (!options || typeof options !== "object") {
      throw new TypeError("createWriter options must be an object");
    }
    var version = options.version ?? constants.ePDFVersion14;
    var compress = options.compress ?? true;
    if (
      !Number.isInteger(version) ||
      ![
        constants.ePDFVersion10,
        constants.ePDFVersion11,
        constants.ePDFVersion12,
        constants.ePDFVersion13,
        constants.ePDFVersion14,
        constants.ePDFVersion15,
        constants.ePDFVersion16,
        constants.ePDFVersion17,
        constants.ePDFVersion20,
      ].includes(version)
    ) {
      throw new RangeError(
        "createWriter version must be a supported PDF version",
      );
    }
    if (typeof compress !== "boolean") {
      throw new TypeError("createWriter compress must be a boolean");
    }
    var recipe = module._muhammara_wasm_recipe_create_with_options(
      version,
      compress ? 1 : 0,
    );
    var currentPage = null;
    var owner = {};
    var currentContext = null;
    var ended = false;
    var disposed = false;
    var objectsContext = null;
    var directImagePaths = [];
    var lifecycle = createChildLifecycle();

    function dispose() {
      if (disposed) return;
      disposed = true;
      lifecycle.disposeChildren();
      removeAssets(directImagePaths);
      if (recipe) module._muhammara_wasm_recipe_destroy(recipe);
      recipe = 0;
      ended = true;
    }

    function requireActiveContext(context) {
      if (ended || context !== currentContext || !currentPage) {
        throw new Error("Page content context is not active");
      }
    }

    function requireOpenWriter() {
      if (ended) throw new Error("PDF writer has ended");
    }

    var additionalInfo = new Map();
    var infoDictionary = {
      addAdditionalInfoEntry: function (key, value) {
        requireOpenWriter();
        if (typeof key !== "string" || typeof value !== "string") {
          throw new TypeError("addAdditionalInfoEntry requires two strings");
        }
        withString(key, (keyPointer) =>
          withString(value, (valuePointer) => {
            if (
              !module._muhammara_wasm_recipe_set_info(
                recipe,
                keyPointer,
                valuePointer,
              )
            ) {
              throw new Error("Unable to set additional info entry");
            }
          }),
        );
        additionalInfo.set(key, value);
      },
      removeAdditionalInfoEntry: function (key) {
        requireOpenWriter();
        if (typeof key !== "string")
          throw new TypeError("removeAdditionalInfoEntry requires a string");
        withString(key, (keyPointer) => {
          if (!module._muhammara_wasm_recipe_remove_info(recipe, keyPointer)) {
            throw new Error("Unable to remove additional info entry");
          }
        });
        additionalInfo.delete(key);
      },
      clearAdditionalInfoEntries: function () {
        requireOpenWriter();
        if (!module._muhammara_wasm_recipe_clear_info(recipe)) {
          throw new Error("Unable to clear additional info entries");
        }
        additionalInfo.clear();
      },
      getAdditionalInfoEntry: function (key) {
        requireOpenWriter();
        if (typeof key !== "string")
          throw new TypeError("getAdditionalInfoEntry requires a string");
        return additionalInfo.get(key) || "";
      },
      getAdditionalInfoEntries: function () {
        requireOpenWriter();
        return Object.fromEntries(additionalInfo);
      },
      setCreationDate: function (value) {
        requireOpenWriter();
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_recipe_set_info_date(recipe, 0, pointer)
          ) {
            throw new Error("Unable to set creation date");
          }
        });
      },
      setModDate: function (value) {
        requireOpenWriter();
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_recipe_set_info_date(recipe, 1, pointer)
          ) {
            throw new Error("Unable to set modification date");
          }
        });
      },
    };
    ["title", "author", "subject", "keywords", "creator", "producer"].forEach(
      (key) => {
        var value = "";
        Object.defineProperty(infoDictionary, key, {
          get: function () {
            return value;
          },
          set: function (nextValue) {
            requireOpenWriter();
            value = String(nextValue);
            withString(key, (keyPointer) =>
              withString(value, (valuePointer) => {
                if (
                  !module._muhammara_wasm_recipe_set_info(
                    recipe,
                    keyPointer,
                    valuePointer,
                  )
                ) {
                  throw new Error(`Unable to set ${key}`);
                }
              }),
            );
          },
        });
      },
    );
    var trapped = constants.EInfoTrappedUnknown;
    Object.defineProperty(infoDictionary, "trapped", {
      get: function () {
        return trapped;
      },
      set: function (value) {
        requireOpenWriter();
        if (!Number.isInteger(value) || value < 0 || value > 2) {
          throw new RangeError("trapped must be an EInfoTrapped value");
        }
        if (!module._muhammara_wasm_recipe_set_info_trapped(recipe, value)) {
          throw new Error("Unable to set trapped");
        }
        trapped = value;
      },
    });
    var documentContext = {
      getInfoDictionary: function () {
        requireOpenWriter();
        return infoDictionary;
      },
    };

    function contentContext() {
      function operator(name, code, args = [], integers = false) {
        requireActiveContext(context);
        if (!args.every(Number.isFinite)) {
          throw new TypeError(`${name} requires finite numeric arguments`);
        }
        if (integers && !args.every(Number.isInteger)) {
          throw new TypeError(`${name} requires integer numeric arguments`);
        }
        if (!module._muhammara_wasm_recipe_operator(recipe, code, ...args)) {
          throw new Error(`Unable to apply ${name}`);
        }
        return context;
      }

      var context = {
        getAssociatedPage: function () {
          requireActiveContext(context);
          return currentPage;
        },
        getCurrentPageContentStream: function () {
          requireActiveContext(context);
          var stream = module._muhammara_wasm_page_content_get_stream(recipe);
          if (!stream)
            throw new Error("Page content stream is no longer active");
          return {
            getWriteStream: function () {
              requireActiveContext(context);
              var writer =
                module._muhammara_wasm_content_stream_get_write_stream(stream);
              if (!writer)
                throw new Error("Page content stream is no longer active");
              return {
                write: function (bytes) {
                  requireActiveContext(context);
                  return writeNativeBytes(
                    module,
                    (pointer, length) =>
                      module._muhammara_wasm_content_byte_writer_write(
                        writer,
                        pointer,
                        length,
                      ),
                    bytes,
                  );
                },
              };
            },
          };
        },
        writeFreeCode: function (freeCode) {
          return writeFreeCode(
            context,
            () => requireActiveContext(context),
            (pointer, length) =>
              module._muhammara_wasm_writer_write_free_code(
                recipe,
                pointer,
                length,
              ),
            freeCode,
          );
        },
        setOpacity: function (opacity) {
          requireActiveContext(context);
          if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
            throw new TypeError(
              "Wrong Argument, please provide 1 opacity value between 0 and 1",
            );
          }
          if (!module._muhammara_wasm_recipe_set_opacity(recipe, opacity)) {
            throw new Error("Unable to set opacity");
          }
          return context;
        },
        b: function () {
          return operator("b", 0);
        },
        B: function () {
          return operator("B", 1);
        },
        bStar: function () {
          return operator("bStar", 2);
        },
        BStar: function () {
          return operator("BStar", 3);
        },
        s: function () {
          return operator("s", 4);
        },
        F: function () {
          return operator("F", 7);
        },
        fStar: function () {
          return operator("fStar", 8);
        },
        n: function () {
          return operator("n", 9);
        },
        c: function (...args) {
          return operator("c", 12, args);
        },
        v: function (...args) {
          return operator("v", 13, args);
        },
        y: function (...args) {
          return operator("y", 14, args);
        },
        h: function () {
          return operator("h", 15);
        },
        cm: function (...args) {
          return operator("cm", 19, args);
        },
        J: function (value) {
          if (!Number.isInteger(value) || value < 0 || value > 2) {
            throw new RangeError("J requires a line cap from 0 to 2");
          }
          return operator("J", 21, [value]);
        },
        j: function (value) {
          if (!Number.isInteger(value) || value < 0 || value > 3) {
            throw new RangeError("j requires a line join from 0 to 3");
          }
          return operator("j", 22, [value]);
        },
        M: function (value) {
          return operator("M", 23, [value]);
        },
        d: function (dash, phase = 0) {
          requireActiveContext(context);
          if (
            !Array.isArray(dash) ||
            !dash.every(Number.isFinite) ||
            !Number.isFinite(phase)
          ) {
            throw new TypeError("d requires a finite dash array and phase");
          }
          var pointer = dash.length ? module._malloc(dash.length * 8) : 0;
          try {
            if (pointer) module.HEAPF64.set(dash, pointer >>> 3);
            if (
              !module._muhammara_wasm_recipe_dash(
                recipe,
                pointer,
                dash.length,
                phase,
              )
            ) {
              throw new Error("Unable to set dash pattern");
            }
            return context;
          } finally {
            if (pointer) module._free(pointer);
          }
        },
        g: function (value) {
          return operator("g", 24, [value]);
        },
        K: function (...args) {
          return operator("K", 29, args);
        },
        rg: function (...args) {
          return operator("rg", 26, args);
        },
        RG: function (...args) {
          return operator("RG", 27, args);
        },
        W: function () {
          return operator("W", 30);
        },
        WStar: function () {
          return operator("WStar", 31);
        },
        BT: function () {
          return operator("BT", 32);
        },
        ET: function () {
          return operator("ET", 33);
        },
        Tm: function (...args) {
          return operator("Tm", 34, args);
        },
        Tc: function (characterSpace) {
          return operator("Tc", 35, [characterSpace]);
        },
        Tw: function (wordSpace) {
          return operator("Tw", 36, [wordSpace]);
        },
        Tz: function (horizontalScaling) {
          return operator("Tz", 37, [horizontalScaling], true);
        },
        TL: function (textLeading) {
          return operator("TL", 38, [textLeading]);
        },
        Tr: function (renderingMode) {
          return operator("Tr", 39, [renderingMode], true);
        },
        Ts: function (fontRise) {
          return operator("Ts", 40, [fontRise]);
        },
        Tf: function (font, size) {
          requireActiveContext(context);
          if (!(
            (font instanceof PDFUsedFont && font._owner === owner) ||
            typeof font === "string"
          )) {
            throw new TypeError("Tf requires a font from this writer");
          }
          if (!Number.isFinite(size) || size <= 0) {
            throw new RangeError("Tf requires a positive font size");
          }
          if (typeof font === "string") {
            return withString(font, (pointer) => {
              if (
                !module._muhammara_wasm_writer_set_font_name(
                  recipe,
                  pointer,
                  size,
                )
              ) {
                throw new Error("Unable to set font");
              }
              return context;
            });
          }
          if (!module._muhammara_wasm_writer_set_font(recipe, font._font, size))
            throw new Error("Unable to set font");
          return context;
        },
        Tj: function (text, options) {
          requireActiveContext(context);
          if (typeof text === "string") {
            var encoding = textEncoding(options);
            return withString(text, (textPointer) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  0,
                  encoding,
                  0,
                  0,
                  textPointer,
                )
              ) {
                throw new Error("Unable to show text");
              }
              return context;
            });
          }
          if (options !== undefined)
            throw new TypeError("glyph text has no encoding options");
          return withGlyphs(text, (glyphPointer) => {
            if (
              !module._muhammara_wasm_writer_show_glyphs_operator(
                recipe,
                0,
                0,
                0,
                glyphPointer,
                text.length,
              )
            ) {
              throw new Error("Unable to show glyph text");
            }
            return context;
          });
        },
        Quote: function (text, options) {
          requireActiveContext(context);
          if (typeof text === "string") {
            return withString(text, (pointer) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  1,
                  textEncoding(options),
                  0,
                  0,
                  pointer,
                )
              )
                throw new Error("Unable to show text");
              return context;
            });
          }
          if (options !== undefined)
            throw new TypeError("glyph text has no encoding options");
          return withGlyphs(text, (pointer) => {
            if (
              !module._muhammara_wasm_writer_show_glyphs_operator(
                recipe,
                1,
                0,
                0,
                pointer,
                text.length,
              )
            )
              throw new Error("Unable to show glyph text");
            return context;
          });
        },
        DoubleQuote: function (wordSpace, characterSpace, text, options) {
          requireActiveContext(context);
          if (![wordSpace, characterSpace].every(Number.isFinite))
            throw new TypeError(
              "DoubleQuote requires finite numeric arguments",
            );
          if (typeof text === "string")
            return withString(text, (pointer) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  2,
                  textEncoding(options),
                  wordSpace,
                  characterSpace,
                  pointer,
                )
              )
                throw new Error("Unable to show text");
              return context;
            });
          if (options !== undefined)
            throw new TypeError("glyph text has no encoding options");
          return withGlyphs(text, (pointer) => {
            if (
              !module._muhammara_wasm_writer_show_glyphs_operator(
                recipe,
                2,
                wordSpace,
                characterSpace,
                pointer,
                text.length,
              )
            )
              throw new Error("Unable to show glyph text");
            return context;
          });
        },
        TJ: function (...items) {
          requireActiveContext(context);
          var options = items.at(-1);
          var encoding =
            options && typeof options === "object" && !Array.isArray(options)
              ? textEncoding(items.pop())
              : 0;
          return withTJItems(items, (...pointers) => {
            if (
              !module._muhammara_wasm_writer_show_tj(
                recipe,
                encoding,
                ...pointers,
              )
            )
              throw new Error("Unable to show text array");
            return context;
          });
        },
        Td: function (x, y) {
          return operator("Td", 41, [x, y]);
        },
        TD: function (x, y) {
          return operator("TD", 42, [x, y]);
        },
        TStar: function () {
          return operator("TStar", 43);
        },
        q: function () {
          return operator("q", 17);
        },
        Q: function () {
          return operator("Q", 18);
        },
        k: function (cyan, magenta, yellow, black) {
          requireActiveContext(context);
          if (
            !module._muhammara_wasm_recipe_cmyk_fill(
              recipe,
              cyan,
              magenta,
              yellow,
              black,
            )
          ) {
            throw new Error("Unable to set fill color");
          }
          return context;
        },
        G: function (gray) {
          requireActiveContext(context);
          if (!module._muhammara_wasm_recipe_gray_stroke(recipe, gray)) {
            throw new Error("Unable to set stroke color");
          }
          return context;
        },
        w: function (width) {
          return operator("w", 20, [width]);
        },
        m: function (x, y) {
          return operator("m", 10, [x, y]);
        },
        l: function (x, y) {
          return operator("l", 11, [x, y]);
        },
        re: function (x, y, width, height) {
          return operator("re", 16, [x, y, width, height]);
        },
        f: function () {
          return operator("f", 6);
        },
        S: function () {
          return operator("S", 5);
        },
        doXObject: function (xobject) {
          requireActiveContext(context);
          if (Number.isInteger(xobject) && xobject > 0) {
            if (
              !module._muhammara_wasm_writer_do_form_object_id(recipe, xobject)
            ) {
              throw new Error("Unable to place XObject");
            }
            return context;
          }
          if (typeof xobject === "string") {
            if (
              !withString(xobject, (pointer) =>
                module._muhammara_wasm_writer_do_xobject_name(recipe, pointer),
              )
            ) {
              throw new Error("Unable to place XObject");
            }
            return context;
          }
          if (
            !(
              xobject instanceof ImageXObject || xobject instanceof FormXObject
            ) ||
            xobject._owner !== owner ||
            (xobject instanceof FormXObject && !xobject._ended)
          ) {
            throw new TypeError(
              "doXObject requires a completed XObject from this writer",
            );
          }
          var placed =
            xobject instanceof FormXObject && xobject._objectId
              ? module._muhammara_wasm_writer_do_form_object_id(
                  recipe,
                  xobject._objectId,
                )
              : module._muhammara_wasm_writer_do_xobject(
                  recipe,
                  xobject._handle,
                  xobject instanceof FormXObject ? 1 : 0,
                );
          if (!placed) {
            throw new Error("Unable to place XObject");
          }
          return context;
        },
      };

      addStructuredContentOperators(
        context,
        () => requireActiveContext(context),
        (...args) =>
          module._muhammara_wasm_recipe_structured_operator(recipe, ...args),
      );

      function applyHighLevelColor(options, stroke) {
        if (!options || options.color === undefined) return;
        var color = colorValue(options.color) >>> 0;
        var colorspace = options.colorspace || "rgb";
        if (colorspace === "rgb") {
          return stroke
            ? context.RG(
                ((color >> 16) & 0xff) / 255,
                ((color >> 8) & 0xff) / 255,
                (color & 0xff) / 255,
              )
            : context.rg(
                ((color >> 16) & 0xff) / 255,
                ((color >> 8) & 0xff) / 255,
                (color & 0xff) / 255,
              );
        }
        if (colorspace === "gray") {
          return stroke
            ? context.G((color & 0xff) / 255)
            : context.g((color & 0xff) / 255);
        }
        if (colorspace === "cmyk") {
          var values = [
            ((color >> 24) & 0xff) / 255,
            ((color >> 16) & 0xff) / 255,
            ((color >> 8) & 0xff) / 255,
            (color & 0xff) / 255,
          ];
          return stroke ? context.K(...values) : context.k(...values);
        }
        throw new TypeError("colorspace must be rgb, gray, or cmyk");
      }

      function finishHighLevelPath(options) {
        options = options || {};
        var stroke = options.type !== "fill";
        applyHighLevelColor(options, stroke);
        if (stroke && options.width !== undefined) context.w(options.width);
        return options.type === "fill"
          ? context.f()
          : options.close
            ? context.s()
            : context.S();
      }

      context.drawRectangle = function (x, y, width, height, options) {
        if (![x, y, width, height].every(Number.isFinite)) {
          throw new TypeError("drawRectangle requires four finite coordinates");
        }
        context.re(x, y, width, height);
        return finishHighLevelPath(
          options && typeof options === "object" ? options : {},
        );
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
        var control = radius * 0.5522847498307936;
        context
          .m(x + radius, y)
          .c(x + radius, y + control, x + control, y + radius, x, y + radius)
          .c(x - control, y + radius, x - radius, y + control, x - radius, y)
          .c(x - radius, y - control, x - control, y - radius, x, y - radius)
          .c(x + control, y - radius, x + radius, y - control, x + radius, y);
        return finishHighLevelPath(
          options && typeof options === "object" ? options : {},
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
          options = args.at(-1);
          var coordinates = args.slice(0, -1);
          if (
            args.length < 5 ||
            !options ||
            typeof options !== "object" ||
            Array.isArray(options) ||
            coordinates.length % 2 !== 0
          ) {
            throw new TypeError(
              "drawPath requires coordinate pairs and an options object",
            );
          }
          points = [];
          for (var index = 0; index < coordinates.length; index += 2) {
            points.push([coordinates[index], coordinates[index + 1]]);
          }
        }
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
        context.m(...points[0]);
        for (var index = 1; index < points.length; index += 1) {
          context.l(...points[index]);
        }
        return finishHighLevelPath(options);
      };
      context.writeText = function (text, x, y, options = {}) {
        if (
          typeof text !== "string" ||
          ![x, y].every(Number.isFinite) ||
          !options ||
          typeof options !== "object" ||
          !(options.font instanceof PDFUsedFont) ||
          options.font._owner !== owner
        ) {
          throw new TypeError(
            "writeText requires text, coordinates, and a writer font",
          );
        }
        var size = options.size ?? 1;
        if (!Number.isFinite(size) || size <= 0) {
          throw new RangeError("writeText requires a positive font size");
        }
        context.BT();
        applyHighLevelColor(options, false);
        context.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
        if (options.underline) {
          var dimensions = options.font.calculateTextDimensions(text, size);
          context
            .w(Math.max(size * 0.05, 0.1))
            .m(x, y + dimensions.yMin)
            .l(x + dimensions.width, y + dimensions.yMin)
            .S();
        }
        return context;
      };
      context.drawImage = function (x, y, image, options) {
        requireActiveContext(context);
        drawImageCall(
          (path, drawOptions, matrixPointer) =>
            module._muhammara_wasm_writer_draw_image(
              recipe,
              x,
              y,
              path,
              drawOptions.index,
              drawOptions.method,
              matrixPointer,
              drawOptions.width,
              drawOptions.height,
              drawOptions.proportional ? 1 : 0,
              drawOptions.fit,
            ),
          x,
          y,
          image,
          options,
          directImagePaths,
        );
        return context;
      };
      context.drawImageAsync = async function (x, y, image, options) {
        return context.drawImage(
          x,
          y,
          await normalizeBytesAsync(image, "Image bytes"),
          options,
        );
      };
      return context;
    }

    if (!recipe) {
      throw new Error("Unable to create PDF writer");
    }

    class PDFUsedFont {
      constructor(font) {
        this._font = font;
        this._recipe = recipe;
        this._owner = owner;
      }

      calculateTextDimensions(text, size = 1) {
        if (
          ended ||
          typeof text !== "string" ||
          !Number.isFinite(size) ||
          size <= 0
        ) {
          throw new TypeError("Text and a positive font size are required");
        }
        var resultPointer = module._malloc(48);
        try {
          return withString(text, (textPointer) => {
            if (
              !module._muhammara_wasm_writer_font_text_dimensions(
                recipe,
                this._font,
                textPointer,
                size,
                resultPointer,
              )
            ) {
              throw new Error("Unable to measure text");
            }
            var offset = resultPointer >>> 3;
            return {
              xMin: module.HEAPF64[offset],
              yMin: module.HEAPF64[offset + 1],
              xMax: module.HEAPF64[offset + 2],
              yMax: module.HEAPF64[offset + 3],
              width: module.HEAPF64[offset + 4],
              height: module.HEAPF64[offset + 5],
            };
          });
        } finally {
          module._free(resultPointer);
        }
      }

      getFontMetrics(size = 1) {
        if (ended || !Number.isFinite(size) || size <= 0) {
          throw new TypeError("A positive font size is required");
        }
        var resultPointer = module._malloc(64);
        try {
          if (
            !module._muhammara_wasm_writer_font_metrics(
              recipe,
              this._font,
              size,
              resultPointer,
            )
          ) {
            throw new Error("Unable to read font metrics");
          }
          var offset = resultPointer >>> 3;
          return {
            pixelsPerEm: {
              x: module.HEAPF64[offset],
              y: module.HEAPF64[offset + 1],
              xScale: module.HEAPF64[offset + 2],
              yScale: module.HEAPF64[offset + 3],
            },
            ascender: module.HEAPF64[offset + 4],
            descender: module.HEAPF64[offset + 5],
            height: module.HEAPF64[offset + 6],
            max_advance: module.HEAPF64[offset + 7],
          };
        } finally {
          module._free(resultPointer);
        }
      }
    }

    class ImageXObject {
      constructor(handle) {
        this._handle = handle;
        this._recipe = recipe;
        this._owner = owner;
        this.id = module._muhammara_wasm_image_get_object_id(handle);
      }
    }

    class FormXObject {
      constructor(handle, ended, objectId) {
        this._handle = handle;
        this._recipe = recipe;
        this._owner = owner;
        this._ended = ended;
        this._objectId = objectId;
        this.id = objectId || module._muhammara_wasm_form_get_object_id(handle);
      }

      getContentContext() {
        if (ended || this._ended) {
          throw new Error("Form XObject content is not writable");
        }
        var form = this;
        function operator(name, code, args = [], integers = false) {
          if (ended || form._ended) {
            throw new Error("Form XObject content has ended");
          }
          if (!args.every(Number.isFinite)) {
            throw new TypeError(`${name} requires finite numeric arguments`);
          }
          if (integers && !args.every(Number.isInteger)) {
            throw new TypeError(`${name} requires integer numeric arguments`);
          }
          if (
            !module._muhammara_wasm_writer_form_operator(
              recipe,
              form._handle,
              code,
              ...args,
            )
          ) {
            throw new Error(`Unable to apply ${name} to form XObject`);
          }
          return context;
        }
        var context = {
          writeFreeCode: function (freeCode) {
            return writeFreeCode(
              context,
              () => {
                if (ended || form._ended) {
                  throw new Error("Form XObject content has ended");
                }
              },
              (pointer, length) =>
                module._muhammara_wasm_writer_form_write_free_code(
                  recipe,
                  form._handle,
                  pointer,
                  length,
                ),
              freeCode,
            );
          },
          setOpacity: function (opacity) {
            if (ended || form._ended) {
              throw new Error("Form XObject content has ended");
            }
            if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
              throw new TypeError(
                "Wrong Argument, please provide 1 opacity value between 0 and 1",
              );
            }
            if (
              !module._muhammara_wasm_writer_form_set_opacity(
                recipe,
                form._handle,
                opacity,
              )
            ) {
              throw new Error("Unable to set opacity");
            }
            return context;
          },
          b: function () {
            return operator("b", 0);
          },
          B: function () {
            return operator("B", 1);
          },
          bStar: function () {
            return operator("bStar", 2);
          },
          BStar: function () {
            return operator("BStar", 3);
          },
          s: function () {
            return operator("s", 4);
          },
          F: function () {
            return operator("F", 7);
          },
          fStar: function () {
            return operator("fStar", 8);
          },
          n: function () {
            return operator("n", 9);
          },
          c: function (...args) {
            return operator("c", 12, args);
          },
          v: function (...args) {
            return operator("v", 13, args);
          },
          y: function (...args) {
            return operator("y", 14, args);
          },
          h: function () {
            return operator("h", 15);
          },
          J: function (value) {
            return operator("J", 21, [value]);
          },
          j: function (value) {
            return operator("j", 22, [value]);
          },
          M: function (value) {
            return operator("M", 23, [value]);
          },
          d: function (dash, phase = 0) {
            if (ended || form._ended) {
              throw new Error("Form XObject content has ended");
            }
            if (
              !Array.isArray(dash) ||
              !dash.every(Number.isFinite) ||
              !Number.isFinite(phase)
            ) {
              throw new TypeError("d requires a finite dash array and phase");
            }
            return withDoubles(dash, (pointer) => {
              if (
                !module._muhammara_wasm_writer_form_dash(
                  recipe,
                  form._handle,
                  pointer,
                  dash.length,
                  phase,
                )
              ) {
                throw new Error("Unable to set dash pattern");
              }
              return context;
            });
          },
          rg: function (...args) {
            return operator("rg", 26, args);
          },
          RG: function (...args) {
            return operator("RG", 27, args);
          },
          K: function (...args) {
            return operator("K", 29, args);
          },
          W: function () {
            return operator("W", 30);
          },
          WStar: function () {
            return operator("WStar", 31);
          },
          q: function () {
            return operator("q", 17);
          },
          Q: function () {
            return operator("Q", 18);
          },
          cm: function (...args) {
            return operator("cm", 19, args);
          },
          Tc: function (characterSpace) {
            return operator("Tc", 35, [characterSpace]);
          },
          Tw: function (wordSpace) {
            return operator("Tw", 36, [wordSpace]);
          },
          Tz: function (horizontalScaling) {
            return operator("Tz", 37, [horizontalScaling], true);
          },
          TL: function (textLeading) {
            return operator("TL", 38, [textLeading]);
          },
          Tr: function (renderingMode) {
            return operator("Tr", 39, [renderingMode], true);
          },
          Ts: function (fontRise) {
            return operator("Ts", 40, [fontRise]);
          },
          k: function (...args) {
            return operator("k", 28, args);
          },
          G: function (value) {
            return operator("G", 25, [value]);
          },
          w: function (value) {
            return operator("w", 20, [value]);
          },
          m: function (...args) {
            return operator("m", 10, args);
          },
          l: function (...args) {
            return operator("l", 11, args);
          },
          re: function (...args) {
            return operator("re", 16, args);
          },
          f: function () {
            return operator("f", 6);
          },
          S: function () {
            return operator("S", 5);
          },
          doXObject: function (xobject) {
            if (ended || form._ended) {
              throw new Error("Form XObject content has ended");
            }
            if (Number.isInteger(xobject) && xobject > 0) {
              if (
                !module._muhammara_wasm_writer_form_do_form_object_id(
                  recipe,
                  form._handle,
                  xobject,
                )
              ) {
                throw new Error("Unable to place XObject");
              }
              return context;
            }
            if (typeof xobject === "string") {
              return withString(xobject, (pointer) => {
                if (
                  !module._muhammara_wasm_writer_form_do_xobject_name(
                    recipe,
                    form._handle,
                    pointer,
                  )
                ) {
                  throw new Error("Unable to place XObject");
                }
                return context;
              });
            }
            if (
              !(
                xobject instanceof ImageXObject ||
                xobject instanceof FormXObject
              ) ||
              xobject._owner !== owner ||
              (xobject instanceof FormXObject && !xobject._ended)
            ) {
              throw new TypeError(
                "doXObject requires a completed XObject from this writer",
              );
            }
            var placed =
              xobject instanceof FormXObject && xobject._objectId
                ? module._muhammara_wasm_writer_form_do_form_object_id(
                    recipe,
                    form._handle,
                    xobject._objectId,
                  )
                : module._muhammara_wasm_writer_form_do_xobject(
                    recipe,
                    form._handle,
                    xobject._handle,
                    xobject instanceof FormXObject ? 1 : 0,
                  );
            if (!placed) throw new Error("Unable to place XObject");
            return context;
          },
        };
        context.BT = function () {
          return operator("BT", 32);
        };
        context.ET = function () {
          return operator("ET", 33);
        };
        context.Tm = function (...args) {
          return operator("Tm", 34, args);
        };
        context.Td = function (x, y) {
          return operator("Td", 41, [x, y]);
        };
        context.TD = function (x, y) {
          return operator("TD", 42, [x, y]);
        };
        context.TStar = function () {
          return operator("TStar", 43);
        };
        context.Tf = function (font, size) {
          if (
            !(
              (font instanceof PDFUsedFont && font._owner === owner) ||
              typeof font === "string"
            ) ||
            !Number.isFinite(size) ||
            size <= 0
          ) {
            throw new TypeError(
              "Tf requires a font from this writer and a positive size",
            );
          }
          if (typeof font === "string")
            return withString(font, (pointer) => {
              if (
                !module._muhammara_wasm_writer_form_set_font_name(
                  recipe,
                  form._handle,
                  pointer,
                  size,
                )
              )
                throw new Error("Unable to set font");
              return context;
            });
          if (
            !module._muhammara_wasm_writer_form_set_font(
              recipe,
              form._handle,
              font._font,
              size,
            )
          )
            throw new Error("Unable to set font");
          return context;
        };
        context.drawImage = function (x, y, image, options) {
          if (ended || form._ended) {
            throw new Error("Form XObject content has ended");
          }
          drawImageCall(
            (path, drawOptions, matrixPointer) =>
              module._muhammara_wasm_writer_form_draw_image(
                recipe,
                form._handle,
                x,
                y,
                path,
                drawOptions.index,
                drawOptions.method,
                matrixPointer,
                drawOptions.width,
                drawOptions.height,
                drawOptions.proportional ? 1 : 0,
                drawOptions.fit,
              ),
            x,
            y,
            image,
            options,
            directImagePaths,
          );
          return context;
        };
        context.drawImageAsync = async function (x, y, image, options) {
          return context.drawImage(
            x,
            y,
            await normalizeBytesAsync(image, "Image bytes"),
            options,
          );
        };
        context.Tj = function (text, options) {
          if (typeof text === "string")
            return withString(text, (pointer) => {
              if (
                !module._muhammara_wasm_writer_form_show_text_operator(
                  recipe,
                  form._handle,
                  0,
                  textEncoding(options),
                  0,
                  0,
                  pointer,
                )
              )
                throw new Error("Unable to show text");
              return context;
            });
          if (options !== undefined)
            throw new TypeError("glyph text has no encoding options");
          return withGlyphs(text, (pointer) => {
            if (
              !module._muhammara_wasm_writer_form_show_glyphs_operator(
                recipe,
                form._handle,
                0,
                0,
                0,
                pointer,
                text.length,
              )
            )
              throw new Error("Unable to show glyph text");
            return context;
          });
        };
        addTextShowingOperators(
          context,
          () => {
            if (ended || form._ended)
              throw new Error("Form XObject content has ended");
          },
          {
            text: (...args) =>
              module._muhammara_wasm_writer_form_show_text_operator(
                recipe,
                form._handle,
                ...args,
              ),
            glyphs: (...args) =>
              module._muhammara_wasm_writer_form_show_glyphs_operator(
                recipe,
                form._handle,
                ...args,
              ),
            tj: (...args) =>
              module._muhammara_wasm_writer_form_show_tj(
                recipe,
                form._handle,
                ...args,
              ),
          },
        );
        addStructuredContentOperators(
          context,
          () => {
            if (ended || form._ended) {
              throw new Error("Form XObject content has ended");
            }
          },
          (...args) =>
            module._muhammara_wasm_writer_form_structured_operator(
              recipe,
              form._handle,
              ...args,
            ),
        );
        function applyHighLevelColor(options, stroke) {
          if (!options || options.color === undefined) return;
          var color = colorValue(options.color) >>> 0;
          var colorspace = options.colorspace || "rgb";
          if (colorspace === "rgb") {
            return stroke
              ? context.RG(
                  ((color >> 16) & 0xff) / 255,
                  ((color >> 8) & 0xff) / 255,
                  (color & 0xff) / 255,
                )
              : context.rg(
                  ((color >> 16) & 0xff) / 255,
                  ((color >> 8) & 0xff) / 255,
                  (color & 0xff) / 255,
                );
          }
          if (colorspace === "gray")
            return stroke
              ? context.G((color & 0xff) / 255)
              : context.g((color & 0xff) / 255);
          if (colorspace === "cmyk") {
            var values = [
              ((color >> 24) & 0xff) / 255,
              ((color >> 16) & 0xff) / 255,
              ((color >> 8) & 0xff) / 255,
              (color & 0xff) / 255,
            ];
            return stroke ? context.K(...values) : context.k(...values);
          }
          throw new TypeError("colorspace must be rgb, gray, or cmyk");
        }
        function finishHighLevelPath(options) {
          options = options || {};
          var stroke = options.type !== "fill";
          applyHighLevelColor(options, stroke);
          if (stroke && options.width !== undefined) context.w(options.width);
          return options.type === "fill"
            ? context.f()
            : options.close
              ? context.s()
              : context.S();
        }
        context.drawRectangle = function (x, y, width, height, options) {
          if (![x, y, width, height].every(Number.isFinite))
            throw new TypeError(
              "drawRectangle requires four finite coordinates",
            );
          context.re(x, y, width, height);
          return finishHighLevelPath(
            options && typeof options === "object" ? options : {},
          );
        };
        context.drawSquare = function (x, y, edge, options) {
          if (![x, y, edge].every(Number.isFinite))
            throw new TypeError("drawSquare requires three finite coordinates");
          return context.drawRectangle(x, y, edge, edge, options);
        };
        context.drawCircle = function (x, y, radius, options) {
          if (![x, y, radius].every(Number.isFinite))
            throw new TypeError("drawCircle requires three finite coordinates");
          var control = radius * 0.5522847498307936;
          context
            .m(x + radius, y)
            .c(x + radius, y + control, x + control, y + radius, x, y + radius)
            .c(x - control, y + radius, x - radius, y + control, x - radius, y)
            .c(x - radius, y - control, x - control, y - radius, x, y - radius)
            .c(x + control, y - radius, x + radius, y - control, x + radius, y);
          return finishHighLevelPath(
            options && typeof options === "object" ? options : {},
          );
        };
        context.drawPath = function (...args) {
          var points;
          var options;
          if (Array.isArray(args[0])) {
            if (args.length > 2)
              throw new TypeError(
                "drawPath accepts coordinate pairs and an optional options object",
              );
            points = args[0];
            options = args[1] ?? {};
          } else {
            options = args.at(-1);
            var coordinates = args.slice(0, -1);
            if (
              args.length < 5 ||
              !options ||
              typeof options !== "object" ||
              Array.isArray(options) ||
              coordinates.length % 2 !== 0
            )
              throw new TypeError(
                "drawPath requires coordinate pairs and an options object",
              );
            points = [];
            for (var index = 0; index < coordinates.length; index += 2)
              points.push([coordinates[index], coordinates[index + 1]]);
          }
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
          )
            throw new TypeError(
              "drawPath requires at least two coordinate pairs of finite numbers",
            );
          context.m(...points[0]);
          for (var index = 1; index < points.length; index += 1)
            context.l(...points[index]);
          return finishHighLevelPath(options);
        };
        context.writeText = function (text, x, y, options = {}) {
          if (
            typeof text !== "string" ||
            ![x, y].every(Number.isFinite) ||
            !options ||
            typeof options !== "object" ||
            !(options.font instanceof PDFUsedFont) ||
            options.font._owner !== owner
          )
            throw new TypeError(
              "writeText requires text, coordinates, and a writer font",
            );
          var size = options.size ?? 1;
          if (!Number.isFinite(size) || size <= 0)
            throw new RangeError("writeText requires a positive font size");
          context.BT();
          applyHighLevelColor(options, false);
          context.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
          if (options.underline) {
            var dimensions = options.font.calculateTextDimensions(text, size);
            context
              .w(Math.max(size * 0.05, 0.1))
              .m(x, y + dimensions.yMin)
              .l(x + dimensions.width, y + dimensions.yMin)
              .S();
          }
          return context;
        };
        return context;
      }

      getContentStream() {
        if (ended || this._ended) {
          throw new Error("Form XObject content stream is no longer active");
        }
        var stream = module._muhammara_wasm_form_get_content_stream(
          recipe,
          this._handle,
        );
        if (!stream)
          throw new Error("Form XObject content stream is no longer active");
        var form = this;
        return {
          getWriteStream: function () {
            if (ended || form._ended) {
              throw new Error(
                "Form XObject content stream is no longer active",
              );
            }
            var writer =
              module._muhammara_wasm_content_stream_get_write_stream(stream);
            if (!writer)
              throw new Error(
                "Form XObject content stream is no longer active",
              );
            return {
              write: function (bytes) {
                if (ended || form._ended) {
                  throw new Error(
                    "Form XObject content stream is no longer active",
                  );
                }
                return writeNativeBytes(
                  module,
                  (pointer, length) =>
                    module._muhammara_wasm_content_byte_writer_write(
                      writer,
                      pointer,
                      length,
                    ),
                  bytes,
                );
              },
            };
          },
        };
      }

      getResourcesDictionary() {
        if (ended || this._ended) {
          throw new Error("Form XObject resources are not active");
        }
        var handle = module._muhammara_wasm_writer_get_form_resources(
          recipe,
          this._handle,
        );
        if (!handle) throw new Error("Unable to get form resources");
        return resourcesDictionary(handle, () => {
          if (ended || this._ended) {
            throw new Error("Form XObject resources are not active");
          }
        });
      }

      getResourcesDictinary() {
        return this.getResourcesDictionary();
      }
    }

    function imagePath(name, expectedType) {
      if (ended || typeof name !== "string" || !images.has(name)) {
        throw new TypeError("A registered image name is required");
      }
      var type = imageTypes.get(name);
      if (expectedType !== undefined && type !== expectedType) {
        throw new TypeError(`Registered image is not a ${expectedType}`);
      }
      return images.get(name);
    }

    function withImagePathOrBytes(value, label, expectedType, callback) {
      if (typeof value === "string")
        return callback(imagePath(value, expectedType));
      var bytes = normalizeBytes(value, label);
      var path = `/images/${state.nextAsset++}.tiff`;
      module.FS.mkdirTree("/images");
      module.FS.writeFile(path, bytes);
      try {
        return callback(path);
      } finally {
        module.FS.unlink(path);
      }
    }

    function imageBytes(value) {
      if (typeof value !== "string")
        return normalizeBytes(value, "Image bytes");
      if (ended) throw new Error("PDF writer has ended");
      var path = images.get(value) || pdfs.get(value);
      if (!path)
        throw new TypeError("A registered image or PDF name is required");
      return new Uint8Array(module.FS.readFile(path));
    }

    function getImageDimensions(image, imageIndex = 0) {
      requireOpenWriter();
      if (
        !Number.isSafeInteger(imageIndex) ||
        imageIndex < 0 ||
        imageIndex > 0xffffffff
      ) {
        throw new RangeError(
          "imageIndex must be a non-negative 32-bit integer",
        );
      }
      var bytes = imageBytes(image);
      var valuesPointer = module._malloc(16);
      try {
        return withBytes(bytes, (bytesPointer) => {
          if (
            !module._muhammara_wasm_writer_image_dimensions(
              recipe,
              bytesPointer,
              bytes.length,
              imageIndex,
              valuesPointer,
            )
          ) {
            throw new Error("Unable to read image dimensions");
          }
          var offset = valuesPointer >>> 3;
          return {
            width: module.HEAPF64[offset],
            height: module.HEAPF64[offset + 1],
          };
        });
      } finally {
        module._free(valuesPointer);
      }
    }

    function withPdfPathOrBytes(value, callback) {
      if (typeof value === "string") {
        var registeredPath = pdfs.get(value);
        if (!registeredPath) throw new Error(`Unknown PDF: ${value}`);
        return callback(registeredPath);
      }
      var bytes = normalizeBytes(value, "PDF input");
      var path = `/pdfs/${state.nextPdf++}.pdf`;
      module.FS.mkdirTree("/pdfs");
      module.FS.writeFile(path, bytes);
      try {
        return callback(path);
      } finally {
        module.FS.unlink(path);
      }
    }

    function optionalObjectId(value) {
      if (value === undefined) return 0;
      if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff) {
        throw new RangeError("objectId must be a positive object ID");
      }
      return value;
    }

    function appendPDFPagesFromPDF(source, options = {}) {
      requireOpenWriter();
      if (currentPage) {
        throw new Error("Finish the active page before appending PDF pages");
      }
      if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Append options must be an object");
      }
      if ("password" in options) {
        throw new TypeError("PDF passwords are not supported in Wasm");
      }
      var rangeType = options.type ?? constants.eRangeTypeAll;
      if (
        !Number.isInteger(rangeType) ||
        ![constants.eRangeTypeAll, constants.eRangeTypeSpecific].includes(
          rangeType,
        )
      ) {
        throw new RangeError("A valid page range type is required");
      }
      var ranges = options.specificRanges ?? [];
      if (
        !Array.isArray(ranges) ||
        !ranges.every(
          (range) =>
            Array.isArray(range) &&
            range.length === 2 &&
            range.every(
              (index) =>
                Number.isInteger(index) && index >= 0 && index <= 0xffffffff,
            ) &&
            range[1] >= range[0],
        )
      ) {
        throw new RangeError(
          "specificRanges must contain non-negative inclusive page ranges",
        );
      }
      if (rangeType === constants.eRangeTypeSpecific && ranges.length === 0) {
        throw new RangeError("A specific page range is required");
      }
      var selectedRanges =
        rangeType === constants.eRangeTypeSpecific ? ranges : [];
      var bytes = normalizeBytes(source, "PDF input");
      return withBytes(bytes, (bytesPointer) => {
        var errorPointer = module._malloc(4);
        var countPointer = module._malloc(4);
        var rangesPointer = selectedRanges.length
          ? module._malloc(selectedRanges.length * 8)
          : 0;
        try {
          if (rangesPointer) {
            module.HEAPU32.set(selectedRanges.flat(), rangesPointer >>> 2);
          }
          var idsPointer = module._muhammara_wasm_writer_append_pages_from_pdf(
            recipe,
            bytesPointer,
            bytes.length,
            rangesPointer,
            selectedRanges.length,
            errorPointer,
            countPointer,
          );
          var errorCode = module.HEAP32[errorPointer >>> 2];
          var count = module.HEAPU32[countPointer >>> 2];
          if (errorCode === 2) {
            throw new Error("Encrypted PDF input is not supported in Wasm");
          }
          if (errorCode !== 0) {
            throw new Error("Unable to append PDF pages from input bytes");
          }
          try {
            return idsPointer
              ? Array.from(
                  module.HEAPU32.subarray(
                    idsPointer >>> 2,
                    (idsPointer >>> 2) + count,
                  ),
                )
              : [];
          } finally {
            if (idsPointer) module._muhammara_wasm_free(idsPointer);
          }
        } finally {
          module._free(errorPointer);
          module._free(countPointer);
          if (rangesPointer) module._free(rangesPointer);
        }
      });
    }

    function mergePDFPagesToPage(targetPage, source, options, callback) {
      requireOpenWriter();
      if (typeof options === "function") {
        callback = options;
        options = {};
      } else {
        options = options ?? {};
      }
      if (callback !== undefined && typeof callback !== "function") {
        throw new TypeError("Merge callback must be a function");
      }
      if (!(targetPage instanceof PDFPage)) {
        throw new TypeError("A writable target PDFPage is required");
      }
      if (currentPage && targetPage !== currentPage) {
        throw new Error("The active target PDFPage is required");
      }
      if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Merge options must be an object");
      }
      if ("password" in options) {
        throw new TypeError("PDF passwords are not supported in Wasm");
      }
      if ("callback" in options) {
        throw new TypeError("Merge callback must be provided as an argument");
      }
      var rangeType = options.type ?? constants.eRangeTypeAll;
      if (
        !Number.isInteger(rangeType) ||
        ![constants.eRangeTypeAll, constants.eRangeTypeSpecific].includes(
          rangeType,
        )
      ) {
        throw new RangeError("A valid page range type is required");
      }
      var ranges = options.specificRanges ?? [];
      if (
        !Array.isArray(ranges) ||
        !ranges.every(
          (range) =>
            Array.isArray(range) &&
            range.length === 2 &&
            range.every(
              (index) =>
                Number.isInteger(index) && index >= 0 && index <= 0xffffffff,
            ) &&
            range[1] >= range[0],
        )
      ) {
        throw new RangeError(
          "specificRanges must contain non-negative inclusive page ranges",
        );
      }
      if (rangeType === constants.eRangeTypeSpecific && ranges.length === 0) {
        throw new RangeError("A specific page range is required");
      }
      if (!currentPage) writer.startPageContentContext(targetPage);
      var selectedRanges =
        rangeType === constants.eRangeTypeSpecific ? ranges : [];
      var bytes = normalizeBytes(source, "PDF input");
      return withBytes(bytes, (bytesPointer) => {
        var errorPointer = module._malloc(4);
        var rangesPointer = selectedRanges.length
          ? module._malloc(selectedRanges.length * 8)
          : 0;
        try {
          if (rangesPointer) {
            module.HEAPU32.set(selectedRanges.flat(), rangesPointer >>> 2);
          }
          var success =
            module._muhammara_wasm_writer_merge_pages_to_page_from_pdf(
              recipe,
              bytesPointer,
              bytes.length,
              rangesPointer,
              selectedRanges.length,
              errorPointer,
            );
          var errorCode = module.HEAP32[errorPointer >>> 2];
          if (errorCode === 2) {
            throw new Error("Encrypted PDF input is not supported in Wasm");
          }
          if (!success) {
            throw new Error("Unable to merge PDF pages from input bytes");
          }
          // Wasm cannot re-enter JavaScript during the synchronous native merge.
          // Invoke the browser callback once the full merge has completed.
          if (callback) callback();
          return writer;
        } finally {
          module._free(errorPointer);
          if (rangesPointer) module._free(rangesPointer);
        }
      });
    }

    function createImageForm(name, expectedType, objectId) {
      var path = imagePath(name, expectedType);
      var types = { jpeg: 0, png: 1, tiff: 2 };
      var handle = withString(path, (pointer) =>
        module._muhammara_wasm_writer_create_image_form(
          recipe,
          pointer,
          types[imageTypes.get(name)],
          optionalObjectId(objectId),
        ),
      );
      if (!handle) throw new Error("Unable to create image form XObject");
      return new FormXObject(handle, true, objectId);
    }

    var writer = {
      appendPDFPagesFromPDF: function (source, options) {
        return appendPDFPagesFromPDF(source, options);
      },
      appendPDFPagesFromPDFAsync: async function (source, options) {
        return appendPDFPagesFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          options,
        );
      },
      mergePDFPagesToPage: function (targetPage, source, options, callback) {
        return mergePDFPagesToPage(targetPage, source, options, callback);
      },
      mergePDFPagesToPageAsync: async function (
        targetPage,
        source,
        options,
        callback,
      ) {
        return mergePDFPagesToPage(
          targetPage,
          await normalizeBytesAsync(source, "PDF input"),
          options,
          callback,
        );
      },
      getDocumentContext: function () {
        requireOpenWriter();
        return documentContext;
      },
      createPDFTextString: function (value) {
        return new PDFTextString(value);
      },
      createPDFDate: function (value) {
        return new PDFDate(value);
      },
      getObjectsContext: function () {
        requireOpenWriter();
        if (!objectsContext) {
          var handle =
            module._muhammara_wasm_recipe_get_objects_context(recipe);
          if (!handle) throw new Error("Unable to get objects context");
          objectsContext = rawObjectsContext(handle, requireOpenWriter);
        }
        return objectsContext;
      },
      attachURLLinktoCurrentPage: function (url, left, bottom, right, top) {
        requireOpenWriter();
        if (
          typeof url !== "string" ||
          ![left, bottom, right, top].every(Number.isFinite) ||
          right < left ||
          top < bottom
        ) {
          throw new TypeError(
            "URL link requires a URL and valid PDF rectangle",
          );
        }
        withString(url, (pointer) => {
          if (
            !module._muhammara_wasm_writer_attach_url_link(
              recipe,
              pointer,
              left,
              bottom,
              right,
              top,
            )
          ) {
            throw new Error("Unable to attach URL link to current page");
          }
        });
        return this;
      },
      createAnnotation: function (subtype, left, bottom, right, top, options) {
        requireOpenWriter();
        return createAnnotation(
          (...args) =>
            module._muhammara_wasm_writer_create_annotation(recipe, ...args),
          subtype,
          left,
          bottom,
          right,
          top,
          options,
        );
      },
      registerAnnotationReferenceForNextPageWrite: function (objectId) {
        requireOpenWriter();
        if (!Number.isInteger(objectId) || objectId <= 0) {
          throw new RangeError("Annotation object ID must be positive");
        }
        // The raw object context owns serialization; this convenience is native-backed.
        if (
          !module._muhammara_wasm_writer_register_annotation(recipe, objectId)
        ) {
          throw new Error("Unable to register annotation for the current page");
        }
        return this;
      },
      getFontForBytes: function (name, metricsNameOrIndex, fontIndex) {
        if (ended || typeof name !== "string") {
          throw new TypeError(
            "getFontForBytes requires a registered font name",
          );
        }
        var metricsName;
        if (metricsNameOrIndex === undefined) {
          if (fontIndex !== undefined) {
            throw new TypeError(
              "getFontForBytes requires a metrics name before a font index",
            );
          }
          fontIndex = 0;
        } else if (typeof metricsNameOrIndex === "number") {
          if (fontIndex !== undefined) {
            throw new TypeError(
              "getFontForBytes requires a metrics name before a font index",
            );
          }
          metricsName = undefined;
          fontIndex = metricsNameOrIndex;
        } else if (typeof metricsNameOrIndex === "string") {
          metricsName = metricsNameOrIndex;
          fontIndex = fontIndex ?? 0;
        } else {
          throw new TypeError(
            "getFontForBytes requires a metrics name or font index",
          );
        }
        if (
          !Number.isInteger(fontIndex) ||
          fontIndex < 0 ||
          fontIndex > 0xffffffff
        ) {
          throw new RangeError(
            "Font index must be a non-negative 32-bit integer",
          );
        }
        var fontPath = fonts.get(name);
        var metricsPath =
          metricsName === undefined ? null : fonts.get(metricsName);
        if (!fontPath || (metricsName !== undefined && !metricsPath)) {
          throw new Error(`Unknown font: ${metricsName || name}`);
        }
        var font = withString(fontPath, (fontPointer) =>
          metricsPath === null
            ? module._muhammara_wasm_writer_get_font_for_bytes(
                recipe,
                fontPointer,
                0,
                fontIndex,
              )
            : withString(metricsPath, (metricsPointer) =>
                module._muhammara_wasm_writer_get_font_for_bytes(
                  recipe,
                  fontPointer,
                  metricsPointer,
                  fontIndex,
                ),
              ),
        );
        if (!font) throw new Error("Unable to load registered font bytes");
        return new PDFUsedFont(font);
      },
      requireCatalogUpdate: function () {
        requireOpenWriter();
        if (!module._muhammara_wasm_writer_require_catalog_update(recipe)) {
          throw new Error("Unable to require catalog update");
        }
      },
      getImageDimensions: function (image, imageIndex) {
        return getImageDimensions(image, imageIndex);
      },
      getImageDimensionsAsync: async function (image, imageIndex) {
        return getImageDimensions(
          await normalizeBytesAsync(image, "Image bytes"),
          imageIndex,
        );
      },
      getImageType: function (image) {
        var type = withImagePathOrBytes(
          image,
          "Image bytes",
          undefined,
          (path) =>
            withString(path, (pointer) =>
              module._muhammara_wasm_writer_get_image_type(recipe, pointer),
            ),
        );
        return [undefined, "PDF", "JPG", "TIFF", "PNG"][type];
      },
      getImageTypeAsync: async function (image) {
        return this.getImageType(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      getImagePagesCount: function (image) {
        return withImagePathOrBytes(image, "Image bytes", undefined, (path) =>
          withString(path, (pointer) =>
            module._muhammara_wasm_writer_get_image_pages_count(
              recipe,
              pointer,
            ),
          ),
        );
      },
      getImagePagesCountAsync: async function (image) {
        return this.getImagePagesCount(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      retrieveJPGImageInformation: function (image) {
        requireOpenWriter();
        var bytes;
        if (typeof image === "string") {
          bytes = module.FS.readFile(imagePath(image, "jpeg"));
        } else {
          bytes = normalizeBytes(image, "JPEG bytes");
        }
        var valuesPointer = module._malloc(14 * 8);
        try {
          return withBytes(bytes, (bytesPointer) => {
            if (
              !module._muhammara_wasm_writer_retrieve_jpg_image_information(
                recipe,
                bytesPointer,
                bytes.length,
                valuesPointer,
              )
            ) {
              throw new Error("Unable to retrieve JPEG image information");
            }
            var values = module.HEAPF64.subarray(
              valuesPointer >>> 3,
              (valuesPointer >>> 3) + 14,
            );
            var information = {
              samplesWidth: values[0],
              samplesHeight: values[1],
              colorComponentsCount: values[2],
              JFIFInformationExists: Boolean(values[3]),
              ExifInformationExists: Boolean(values[7]),
              PhotoshopInformationExists: Boolean(values[11]),
            };
            if (information.JFIFInformationExists) {
              information.JFIFUnit = values[4];
              information.JFIFXDensity = values[5];
              information.JFIFYDensity = values[6];
            }
            if (information.ExifInformationExists) {
              information.ExifUnit = values[8];
              information.ExifXDensity = values[9];
              information.ExifYDensity = values[10];
            }
            if (information.PhotoshopInformationExists) {
              information.PhotoshopXDensity = values[12];
              information.PhotoshopYDensity = values[13];
            }
            return information;
          });
        } finally {
          module._free(valuesPointer);
        }
      },
      retrieveJPGImageInformationAsync: async function (image) {
        return this.retrieveJPGImageInformation(
          await normalizeBytesAsync(image, "JPEG bytes"),
        );
      },
      createImageXObjectFromJPGBytes: function (name, objectId) {
        var path = imagePath(name, "jpeg");
        var handle = withString(path, (pointer) =>
          module._muhammara_wasm_writer_create_jpg_image(
            recipe,
            pointer,
            optionalObjectId(objectId),
          ),
        );
        if (!handle) throw new Error("Unable to create JPEG image XObject");
        return new ImageXObject(handle);
      },
      createFormXObjectFromJPGBytes: function (name, objectId) {
        return createImageForm(name, "jpeg", objectId);
      },
      createFormXObjectFromPNGBytes: function (name, objectId) {
        return createImageForm(name, "png", objectId);
      },
      createFormXObjectFromTIFF: function (image, options = {}) {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
          throw new TypeError("TIFF options must be an object");
        }
        function treatment(name) {
          var value = options[name];
          if (value === undefined) return undefined;
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new TypeError(`TIFF ${name} must be an object`);
          }
          return value;
        }
        function color(name, value) {
          if (value === undefined)
            return { components: 0, values: [0, 0, 0, 0] };
          if (
            !Array.isArray(value) ||
            (value.length !== 3 && value.length !== 4) ||
            !value.every(
              (component) =>
                Number.isInteger(component) &&
                component >= 0 &&
                component <= 255,
            )
          ) {
            throw new TypeError(
              `TIFF ${name} must be an RGB (3) or CMYK (4) array of integers from 0 to 255`,
            );
          }
          return {
            components: value.length,
            values: [...value, 0].slice(0, 4),
          };
        }
        var bwTreatment = treatment("bwTreatment");
        var grayscaleTreatment = treatment("grayscaleTreatment");
        var bwColor = color("bwTreatment.oneColor", bwTreatment?.oneColor);
        var grayscaleOneColor = color(
          "grayscaleTreatment.oneColor",
          grayscaleTreatment?.oneColor,
        );
        var grayscaleZeroColor = color(
          "grayscaleTreatment.zeroColor",
          grayscaleTreatment?.zeroColor,
        );
        var pageIndex = options.pageIndex ?? 0;
        if (!Number.isInteger(pageIndex) || pageIndex < 0) {
          throw new RangeError("TIFF pageIndex must be a non-negative integer");
        }
        var objectId = optionalObjectId(options.objectId);
        var handle = withImagePathOrBytes(image, "TIFF bytes", "tiff", (path) =>
          withString(path, (pointer) =>
            module._muhammara_wasm_writer_create_tiff_form(
              recipe,
              pointer,
              pageIndex,
              objectId,
              bwTreatment ? 1 : 0,
              bwTreatment?.asImageMask === true ? 1 : 0,
              bwColor.components,
              ...bwColor.values,
              grayscaleTreatment ? 1 : 0,
              grayscaleTreatment?.asColorMap === true ? 1 : 0,
              grayscaleOneColor.components,
              ...grayscaleOneColor.values,
              grayscaleZeroColor.components,
              ...grayscaleZeroColor.values,
            ),
          ),
        );
        if (!handle) throw new Error("Unable to create TIFF form XObject");
        return new FormXObject(handle, true, objectId || undefined);
      },
      createFormXObjectFromTIFFBytes: function (image, options) {
        return this.createFormXObjectFromTIFF(image, options);
      },
      createFormXObjectFromTIFFAsync: async function (image, options) {
        return this.createFormXObjectFromTIFF(
          await normalizeBytesAsync(image, "TIFF bytes"),
          options,
        );
      },
      createFormXObjectFromTIFFBytesAsync: async function (image, options) {
        return this.createFormXObjectFromTIFFAsync(image, options);
      },
      createFormXObject: function (left, bottom, right, top, objectId) {
        if (![left, bottom, right, top].every(Number.isFinite)) {
          throw new TypeError(
            "createFormXObject requires four finite coordinates",
          );
        }
        objectId = optionalObjectId(objectId);
        var handle = module._muhammara_wasm_writer_create_form(
          recipe,
          left,
          bottom,
          right,
          top,
          objectId,
        );
        if (!handle) throw new Error("Unable to create form XObject");
        return new FormXObject(handle, false, objectId || undefined);
      },
      endFormXObject: function (form) {
        if (
          !(form instanceof FormXObject) ||
          form._owner !== owner ||
          form._ended ||
          ended
        ) {
          throw new TypeError(
            "endFormXObject requires an open form from this writer",
          );
        }
        if (!module._muhammara_wasm_writer_end_form(recipe, form._handle)) {
          throw new Error("Unable to finish form XObject");
        }
        form._ended = true;
        return this;
      },
      createFormXObjectsFromPDF: function (
        source,
        pageBox = constants.ePDFPageBoxMediaBox,
        options = {},
      ) {
        requireOpenWriter();
        var cropBox;
        if (Array.isArray(pageBox)) {
          cropBox = pageBox;
          pageBox = constants.ePDFPageBoxMediaBox;
        }
        if (!Number.isInteger(pageBox) || pageBox < 0 || pageBox > 4) {
          throw new RangeError("A valid page box is required");
        }
        if (!options || typeof options !== "object" || Array.isArray(options)) {
          throw new TypeError("PDF form options must be an object");
        }
        if ("password" in options) {
          throw new TypeError("PDF form passwords are not supported in Wasm");
        }
        var rangeType = options.type ?? constants.eRangeTypeAll;
        if (
          !Number.isInteger(rangeType) ||
          ![constants.eRangeTypeAll, constants.eRangeTypeSpecific].includes(
            rangeType,
          )
        ) {
          throw new RangeError("A valid page range type is required");
        }
        var ranges = options.specificRanges ?? [];
        if (
          !Array.isArray(ranges) ||
          !ranges.every(
            (range) =>
              Array.isArray(range) &&
              range.length === 2 &&
              range.every(
                (index) =>
                  Number.isInteger(index) && index >= 0 && index <= 0xffffffff,
              ) &&
              range[1] >= range[0],
          )
        ) {
          throw new RangeError(
            "specificRanges must contain non-negative inclusive page ranges",
          );
        }
        if (rangeType === constants.eRangeTypeSpecific && ranges.length === 0) {
          throw new RangeError("A specific page range is required");
        }
        var selectedRanges =
          rangeType === constants.eRangeTypeSpecific ? ranges : [];
        function finiteNumbers(name, value, length) {
          if (
            !Array.isArray(value) ||
            value.length !== length ||
            !value.every(Number.isFinite)
          ) {
            throw new TypeError(
              `${name} must be an array of ${length} finite numbers`,
            );
          }
          return value;
        }
        if (cropBox !== undefined) {
          cropBox = finiteNumbers("pageBox", cropBox, 4);
        }
        var transformation =
          options.transformation === undefined
            ? undefined
            : finiteNumbers("transformation", options.transformation, 6);
        var additionalObjectIds = options.additionalObjectIds ?? [];
        if (
          !Array.isArray(additionalObjectIds) ||
          !additionalObjectIds.every(
            (id) => Number.isInteger(id) && id >= 0 && id <= 0xffffffff,
          )
        ) {
          throw new RangeError(
            "additionalObjectIds must contain non-negative 32-bit object IDs",
          );
        }
        var bytes;
        if (typeof source === "string") {
          var registeredPath = pdfs.get(source);
          if (!registeredPath) throw new Error(`Unknown PDF: ${source}`);
          bytes = module.FS.readFile(registeredPath);
        } else {
          bytes = normalizeBytes(source, "PDF input");
        }
        return withBytes(bytes, (bytesPointer) => {
          var countPointer = module._malloc(4);
          var rangesPointer = selectedRanges.length
            ? module._malloc(selectedRanges.length * 8)
            : 0;
          var cropBoxPointer = cropBox ? module._malloc(4 * 8) : 0;
          var transformationPointer = transformation
            ? module._malloc(6 * 8)
            : 0;
          var additionalObjectIdsPointer = additionalObjectIds.length
            ? module._malloc(additionalObjectIds.length * 4)
            : 0;
          try {
            if (rangesPointer) {
              module.HEAPU32.set(selectedRanges.flat(), rangesPointer >>> 2);
            }
            if (cropBoxPointer) {
              module.HEAPF64.set(cropBox, cropBoxPointer >>> 3);
            }
            if (transformationPointer) {
              module.HEAPF64.set(transformation, transformationPointer >>> 3);
            }
            if (additionalObjectIdsPointer) {
              module.HEAPU32.set(
                additionalObjectIds,
                additionalObjectIdsPointer >>> 2,
              );
            }
            var idsPointer =
              module._muhammara_wasm_writer_create_forms_from_pdf(
                recipe,
                bytesPointer,
                bytes.length,
                pageBox,
                rangesPointer,
                selectedRanges.length,
                cropBoxPointer,
                transformationPointer,
                additionalObjectIdsPointer,
                additionalObjectIds.length,
                countPointer,
              );
            var count = module.HEAPU32[countPointer >>> 2];
            if (!idsPointer || !count) {
              throw new Error("Unable to create forms from PDF");
            }
            try {
              return Array.from(
                module.HEAPU32.subarray(
                  idsPointer >>> 2,
                  (idsPointer >>> 2) + count,
                ),
              );
            } finally {
              module._muhammara_wasm_free(idsPointer);
            }
          } finally {
            module._free(countPointer);
            if (rangesPointer) module._free(rangesPointer);
            if (cropBoxPointer) module._free(cropBoxPointer);
            if (transformationPointer) module._free(transformationPointer);
            if (additionalObjectIdsPointer)
              module._free(additionalObjectIdsPointer);
          }
        });
      },
      createFormXObjectsFromPDFAsync: async function (
        source,
        pageBox,
        options,
      ) {
        return this.createFormXObjectsFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          pageBox,
          options,
        );
      },
      createPDFCopyingContext: function (sourceBytes) {
        requireOpenWriter();
        sourceBytes = normalizeBytes(sourceBytes, "PDF input");
        var sourcePath = `/pdfs/${state.nextPdf++}.pdf`;
        module.FS.mkdirTree("/pdfs");
        module.FS.writeFile(sourcePath, sourceBytes);
        var copying;
        try {
          copying = withString(sourcePath, (pointer) =>
            module._muhammara_wasm_writer_create_copying_context(
              recipe,
              pointer,
            ),
          );
        } catch (error) {
          removeFile(sourcePath);
          throw error;
        }
        if (!copying) {
          removeFile(sourcePath);
          throw new Error("Unable to create PDF copying context");
        }
        var copyingEnded = false;
        var sourceParsers = [];
        function cleanupCopying() {
          if (!copying) return;
          sourceParsers.forEach((parser) => parser._end());
          if (!copyingEnded)
            module._muhammara_wasm_copying_context_end(copying);
          module._muhammara_wasm_modifier_destroy_copying_context(copying);
          removeFile(sourcePath);
          copying = 0;
          copyingEnded = true;
          lifecycle.untrack(cleanupCopying);
        }
        lifecycle.track(cleanupCopying);
        function requireCopying() {
          requireOpenWriter();
          if (copyingEnded) throw new Error("PDF copying context has ended");
        }
        return {
          getSourceDocumentParser: function () {
            requireCopying();
            var parser = createReader(
              undefined,
              module._muhammara_wasm_copying_context_get_source_document_parser(
                copying,
              ),
              requireCopying,
              copying,
              false,
            );
            sourceParsers.push(parser);
            return parser;
          },
          getSourceDocumentStream: function () {
            requireCopying();
            var parser = this.getSourceDocumentParser();
            return parser.getSourceDocumentStream();
          },
          copyDirectObjectAsIs: function (object) {
            requireCopying();
            if (!object || object._copyingContext !== copying) {
              throw new TypeError(
                "PDF object must originate from this source document parser",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_copy_direct_object_as_is(
                copying,
                object._handle,
              )
            ) {
              throw new Error("Unable to copy PDF object");
            }
            return this;
          },
          ...copyingObjectOperations(copying, requireCopying),
          appendPDFPageFromPDF: function (index) {
            requireCopying();
            if (!Number.isInteger(index) || index < 0) {
              throw new RangeError("Page index must be a non-negative integer");
            }
            var objectId = module._muhammara_wasm_copying_context_append_page(
              copying,
              index,
            );
            if (!objectId) {
              throw new RangeError(`Unable to append page ${index}`);
            }
            return objectId;
          },
          appendPDFPagesFromPDF: function (start, end) {
            requireCopying();
            if (
              !Number.isInteger(start) ||
              !Number.isInteger(end) ||
              start < 0 ||
              end < start
            ) {
              throw new RangeError("A valid zero-based page range is required");
            }
            for (var index = start; index <= end; ++index)
              this.appendPDFPageFromPDF(index);
            return this;
          },
          mergePDFPageToPage: function (targetPage, index) {
            requireCopying();
            if (
              targetPage !== currentPage ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new Error(
                "The active target page and a non-negative source index are required",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_merge_page(copying, index)
            ) {
              throw new RangeError(`Unable to merge page ${index}`);
            }
            return this;
          },
          createFormXObjectFromPDFPage: function (
            index,
            pageBox = constants.ePDFPageBoxMediaBox,
            transformation,
          ) {
            requireCopying();
            [index, pageBox, transformation] = copiedPageFormArguments(
              index,
              pageBox,
              transformation,
            );
            var objectId = withDoubles(
              Array.isArray(pageBox) ? pageBox : [],
              (cropBox) =>
                withDoubles(transformation || [], (matrix) =>
                  module._muhammara_wasm_copying_context_create_form_from_page(
                    copying,
                    index,
                    Array.isArray(pageBox) ? -1 : pageBox,
                    cropBox || 0,
                    matrix || 0,
                  ),
                ),
            );
            if (!objectId)
              throw new RangeError(`Unable to create form from page ${index}`);
            return objectId;
          },
          mergePDFPageToFormXObject: function (form, index) {
            requireCopying();
            if (
              !(form instanceof FormXObject) ||
              form._owner !== owner ||
              form._ended ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new TypeError(
                "An open form from this writer and a non-negative page index are required",
              );
            }
            if (
              !module._muhammara_wasm_copying_context_merge_page_to_form(
                copying,
                form._handle,
                index,
              )
            ) {
              throw new RangeError(`Unable to merge page ${index} to form`);
            }
            return this;
          },
          end: function () {
            requireCopying();
            var result = module._muhammara_wasm_copying_context_end(copying);
            copyingEnded = true;
            cleanupCopying();
            if (!result) {
              throw new Error("Unable to end PDF copying context");
            }
            return this;
          },
        };
      },
      createPDFCopyingContextAsync: async function (sourceBytes) {
        return this.createPDFCopyingContext(
          await normalizeBytesAsync(sourceBytes, "PDF input"),
        );
      },
      createPage: function (left = 0, bottom = 0, right = 595, top = 842) {
        requireOpenWriter();
        return new PDFPage(left, bottom, right, top);
      },
      startPageContentContext: function (page) {
        if (
          ended ||
          !(page instanceof PDFPage) ||
          (currentPage && page !== currentPage)
        ) {
          throw new Error("A writable PDFPage is required");
        }
        if (currentPage === page) return currentContext;
        if (
          !module._muhammara_wasm_recipe_add_page_with_box(
            recipe,
            ...page.mediaBox,
          )
        ) {
          throw new Error("Unable to start page content context");
        }
        currentPage = page;
        page._setNativeBox = function (name, box) {
          var indexes = { media: 0, crop: 1, bleed: 2, trim: 3, art: 4 };
          if (
            !module._muhammara_wasm_recipe_set_page_box(
              recipe,
              indexes[name],
              ...box,
            )
          ) {
            throw new Error("Unable to set page box");
          }
        };
        page._setNativeRotation = function (rotation) {
          if (
            !module._muhammara_wasm_recipe_set_page_rotation(recipe, rotation)
          ) {
            throw new Error("Unable to set page rotation");
          }
        };
        page._getNativeResources = function () {
          requireOpenWriter();
          if (currentPage !== page) {
            throw new Error("PDFPage resources are not active");
          }
          var handle = module._muhammara_wasm_recipe_get_page_resources(recipe);
          if (!handle) throw new Error("Unable to get page resources");
          return resourcesDictionary(handle, function () {
            requireOpenWriter();
            if (currentPage !== page) {
              throw new Error("PDFPage resources are not active");
            }
          });
        };
        Object.entries(page._boxes).forEach(([name, box]) =>
          page._setNativeBox(name, box),
        );
        if (page.rotate !== undefined) page._setNativeRotation(page.rotate);
        currentContext = contentContext();
        return currentContext;
      },
      pausePageContentContext: function (context) {
        requireActiveContext(context);
        if (!module._muhammara_wasm_recipe_pause_page(recipe)) {
          throw new Error("Unable to pause page content context");
        }
        return this;
      },
      writePage: function (page) {
        writePage(page, function () {
          return module._muhammara_wasm_recipe_end_page(recipe);
        });
        return this;
      },
      writePageAndReturnID: function (page) {
        var objectIdPointer = module._malloc(4);
        try {
          return writePage(page, function () {
            module.HEAPU32[objectIdPointer >>> 2] = 0;
            if (
              !module._muhammara_wasm_recipe_end_page_and_return_id(
                recipe,
                objectIdPointer,
              )
            ) {
              return 0;
            }
            return module.HEAPU32[objectIdPointer >>> 2];
          });
        } finally {
          module._free(objectIdPointer);
        }
      },
      end: function () {
        if (
          ended ||
          currentPage ||
          lifecycle.hasChildren() ||
          (objectsContext && objectsContext._hasActive())
        ) {
          throw new Error("Write the active page before ending the PDF");
        }
        var lengthPointer = module._malloc(4);
        try {
          var pdfPointer = module._muhammara_wasm_recipe_end_pdf(
            recipe,
            lengthPointer,
          );
          var length = module.HEAPU32[lengthPointer >>> 2];
          if (!pdfPointer || !length) {
            throw new Error("Unable to finish PDF");
          }
          ended = true;
          try {
            assertOutputSize(length);
            return module.HEAPU8.slice(pdfPointer, pdfPointer + length);
          } finally {
            module._muhammara_wasm_free(pdfPointer);
          }
        } finally {
          module._free(lengthPointer);
          dispose();
        }
      },
      dispose: function () {
        dispose();
      },
    };

    function writePage(page, endPage) {
      requireOpenWriter();
      if (!(page instanceof PDFPage) || (currentPage && page !== currentPage)) {
        throw new Error("The active PDFPage is required");
      }
      if (!currentPage) {
        writer.startPageContentContext(page);
      }
      var result = endPage();
      if (!result) {
        throw new Error("Unable to write page");
      }
      currentPage = null;
      currentContext = null;
      page._setNativeBox = null;
      page._setNativeRotation = null;
      page._getNativeResources = null;
      return result;
    }

    return writer;
  }

  return createWriter;
}
