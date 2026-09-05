import { createChildLifecycle } from "./lifecycle.js";

/** Creates a factory for writers that modify an existing PDF. */
export function createWriterToModifyFactory({
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
  addTextShowingOperators,
  resourcesDictionary,
  createAnnotation,
  drawImageCall,
  removeAssets,
  removeFile,
  assertOutputSize,
}) {
  function createWriterToModify(bytes, options = {}) {
    bytes = normalizeBytes(bytes, "PDF input");
    if (!options || typeof options !== "object" || Array.isArray(options))
      throw new TypeError("createWriterToModify options must be an object");
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
    )
      throw new RangeError(
        "createWriterToModify version must be a supported PDF version",
      );
    if (typeof compress !== "boolean")
      throw new TypeError("createWriterToModify compress must be a boolean");
    var path = `/pdfs/${state.nextPdf++}.pdf`;
    module.FS.mkdirTree("/pdfs");
    module.FS.writeFile(path, bytes);
    var modifier;
    try {
      modifier = withString(path, (pointer) =>
        module._muhammara_wasm_modifier_create(
          pointer,
          version,
          compress ? 1 : 0,
        ),
      );
    } catch (error) {
      removeFile(path);
      throw error;
    }
    if (!modifier) {
      removeFile(path);
      throw new Error("Unable to modify PDF");
    }
    var ended = false;
    var owner = {};
    var context = null;
    var page = null;
    var objectsContext = null;
    var directImagePaths = [];
    var lifecycle = createChildLifecycle();
    var modifiedReaders = [];

    function dispose() {
      if (ended) return;
      lifecycle.disposeChildren();
      modifiedReaders.forEach((reader) => reader.end());
      modifiedReaders.length = 0;
      if (modifier) module._muhammara_wasm_modifier_destroy(modifier);
      removeAssets(directImagePaths);
      removeFile(path);
      modifier = 0;
      ended = true;
    }

    function optionalObjectId(value) {
      if (value === undefined) return 0;
      if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff)
        throw new RangeError("objectId must be a positive object ID");
      return value;
    }
    function imagePath(name, expectedType) {
      if (typeof name !== "string" || !images.has(name))
        throw new TypeError("A registered image name is required");
      var type = imageTypes.get(name);
      if (expectedType !== undefined && type !== expectedType)
        throw new TypeError(`Registered image is not a ${expectedType}`);
      return images.get(name);
    }
    function withImagePathOrBytes(value, label, expectedType, callback) {
      if (typeof value === "string")
        return callback(imagePath(value, expectedType));
      var imageBytes = normalizeBytes(value, label);
      var path = `/images/${state.nextAsset++}.bin`;
      module.FS.mkdirTree("/images");
      module.FS.writeFile(path, imageBytes);
      directImagePaths.push(path);
      return callback(path);
    }

    function requireOpen() {
      if (ended || !modifier) throw new Error("PDF writer has ended");
    }

    function requireContext(value) {
      requireOpen();
      if (context !== value)
        throw new Error("Page content context is not active");
    }

    function modifierContext() {
      function operator(name, code, args = [], integers = false) {
        requireContext(result);
        if (!args.every(Number.isFinite)) {
          throw new TypeError(`${name} requires finite numeric arguments`);
        }
        if (integers && !args.every(Number.isInteger)) {
          throw new TypeError(`${name} requires integer numeric arguments`);
        }
        if (
          !module._muhammara_wasm_modifier_operator(modifier, code, ...args)
        ) {
          throw new Error(`Unable to apply ${name}`);
        }
        return result;
      }
      var result = {
        getAssociatedPage: function () {
          requireContext(result);
          if (!page) throw new Error("Form XObject has no associated page");
          return page;
        },
        getCurrentPageContentStream: function () {
          requireContext(result);
          if (!page) throw new Error("Form XObject has no page content stream");
          return {
            getWriteStream: function () {
              return {
                write: function (bytes) {
                  requireContext(result);
                  return writeNativeBytes(
                    module,
                    (pointer, length) =>
                      module._muhammara_wasm_modifier_write_current_page_stream(
                        modifier,
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
            result,
            () => requireContext(result),
            (pointer, length) =>
              module._muhammara_wasm_modifier_write_free_code(
                modifier,
                pointer,
                length,
              ),
            freeCode,
          );
        },
        setOpacity: function (opacity) {
          requireContext(result);
          if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
            throw new TypeError(
              "Wrong Argument, please provide 1 opacity value between 0 and 1",
            );
          }
          if (!module._muhammara_wasm_modifier_set_opacity(modifier, opacity)) {
            throw new Error("Unable to set opacity");
          }
          return result;
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
        S: function () {
          return operator("S", 5);
        },
        f: function () {
          return operator("f", 6);
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
        m: function (...args) {
          return operator("m", 10, args);
        },
        l: function (...args) {
          return operator("l", 11, args);
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
        re: function (...args) {
          return operator("re", 16, args);
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
        w: function (value) {
          return operator("w", 20, [value]);
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
        g: function (value) {
          return operator("g", 24, [value]);
        },
        G: function (value) {
          return operator("G", 25, [value]);
        },
        rg: function (...args) {
          return operator("rg", 26, args);
        },
        RG: function (...args) {
          return operator("RG", 27, args);
        },
        k: function (...args) {
          return operator("k", 28, args);
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
        d: function (dash, phase = 0) {
          requireContext(result);
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
              !module._muhammara_wasm_modifier_dash(
                modifier,
                pointer,
                dash.length,
                phase,
              )
            ) {
              throw new Error("Unable to set dash pattern");
            }
            return result;
          } finally {
            if (pointer) module._free(pointer);
          }
        },
        Tf: function (font, size) {
          requireContext(result);
          if (
            !((font && font._owner === owner) || typeof font === "string") ||
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
                !module._muhammara_wasm_modifier_set_font_name(
                  modifier,
                  pointer,
                  size,
                )
              )
                throw new Error("Unable to set font");
              return result;
            });
          if (
            !module._muhammara_wasm_modifier_set_font(
              modifier,
              font._font,
              size,
            )
          )
            throw new Error("Unable to set font");
          return result;
        },
        Tj: function (text) {
          requireContext(result);
          if (typeof text !== "string")
            throw new TypeError("Tj requires a string");
          return withString(text, (pointer) => {
            if (!module._muhammara_wasm_modifier_show_text(modifier, pointer)) {
              throw new Error("Unable to show text");
            }
            return result;
          });
        },
        writeText: function (text, x, y, options = {}) {
          if (
            typeof text !== "string" ||
            ![x, y].every(Number.isFinite) ||
            !options ||
            typeof options !== "object" ||
            !options.font ||
            options.font._owner !== owner
          )
            throw new TypeError(
              "writeText requires text, coordinates, and a writer font",
            );
          var size = options.size ?? 1;
          if (!Number.isFinite(size) || size <= 0)
            throw new RangeError("writeText requires a positive font size");
          result.BT();
          applyHighLevelColor(options, false);
          result.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
          if (options.underline) {
            var dimensions = options.font.calculateTextDimensions(text, size);
            result
              .w(Math.max(size * 0.05, 0.1))
              .m(x, y + dimensions.yMin)
              .l(x + dimensions.width, y + dimensions.yMin)
              .S();
          }
          return result;
        },
        drawImage: function (x, y, image, options) {
          requireContext(result);
          drawImageCall(
            (path, drawOptions, matrixPointer) =>
              module._muhammara_wasm_modifier_draw_image(
                modifier,
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
          return result;
        },
        drawImageAsync: async function (x, y, image, options) {
          return result.drawImage(
            x,
            y,
            await normalizeBytesAsync(image, "Image bytes"),
            options,
          );
        },
        doXObject: function (xobject) {
          requireContext(result);
          if (Number.isInteger(xobject) && xobject > 0) {
            if (
              !module._muhammara_wasm_modifier_do_form_object_id(
                modifier,
                xobject,
              )
            )
              throw new Error("Unable to place XObject");
            return result;
          }
          if (typeof xobject === "string") {
            return withString(xobject, (pointer) => {
              if (
                !module._muhammara_wasm_modifier_do_xobject_name(
                  modifier,
                  pointer,
                )
              )
                throw new Error("Unable to place XObject");
              return result;
            });
          }
          if (
            !xobject ||
            xobject._owner !== owner ||
            !xobject._ended ||
            !xobject.id
          ) {
            throw new TypeError(
              "doXObject requires a completed XObject from this writer",
            );
          }
          if (
            !module._muhammara_wasm_modifier_do_form_object_id(
              modifier,
              xobject.id,
            )
          )
            throw new Error("Unable to place XObject");
          return result;
        },
      };
      result.Td = function (x, y) {
        return operator("Td", 41, [x, y]);
      };
      result.TD = function (x, y) {
        return operator("TD", 42, [x, y]);
      };
      result.TStar = function () {
        return operator("TStar", 43);
      };
      result.Tj = function (text, options) {
        requireContext(result);
        if (typeof text === "string")
          return withString(text, (pointer) => {
            if (
              !module._muhammara_wasm_modifier_show_text_operator(
                modifier,
                0,
                textEncoding(options),
                0,
                0,
                pointer,
              )
            )
              throw new Error("Unable to show text");
            return result;
          });
        if (options !== undefined)
          throw new TypeError("glyph text has no encoding options");
        return withGlyphs(text, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_show_glyphs_operator(
              modifier,
              0,
              0,
              0,
              pointer,
              text.length,
            )
          )
            throw new Error("Unable to show glyph text");
          return result;
        });
      };
      addTextShowingOperators(result, () => requireContext(result), {
        text: (...args) =>
          module._muhammara_wasm_modifier_show_text_operator(modifier, ...args),
        glyphs: (...args) =>
          module._muhammara_wasm_modifier_show_glyphs_operator(
            modifier,
            ...args,
          ),
        tj: (...args) =>
          module._muhammara_wasm_modifier_show_tj(modifier, ...args),
      });
      addStructuredContentOperators(
        result,
        () => requireContext(result),
        (...args) =>
          module._muhammara_wasm_modifier_structured_operator(
            modifier,
            ...args,
          ),
      );
      function applyHighLevelColor(options, stroke) {
        if (!options || options.color === undefined) return;
        var color = colorValue(options.color) >>> 0;
        var colorspace = options.colorspace || "rgb";
        if (colorspace === "rgb") {
          return stroke
            ? result.RG(
                ((color >> 16) & 0xff) / 255,
                ((color >> 8) & 0xff) / 255,
                (color & 0xff) / 255,
              )
            : result.rg(
                ((color >> 16) & 0xff) / 255,
                ((color >> 8) & 0xff) / 255,
                (color & 0xff) / 255,
              );
        }
        if (colorspace === "gray")
          return stroke
            ? result.G((color & 0xff) / 255)
            : result.g((color & 0xff) / 255);
        if (colorspace === "cmyk") {
          var values = [
            ((color >> 24) & 0xff) / 255,
            ((color >> 16) & 0xff) / 255,
            ((color >> 8) & 0xff) / 255,
            (color & 0xff) / 255,
          ];
          return stroke ? result.K(...values) : result.k(...values);
        }
        throw new TypeError("colorspace must be rgb, gray, or cmyk");
      }
      function finishHighLevelPath(options) {
        options = options || {};
        var stroke = options.type !== "fill";
        applyHighLevelColor(options, stroke);
        if (stroke && options.width !== undefined) result.w(options.width);
        return options.type === "fill"
          ? result.f()
          : options.close
            ? result.s()
            : result.S();
      }
      result.drawRectangle = function (x, y, width, height, options) {
        if (![x, y, width, height].every(Number.isFinite))
          throw new TypeError("drawRectangle requires four finite coordinates");
        result.re(x, y, width, height);
        return finishHighLevelPath(
          options && typeof options === "object" ? options : {},
        );
      };
      result.drawSquare = function (x, y, edge, options) {
        if (![x, y, edge].every(Number.isFinite))
          throw new TypeError("drawSquare requires three finite coordinates");
        return result.drawRectangle(x, y, edge, edge, options);
      };
      result.drawCircle = function (x, y, radius, options) {
        if (![x, y, radius].every(Number.isFinite))
          throw new TypeError("drawCircle requires three finite coordinates");
        var control = radius * 0.5522847498307936;
        result
          .m(x + radius, y)
          .c(x + radius, y + control, x + control, y + radius, x, y + radius)
          .c(x - control, y + radius, x - radius, y + control, x - radius, y)
          .c(x - radius, y - control, x - control, y - radius, x, y - radius)
          .c(x + control, y - radius, x + radius, y - control, x + radius, y);
        return finishHighLevelPath(
          options && typeof options === "object" ? options : {},
        );
      };
      result.drawPath = function (...args) {
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
        result.m(...points[0]);
        for (var index = 1; index < points.length; index += 1)
          result.l(...points[index]);
        return finishHighLevelPath(options);
      };
      return result;
    }

    function startContext() {
      if (!module._muhammara_wasm_modifier_start_page_context(modifier)) {
        throw new Error("Unable to start page content context");
      }
      context = modifierContext();
      return context;
    }

    var additionalInfo = new Map();
    function setInfo(key, value) {
      requireOpen();
      if (typeof key !== "string" || typeof value !== "string")
        throw new TypeError("addAdditionalInfoEntry requires two strings");
      withString(key, (keyPointer) =>
        withString(value, (valuePointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info(
              modifier,
              keyPointer,
              valuePointer,
            )
          )
            throw new Error("Unable to set additional info entry");
        }),
      );
    }
    var infoDictionary = {
      addAdditionalInfoEntry: function (key, value) {
        setInfo(key, value);
        additionalInfo.set(key, value);
      },
      removeAdditionalInfoEntry: function (key) {
        requireOpen();
        if (typeof key !== "string")
          throw new TypeError("removeAdditionalInfoEntry requires a string");
        withString(key, (pointer) => {
          if (!module._muhammara_wasm_modifier_remove_info(modifier, pointer))
            throw new Error("Unable to remove additional info entry");
        });
        additionalInfo.delete(key);
      },
      clearAdditionalInfoEntries: function () {
        requireOpen();
        if (!module._muhammara_wasm_modifier_clear_info(modifier))
          throw new Error("Unable to clear additional info entries");
        additionalInfo.clear();
      },
      getAdditionalInfoEntry: function (key) {
        requireOpen();
        if (typeof key !== "string")
          throw new TypeError("getAdditionalInfoEntry requires a string");
        return additionalInfo.get(key) || "";
      },
      getAdditionalInfoEntries: function () {
        requireOpen();
        return Object.fromEntries(additionalInfo);
      },
      setCreationDate: function (value) {
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info_date(modifier, 0, pointer)
          )
            throw new Error("Unable to set creation date");
        });
      },
      setModDate: function (value) {
        var date = normalizePDFDate(value);
        withString(date, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_set_info_date(modifier, 1, pointer)
          )
            throw new Error("Unable to set modification date");
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
            value = String(nextValue);
            setInfo(key, value);
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
        requireOpen();
        if (!Number.isInteger(value) || value < 0 || value > 2)
          throw new RangeError("trapped must be an EInfoTrapped value");
        if (!module._muhammara_wasm_modifier_set_info_trapped(modifier, value))
          throw new Error("Unable to set trapped");
        trapped = value;
      },
    });

    return {
      appendPDFPagesFromPDF: function (source, options = {}) {
        requireOpen();
        if (page || context)
          throw new Error("Finish the active page before appending PDF pages");
        if (
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError("Append options must be a browser-safe object");
        var ranges =
          options.type === constants.eRangeTypeSpecific
            ? options.specificRanges
            : [];
        if (
          !Array.isArray(ranges) ||
          !ranges.every(
            (range) =>
              Array.isArray(range) &&
              range.length === 2 &&
              range.every(
                (value) =>
                  Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
              ) &&
              range[1] >= range[0],
          )
        )
          throw new RangeError(
            "specificRanges must contain non-negative inclusive page ranges",
          );
        if (options.type === constants.eRangeTypeSpecific && !ranges.length)
          throw new RangeError("A specific page range is required");
        var sourceBytes = normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) => {
          var errorPointer = module._malloc(4);
          var countPointer = module._malloc(4);
          var rangesPointer = ranges.length
            ? module._malloc(ranges.length * 8)
            : 0;
          try {
            if (rangesPointer)
              module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
            var ids = module._muhammara_wasm_modifier_append_pages_from_pdf(
              modifier,
              bytesPointer,
              sourceBytes.length,
              rangesPointer,
              ranges.length,
              errorPointer,
              countPointer,
            );
            if (module.HEAP32[errorPointer >>> 2] === 2)
              throw new Error("Encrypted PDF input is not supported in Wasm");
            if (module.HEAP32[errorPointer >>> 2] !== 0)
              throw new Error("Unable to append PDF pages from input bytes");
            try {
              return ids
                ? Array.from(
                    module.HEAPU32.subarray(
                      ids >>> 2,
                      (ids >>> 2) + module.HEAPU32[countPointer >>> 2],
                    ),
                  )
                : [];
            } finally {
              if (ids) module._muhammara_wasm_free(ids);
            }
          } finally {
            module._free(errorPointer);
            module._free(countPointer);
            if (rangesPointer) module._free(rangesPointer);
          }
        });
      },
      appendPDFPagesFromPDFAsync: async function (source, options) {
        return this.appendPDFPagesFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          options,
        );
      },
      mergePDFPagesToPage: function (target, source, options = {}, callback) {
        requireOpen();
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        if (
          target !== page ||
          !page ||
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError(
            "An active target PDFPage and browser-safe merge options are required",
          );
        if (callback !== undefined && typeof callback !== "function")
          throw new TypeError("Merge callback must be a function");
        var ranges =
          options.type === constants.eRangeTypeSpecific
            ? options.specificRanges
            : [];
        if (
          !Array.isArray(ranges) ||
          !ranges.every(
            (range) =>
              Array.isArray(range) &&
              range.length === 2 &&
              range.every(
                (value) =>
                  Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
              ) &&
              range[1] >= range[0],
          )
        )
          throw new RangeError(
            "specificRanges must contain non-negative inclusive page ranges",
          );
        var sourceBytes = normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) => {
          var errorPointer = module._malloc(4);
          var rangesPointer = ranges.length
            ? module._malloc(ranges.length * 8)
            : 0;
          try {
            if (rangesPointer)
              module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
            if (
              !module._muhammara_wasm_modifier_merge_pages_to_page_from_pdf(
                modifier,
                bytesPointer,
                sourceBytes.length,
                rangesPointer,
                ranges.length,
                errorPointer,
              )
            ) {
              if (module.HEAP32[errorPointer >>> 2] === 2)
                throw new Error("Encrypted PDF input is not supported in Wasm");
              throw new Error("Unable to merge PDF pages from input bytes");
            }
            if (callback) callback();
            return this;
          } finally {
            module._free(errorPointer);
            if (rangesPointer) module._free(rangesPointer);
          }
        });
      },
      mergePDFPagesToPageAsync: async function (
        target,
        source,
        options,
        callback,
      ) {
        return this.mergePDFPagesToPage(
          target,
          await normalizeBytesAsync(source, "PDF input"),
          options,
          callback,
        );
      },
      getImageDimensions: function (image, imageIndex = 0) {
        requireOpen();
        if (
          !Number.isSafeInteger(imageIndex) ||
          imageIndex < 0 ||
          imageIndex > 0xffffffff
        )
          throw new RangeError(
            "imageIndex must be a non-negative 32-bit integer",
          );
        var imageBytes =
          typeof image === "string"
            ? module.FS.readFile(imagePath(image))
            : normalizeBytes(image, "Image bytes");
        var valuesPointer = module._malloc(16);
        try {
          return withBytes(imageBytes, (pointer) => {
            if (
              !module._muhammara_wasm_modifier_image_dimensions(
                modifier,
                pointer,
                imageBytes.length,
                imageIndex,
                valuesPointer,
              )
            )
              throw new Error("Unable to read image dimensions");
            return {
              width: module.HEAPF64[valuesPointer >>> 3],
              height: module.HEAPF64[(valuesPointer >>> 3) + 1],
            };
          });
        } finally {
          module._free(valuesPointer);
        }
      },
      getImageDimensionsAsync: async function (image, imageIndex) {
        return this.getImageDimensions(
          await normalizeBytesAsync(image, "Image bytes"),
          imageIndex,
        );
      },
      getImageType: function (image) {
        requireOpen();
        return withImagePathOrBytes(image, "Image bytes", undefined, (path) =>
          withString(path, (pointer) => {
            var type = module._muhammara_wasm_modifier_get_image_type(
              modifier,
              pointer,
            );
            return [undefined, "PDF", "JPG", "TIFF", "PNG"][type];
          }),
        );
      },
      getImageTypeAsync: async function (image) {
        return this.getImageType(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      getImagePagesCount: function (image) {
        requireOpen();
        return withImagePathOrBytes(image, "Image bytes", undefined, (path) =>
          withString(path, (pointer) =>
            module._muhammara_wasm_modifier_get_image_pages_count(
              modifier,
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
        requireOpen();
        var imageBytes =
          typeof image === "string"
            ? module.FS.readFile(imagePath(image, "jpeg"))
            : normalizeBytes(image, "JPEG bytes");
        var valuesPointer = module._malloc(14 * 8);
        try {
          return withBytes(imageBytes, (pointer) => {
            if (
              !module._muhammara_wasm_modifier_retrieve_jpg_image_information(
                modifier,
                pointer,
                imageBytes.length,
                valuesPointer,
              )
            )
              throw new Error("Unable to retrieve JPEG image information");
            var values = module.HEAPF64.subarray(
              valuesPointer >>> 3,
              (valuesPointer >>> 3) + 14,
            );
            var result = {
              samplesWidth: values[0],
              samplesHeight: values[1],
              colorComponentsCount: values[2],
              JFIFInformationExists: Boolean(values[3]),
              ExifInformationExists: Boolean(values[7]),
              PhotoshopInformationExists: Boolean(values[11]),
            };
            if (result.JFIFInformationExists)
              Object.assign(result, {
                JFIFUnit: values[4],
                JFIFXDensity: values[5],
                JFIFYDensity: values[6],
              });
            if (result.ExifInformationExists)
              Object.assign(result, {
                ExifUnit: values[8],
                ExifXDensity: values[9],
                ExifYDensity: values[10],
              });
            if (result.PhotoshopInformationExists)
              Object.assign(result, {
                PhotoshopXDensity: values[12],
                PhotoshopYDensity: values[13],
              });
            return result;
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
        requireOpen();
        var handle = withString(imagePath(name, "jpeg"), (pointer) =>
          module._muhammara_wasm_modifier_create_jpg_image(
            modifier,
            pointer,
            optionalObjectId(objectId),
          ),
        );
        if (!handle) throw new Error("Unable to create JPEG image XObject");
        return { id: module._muhammara_wasm_image_get_object_id(handle) };
      },
      createFormXObjectFromJPGBytes: function (name, objectId) {
        requireOpen();
        var handle = withString(imagePath(name, "jpeg"), (pointer) =>
          module._muhammara_wasm_modifier_create_image_form(
            modifier,
            pointer,
            0,
            optionalObjectId(objectId),
          ),
        );
        if (!handle) throw new Error("Unable to create image form XObject");
        return {
          id: module._muhammara_wasm_modifier_form_get_object_id(handle),
        };
      },
      createFormXObjectFromPNGBytes: function (name, objectId) {
        requireOpen();
        var handle = withString(imagePath(name, "png"), (pointer) =>
          module._muhammara_wasm_modifier_create_image_form(
            modifier,
            pointer,
            1,
            optionalObjectId(objectId),
          ),
        );
        if (!handle) throw new Error("Unable to create image form XObject");
        return {
          id: module._muhammara_wasm_modifier_form_get_object_id(handle),
        };
      },
      createFormXObjectsFromPDF: function (
        source,
        pageBox = constants.ePDFPageBoxMediaBox,
        options = {},
      ) {
        requireOpen();
        var cropBox = Array.isArray(pageBox) ? pageBox : undefined;
        if (cropBox) pageBox = constants.ePDFPageBoxMediaBox;
        if (!Number.isInteger(pageBox) || pageBox < 0 || pageBox > 4)
          throw new RangeError("A valid page box is required");
        if (
          !options ||
          typeof options !== "object" ||
          Array.isArray(options) ||
          "password" in options
        )
          throw new TypeError("PDF form options must be a browser-safe object");
        var ranges =
          options.type === constants.eRangeTypeSpecific
            ? options.specificRanges
            : [];
        var matrix = options.transformation;
        var additionalIds = options.additionalObjectIds ?? [];
        if (
          (cropBox &&
            (!Array.isArray(cropBox) ||
              cropBox.length !== 4 ||
              !cropBox.every(Number.isFinite))) ||
          !Array.isArray(ranges) ||
          !ranges.every(
            (range) =>
              Array.isArray(range) &&
              range.length === 2 &&
              range.every(
                (value) =>
                  Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
              ) &&
              range[1] >= range[0],
          ) ||
          (matrix !== undefined &&
            (!Array.isArray(matrix) ||
              matrix.length !== 6 ||
              !matrix.every(Number.isFinite))) ||
          !Array.isArray(additionalIds) ||
          !additionalIds.every(
            (id) => Number.isInteger(id) && id >= 0 && id <= 0xffffffff,
          )
        )
          throw new TypeError("Invalid byte PDF form options");
        var sourceBytes =
          typeof source === "string"
            ? (() => {
                var path = pdfs.get(source);
                if (!path) throw new Error(`Unknown PDF: ${source}`);
                return module.FS.readFile(path);
              })()
            : normalizeBytes(source, "PDF input");
        return withBytes(sourceBytes, (bytesPointer) =>
          withDoubles(cropBox || [], (cropPointer) =>
            withDoubles(matrix || [], (matrixPointer) => {
              var countPointer = module._malloc(4);
              var rangesPointer = ranges.length
                ? module._malloc(ranges.length * 8)
                : 0;
              var idsPointer = additionalIds.length
                ? module._malloc(additionalIds.length * 4)
                : 0;
              try {
                if (rangesPointer)
                  module.HEAPU32.set(ranges.flat(), rangesPointer >>> 2);
                if (idsPointer)
                  module.HEAPU32.set(additionalIds, idsPointer >>> 2);
                var result =
                  module._muhammara_wasm_modifier_create_forms_from_pdf(
                    modifier,
                    bytesPointer,
                    sourceBytes.length,
                    pageBox,
                    rangesPointer,
                    ranges.length,
                    cropPointer || 0,
                    matrixPointer || 0,
                    idsPointer,
                    additionalIds.length,
                    countPointer,
                  );
                if (!result) throw new Error("Unable to create forms from PDF");
                try {
                  return Array.from(
                    module.HEAPU32.subarray(
                      result >>> 2,
                      (result >>> 2) + module.HEAPU32[countPointer >>> 2],
                    ),
                  );
                } finally {
                  module._muhammara_wasm_free(result);
                }
              } finally {
                module._free(countPointer);
                if (rangesPointer) module._free(rangesPointer);
                if (idsPointer) module._free(idsPointer);
              }
            }),
          ),
        );
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
      createFormXObjectFromTIFF: function (image, options = {}) {
        requireOpen();
        if (!options || typeof options !== "object" || Array.isArray(options))
          throw new TypeError("TIFF options must be an object");
        function treatment(name) {
          var value = options[name];
          if (value === undefined) return undefined;
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new TypeError(`TIFF ${name} must be an object`);
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
          )
            throw new TypeError(
              `TIFF ${name} must be an RGB (3) or CMYK (4) array of integers from 0 to 255`,
            );
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
        if (!Number.isInteger(pageIndex) || pageIndex < 0)
          throw new RangeError("TIFF pageIndex must be a non-negative integer");
        var objectId = optionalObjectId(options.objectId);
        var handle = withImagePathOrBytes(image, "TIFF bytes", "tiff", (path) =>
          withString(path, (pointer) =>
            module._muhammara_wasm_modifier_create_tiff_form(
              modifier,
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
        return {
          id:
            objectId ||
            module._muhammara_wasm_modifier_form_get_object_id(handle),
        };
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
        requireOpen();
        if (
          ![left, bottom, right, top].every(Number.isFinite) ||
          right <= left ||
          top <= bottom
        ) {
          throw new RangeError("A valid form rectangle is required");
        }
        objectId = optionalObjectId(objectId);
        var handle = module._muhammara_wasm_modifier_create_form(
          modifier,
          left,
          bottom,
          right,
          top,
          objectId,
        );
        if (!handle) throw new Error("Unable to create form XObject");
        var form = {
          _handle: handle,
          _modifier: modifier,
          _owner: owner,
          _ended: false,
          id:
            objectId ||
            module._muhammara_wasm_modifier_form_get_object_id(handle),
          getResourcesDictionary: function () {
            requireOpen();
            if (form._ended)
              throw new Error("Form XObject resources are no longer active");
            var resources = module._muhammara_wasm_modifier_get_form_resources(
              modifier,
              handle,
            );
            if (!resources)
              throw new Error("Form XObject resources are no longer active");
            return resourcesDictionary(resources, () => {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject resources are no longer active");
            });
          },
          getResourcesDictinary: function () {
            return form.getResourcesDictionary();
          },
          getContentStream: function () {
            requireOpen();
            if (form._ended)
              throw new Error(
                "Form XObject content stream is no longer active",
              );
            return {
              getWriteStream: function () {
                return {
                  write: function (bytes) {
                    requireOpen();
                    if (form._ended)
                      throw new Error(
                        "Form XObject content stream is no longer active",
                      );
                    return writeNativeBytes(
                      module,
                      (pointer, length) =>
                        module._muhammara_wasm_modifier_form_write_stream(
                          modifier,
                          handle,
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
          getContentContext: function () {
            requireOpen();
            if (form._ended)
              throw new Error("Form XObject content is not writable");
            function operator(code, ...args) {
              if (!args.every(Number.isFinite))
                throw new TypeError("Form operator requires finite arguments");
              if (
                !module._muhammara_wasm_modifier_form_operator(
                  modifier,
                  handle,
                  code,
                  ...args,
                )
              )
                throw new Error("Unable to apply form operator");
              return context;
            }
            var context = {
              writeFreeCode: function (code) {
                if (typeof code !== "string")
                  throw new TypeError("writeFreeCode requires a string");
                return withString(code, (pointer) => {
                  if (
                    !module._muhammara_wasm_modifier_form_write_free_code(
                      modifier,
                      handle,
                      pointer,
                      new TextEncoder().encode(code).length,
                    )
                  )
                    throw new Error("Unable to write free code");
                  return context;
                });
              },
              Tf: function (font, size) {
                if (!Number.isFinite(size) || size <= 0)
                  throw new TypeError("Tf requires a positive size");
                var applied =
                  typeof font === "string"
                    ? withString(font, (pointer) =>
                        module._muhammara_wasm_modifier_form_set_font_name(
                          modifier,
                          handle,
                          pointer,
                          size,
                        ),
                      )
                    : font && font._owner === owner
                      ? module._muhammara_wasm_modifier_form_set_font(
                          modifier,
                          handle,
                          font._font,
                          size,
                        )
                      : false;
                if (!applied) throw new Error("Unable to set form font");
                return context;
              },
              Tj: function (text) {
                if (typeof text !== "string")
                  throw new TypeError("Tj requires a string");
                return withString(text, (pointer) => {
                  if (
                    !module._muhammara_wasm_modifier_form_show_text(
                      modifier,
                      handle,
                      pointer,
                    )
                  )
                    throw new Error("Unable to show form text");
                  return context;
                });
              },
              writeText: function (text, x, y, options = {}) {
                if (
                  typeof text !== "string" ||
                  ![x, y].every(Number.isFinite) ||
                  !options.font ||
                  options.font._owner !== owner
                )
                  throw new TypeError(
                    "writeText requires text, coordinates, and a writer font",
                  );
                var size = options.size ?? 1;
                if (!Number.isFinite(size) || size <= 0)
                  throw new RangeError(
                    "writeText requires a positive font size",
                  );
                var color = colorValue(options.color ?? 0) >>> 0;
                context.BT();
                if (options.color !== undefined) {
                  if ((options.colorspace || "rgb") === "cmyk")
                    context.k(
                      ((color >> 24) & 0xff) / 255,
                      ((color >> 16) & 0xff) / 255,
                      ((color >> 8) & 0xff) / 255,
                      (color & 0xff) / 255,
                    );
                  else
                    context.rg(
                      ((color >> 16) & 0xff) / 255,
                      ((color >> 8) & 0xff) / 255,
                      (color & 0xff) / 255,
                    );
                }
                context
                  .Tf(options.font, size)
                  .Tm(1, 0, 0, 1, x, y)
                  .Tj(text)
                  .ET();
                if (options.underline) {
                  var dimensions = options.font.calculateTextDimensions(
                    text,
                    size,
                  );
                  context
                    .w(Math.max(size * 0.05, 0.1))
                    .m(x, y + dimensions.yMin)
                    .l(x + dimensions.width, y + dimensions.yMin)
                    .S();
                }
                return context;
              },
            };
            [
              ["q", 17],
              ["Q", 18],
              ["b", 0],
              ["B", 1],
              ["bStar", 2],
              ["BStar", 3],
              ["s", 4],
              ["F", 7],
              ["fStar", 8],
              ["n", 9],
              ["c", 12],
              ["v", 13],
              ["y", 14],
              ["h", 15],
              ["BT", 32],
              ["ET", 33],
              ["Td", 41],
              ["TD", 42],
              ["TStar", 43],
              ["S", 5],
              ["f", 6],
              ["m", 10],
              ["l", 11],
              ["re", 16],
              ["rg", 26],
              ["RG", 27],
              ["g", 24],
              ["G", 25],
              ["k", 28],
              ["K", 29],
              ["w", 20],
              ["J", 21],
              ["j", 22],
              ["M", 23],
              ["W", 30],
              ["WStar", 31],
              ["cm", 19],
              ["Tm", 34],
              ["Tc", 35],
              ["Tw", 36],
              ["TL", 38],
              ["Ts", 40],
            ].forEach(([name, code]) => {
              context[name] = function (...args) {
                return operator(code, ...args);
              };
            });
            context.Tz = function (value) {
              if (!Number.isInteger(value))
                throw new TypeError("Tz requires integer numeric arguments");
              return operator(37, value);
            };
            context.Tr = function (value) {
              if (!Number.isInteger(value))
                throw new TypeError("Tr requires integer numeric arguments");
              return operator(39, value);
            };
            context.d = function (dash, phase = 0) {
              requireOpen();
              if (
                form._ended ||
                !Array.isArray(dash) ||
                !dash.every(Number.isFinite) ||
                !Number.isFinite(phase)
              )
                throw new TypeError("d requires a finite dash array and phase");
              return withDoubles(dash, (pointer) => {
                if (
                  !module._muhammara_wasm_modifier_form_dash(
                    modifier,
                    handle,
                    pointer,
                    dash.length,
                    phase,
                  )
                )
                  throw new Error("Unable to set dash pattern");
                return context;
              });
            };
            context.setOpacity = function (opacity) {
              requireOpen();
              if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
                throw new TypeError(
                  "Wrong Argument, please provide 1 opacity value between 0 and 1",
                );
              if (
                !module._muhammara_wasm_modifier_form_set_opacity(
                  modifier,
                  handle,
                  opacity,
                )
              )
                throw new Error("Unable to set opacity");
              return context;
            };
            context.Tj = function (text, options) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              if (typeof text === "string")
                return withString(text, (pointer) => {
                  if (
                    !module._muhammara_wasm_modifier_form_show_text_operator(
                      modifier,
                      handle,
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
                  !module._muhammara_wasm_modifier_form_show_glyphs_operator(
                    modifier,
                    handle,
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
                requireOpen();
                if (form._ended)
                  throw new Error("Form XObject content has ended");
              },
              {
                text: (...args) =>
                  module._muhammara_wasm_modifier_form_show_text_operator(
                    modifier,
                    handle,
                    ...args,
                  ),
                glyphs: (...args) =>
                  module._muhammara_wasm_modifier_form_show_glyphs_operator(
                    modifier,
                    handle,
                    ...args,
                  ),
                tj: (...args) =>
                  module._muhammara_wasm_modifier_form_show_tj(
                    modifier,
                    handle,
                    ...args,
                  ),
              },
            );
            addStructuredContentOperators(
              context,
              () => {
                requireOpen();
                if (form._ended)
                  throw new Error("Form XObject content has ended");
              },
              (...args) =>
                module._muhammara_wasm_modifier_form_structured_operator(
                  modifier,
                  handle,
                  ...args,
                ),
            );
            context.doXObject = function (xobject) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              if (Number.isInteger(xobject) && xobject > 0) {
                if (
                  !module._muhammara_wasm_modifier_form_do_form_object_id(
                    modifier,
                    handle,
                    xobject,
                  )
                )
                  throw new Error("Unable to place XObject");
                return context;
              }
              if (typeof xobject === "string")
                return withString(xobject, (pointer) => {
                  if (
                    !module._muhammara_wasm_modifier_form_do_xobject_name(
                      modifier,
                      handle,
                      pointer,
                    )
                  )
                    throw new Error("Unable to place XObject");
                  return context;
                });
              if (
                !xobject ||
                xobject._owner !== owner ||
                !xobject._ended ||
                !xobject.id
              )
                throw new TypeError(
                  "doXObject requires a completed XObject from this writer",
                );
              if (
                !module._muhammara_wasm_modifier_form_do_form_object_id(
                  modifier,
                  handle,
                  xobject.id,
                )
              )
                throw new Error("Unable to place XObject");
              return context;
            };
            context.drawImage = function (x, y, image, options) {
              requireOpen();
              if (form._ended)
                throw new Error("Form XObject content has ended");
              drawImageCall(
                (path, drawOptions, matrixPointer) =>
                  module._muhammara_wasm_modifier_form_draw_image(
                    modifier,
                    handle,
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
            function finishPath(options) {
              options = options || {};
              var stroke = options.type !== "fill";
              if (options.color !== undefined) {
                var color = colorValue(options.color) >>> 0;
                var colorspace = options.colorspace || "rgb";
                if (colorspace === "rgb")
                  stroke
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
                else if (colorspace === "gray")
                  stroke
                    ? context.G((color & 0xff) / 255)
                    : context.g((color & 0xff) / 255);
                else if (colorspace === "cmyk") {
                  var components = [
                    ((color >> 24) & 0xff) / 255,
                    ((color >> 16) & 0xff) / 255,
                    ((color >> 8) & 0xff) / 255,
                    (color & 0xff) / 255,
                  ];
                  stroke ? context.K(...components) : context.k(...components);
                } else
                  throw new TypeError("colorspace must be rgb, gray, or cmyk");
              }
              if (stroke && options.width !== undefined)
                context.w(options.width);
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
              return finishPath(options);
            };
            context.drawSquare = function (x, y, edge, options) {
              if (![x, y, edge].every(Number.isFinite))
                throw new TypeError(
                  "drawSquare requires three finite coordinates",
                );
              return context.drawRectangle(x, y, edge, edge, options);
            };
            context.drawCircle = function (x, y, radius, options) {
              if (![x, y, radius].every(Number.isFinite))
                throw new TypeError(
                  "drawCircle requires three finite coordinates",
                );
              var control = radius * 0.5522847498307936;
              context
                .m(x + radius, y)
                .c(
                  x + radius,
                  y + control,
                  x + control,
                  y + radius,
                  x,
                  y + radius,
                )
                .c(
                  x - control,
                  y + radius,
                  x - radius,
                  y + control,
                  x - radius,
                  y,
                )
                .c(
                  x - radius,
                  y - control,
                  x - control,
                  y - radius,
                  x,
                  y - radius,
                )
                .c(
                  x + control,
                  y - radius,
                  x + radius,
                  y - control,
                  x + radius,
                  y,
                );
              return finishPath(options);
            };
            context.drawPath = function (...args) {
              var points = Array.isArray(args[0])
                ? args[0]
                : Array.from({ length: (args.length - 1) / 2 }, (_, index) => [
                    args[index * 2],
                    args[index * 2 + 1],
                  ]);
              var options = Array.isArray(args[0])
                ? (args[1] ?? {})
                : args.at(-1);
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
              points.slice(1).forEach((point) => context.l(...point));
              return finishPath(options);
            };
            return context;
          },
          end: function () {
            requireOpen();
            if (
              form._ended ||
              !module._muhammara_wasm_modifier_end_form(modifier, handle)
            ) {
              throw new Error("Unable to end form XObject");
            }
            form._ended = true;
            return form;
          },
        };
        return form;
      },
      endFormXObject: function (form) {
        requireOpen();
        if (
          !form ||
          form._owner !== owner ||
          form._ended ||
          typeof form.end !== "function"
        )
          throw new TypeError(
            "endFormXObject requires an open form from this writer",
          );
        form.end();
        return this;
      },
      createPage: function (left, bottom, right, top) {
        requireOpen();
        if (page || context) throw new Error("Finish the active page first");
        var nextPage = new PDFPage(left, bottom, right, top);
        if (
          !module._muhammara_wasm_modifier_create_page(
            modifier,
            ...nextPage.mediaBox,
          )
        ) {
          throw new Error("Unable to create page");
        }
        page = nextPage;
        page._getNativeResources = function () {
          requireOpen();
          if (page !== nextPage) {
            throw new Error("PDFPage resources are not active");
          }
          var handle =
            module._muhammara_wasm_modifier_get_page_resources(modifier);
          if (!handle) throw new Error("Unable to get page resources");
          return resourcesDictionary(handle, function () {
            requireOpen();
            if (page !== nextPage) {
              throw new Error("PDFPage resources are not active");
            }
          });
        };
        return page;
      },
      getFontForBytes: function (name, metricsNameOrIndex, fontIndex) {
        requireOpen();
        if (typeof name !== "string") {
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
            ? module._muhammara_wasm_modifier_get_font_for_bytes(
                modifier,
                fontPointer,
                0,
                fontIndex,
              )
            : withString(metricsPath, (metricsPointer) =>
                module._muhammara_wasm_modifier_get_font_for_bytes(
                  modifier,
                  fontPointer,
                  metricsPointer,
                  fontIndex,
                ),
              ),
        );
        if (!font) throw new Error("Unable to load registered font bytes");
        return {
          _modifier: modifier,
          _owner: owner,
          _font: font,
          calculateTextDimensions: function (text, size = 1) {
            if (typeof text !== "string" || !Number.isFinite(size) || size <= 0)
              throw new TypeError("Text and a positive font size are required");
            var values = module._malloc(48);
            try {
              return withString(text, (pointer) => {
                if (
                  !module._muhammara_wasm_modifier_font_text_dimensions(
                    modifier,
                    font,
                    pointer,
                    size,
                    values,
                  )
                )
                  throw new Error("Unable to measure text");
                var offset = values >>> 3;
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
              module._free(values);
            }
          },
          getFontMetrics: function (size = 1) {
            if (!Number.isFinite(size) || size <= 0)
              throw new TypeError("A positive font size is required");
            var values = module._malloc(64);
            try {
              if (
                !module._muhammara_wasm_modifier_font_metrics(
                  modifier,
                  font,
                  size,
                  values,
                )
              )
                throw new Error("Unable to read font metrics");
              var offset = values >>> 3;
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
              module._free(values);
            }
          },
        };
      },
      requireCatalogUpdate: function () {
        requireOpen();
        if (!module._muhammara_wasm_modifier_require_catalog_update(modifier)) {
          throw new Error("Unable to require catalog update");
        }
      },
      replaceObject: function (
        pageIndex,
        sourceObjectId,
        replacementObjectId,
        options,
      ) {
        requireOpen();
        if (
          ![pageIndex, sourceObjectId, replacementObjectId].every(
            (value) =>
              Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff,
          ) ||
          sourceObjectId === 0 ||
          replacementObjectId === 0
        ) {
          throw new RangeError(
            "Page index and object IDs must be unsigned 32-bit integers; object IDs must be positive",
          );
        }
        if (options && options.scope === "global") {
          var parser = this.getModifiedFileParser();
          var pageCount = parser.getPagesCount();

          parser.end();
          for (var index = 0; index < pageCount; ++index) {
            this.replaceObject(index, sourceObjectId, replacementObjectId);
          }
          return this;
        }
        if (
          !module._muhammara_wasm_modifier_replace_object(
            modifier,
            pageIndex,
            sourceObjectId,
            replacementObjectId,
          )
        ) {
          throw new RangeError(
            "Page and object IDs must belong to the modified PDF",
          );
        }
        return this;
      },
      getObjectsContext: function () {
        requireOpen();
        if (!objectsContext) {
          var handle =
            module._muhammara_wasm_modifier_get_objects_context(modifier);
          if (!handle) throw new Error("Unable to get objects context");
          objectsContext = rawObjectsContext(handle, requireOpen);
        }
        return objectsContext;
      },
      getModifiedFileParser: function () {
        requireOpen();
        var parser =
          module._muhammara_wasm_modifier_get_modified_file_parser(modifier);
        if (!parser) throw new Error("Unable to get modified file parser");
        var reader = createReader(null, parser, requireOpen);
        modifiedReaders.push(reader);
        return reader;
      },
      getDocumentContext: function () {
        requireOpen();
        return {
          getInfoDictionary: function () {
            requireOpen();
            return infoDictionary;
          },
        };
      },
      createPDFTextString: function (value) {
        requireOpen();
        return new PDFTextString(value);
      },
      createPDFDate: function (value) {
        requireOpen();
        return new PDFDate(value);
      },
      attachURLLinktoCurrentPage: function (url, left, bottom, right, top) {
        requireOpen();
        if (
          typeof url !== "string" ||
          ![left, bottom, right, top].every(Number.isFinite) ||
          right < left ||
          top < bottom
        )
          throw new TypeError(
            "URL link requires a URL and valid PDF rectangle",
          );
        withString(url, (pointer) => {
          if (
            !module._muhammara_wasm_modifier_attach_url_link_to_current_page(
              modifier,
              pointer,
              left,
              bottom,
              right,
              top,
            )
          )
            throw new Error("Unable to attach URL link to current page");
        });
        return this;
      },
      createAnnotation: function (subtype, left, bottom, right, top, options) {
        requireOpen();
        return createAnnotation(
          (...args) =>
            module._muhammara_wasm_modifier_create_annotation_for_current_page(
              modifier,
              ...args,
            ),
          subtype,
          left,
          bottom,
          right,
          top,
          options,
        );
      },
      registerAnnotationReferenceForNextPageWrite: function (objectId) {
        requireOpen();
        if (!Number.isInteger(objectId) || objectId <= 0)
          throw new RangeError("Annotation object ID must be positive");
        if (
          !module._muhammara_wasm_modifier_register_annotation(
            modifier,
            objectId,
          )
        )
          throw new Error("Unable to register annotation for the current page");
        return this;
      },
      startPageContentContext: function (nextPage) {
        requireOpen();
        if (nextPage !== page || context) {
          throw new Error("A writable PDFPage is required");
        }
        return startContext();
      },
      pausePageContentContext: function (value) {
        requireContext(value);
        if (!page || !module._muhammara_wasm_modifier_pause_page(modifier))
          throw new Error("Unable to pause page content context");
        return this;
      },
      createPageModifier: function (
        index = 0,
        ensureContentEncapsulation = false,
      ) {
        requireOpen();
        if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
          throw new RangeError(
            "Page index must be a non-negative 32-bit integer",
          );
        }
        if (typeof ensureContentEncapsulation !== "boolean") {
          throw new TypeError("ensureContentEncapsulation must be a boolean");
        }
        var modifierPage = null;
        return {
          startContext: function () {
            requireOpen();
            if (
              page ||
              context ||
              !module._muhammara_wasm_modifier_start_page(
                modifier,
                index,
                ensureContentEncapsulation ? 1 : 0,
              )
            ) {
              throw new RangeError(`Unable to modify page ${index}`);
            }
            modifierPage = true;
            context = modifierContext();
            return this;
          },
          getContext: function () {
            requireOpen();
            if (!modifierPage || !context)
              throw new Error("No context created");
            return context;
          },
          getResourcesDictionary: function () {
            requireOpen();
            if (!modifierPage || !context) {
              throw new Error("No context created");
            }
            var handle =
              module._muhammara_wasm_modifier_get_page_resources(modifier);
            if (!handle) throw new Error("Unable to get page resources");
            var resourceContext = context;
            return resourcesDictionary(handle, () =>
              requireContext(resourceContext),
            );
          },
          attachURLLinktoCurrentPage: function (url, left, bottom, right, top) {
            requireOpen();
            if (
              !modifierPage ||
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
                !module._muhammara_wasm_modifier_attach_url_link(
                  modifier,
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
          createAnnotation: function (
            subtype,
            left,
            bottom,
            right,
            top,
            options,
          ) {
            requireOpen();
            if (!modifierPage) throw new Error("No context created");
            return createAnnotation(
              (...args) =>
                module._muhammara_wasm_modifier_create_annotation(
                  modifier,
                  ...args,
                ),
              subtype,
              left,
              bottom,
              right,
              top,
              options,
            );
          },
          endContext: function () {
            requireOpen();
            requireContext(context);
            if (!module._muhammara_wasm_modifier_end_context(modifier)) {
              throw new Error("Unable to finish page content context");
            }
            context = null;
            return this;
          },
          writePage: function () {
            requireOpen();
            if (
              !modifierPage ||
              context ||
              !module._muhammara_wasm_modifier_write_page(modifier)
            ) {
              throw new Error("Unable to write modified page");
            }
            modifierPage = null;
            return this;
          },
        };
      },
      writePage: function (nextPage) {
        requireOpen();
        if (nextPage !== page)
          throw new Error("The active PDFPage is required");
        if (context && !module._muhammara_wasm_modifier_end_context(modifier)) {
          throw new Error("Unable to finish page content context");
        }
        context = null;
        if (!module._muhammara_wasm_modifier_write_page(modifier))
          throw new Error("Unable to write page");
        page = null;
        nextPage._getNativeResources = null;
        return this;
      },
      writePageAndReturnID: function (nextPage) {
        requireOpen();
        if (nextPage !== page)
          throw new Error("The active PDFPage is required");
        var objectIdPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_modifier_write_page_and_return_id(
              modifier,
              objectIdPointer,
            )
          )
            throw new Error("Unable to write page");
          var objectId = module.HEAPU32[objectIdPointer >>> 2];
          page = null;
          context = null;
          nextPage._getNativeResources = null;
          return objectId;
        } finally {
          module._free(objectIdPointer);
        }
      },
      createPDFCopyingContext: function (sourceBytes) {
        requireOpen();
        sourceBytes = normalizeBytes(sourceBytes, "PDF input");
        var sourcePath = `/pdfs/${state.nextPdf++}.pdf`;
        module.FS.writeFile(sourcePath, sourceBytes);
        var copying;
        try {
          copying = withString(sourcePath, (pointer) =>
            module._muhammara_wasm_modifier_create_copying_context(
              modifier,
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
          requireOpen();
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
            if (targetPage !== page || !Number.isInteger(index) || index < 0)
              throw new Error(
                "The active target page and a non-negative source index are required",
              );
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
              !form ||
              form._owner !== owner ||
              form._ended ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new TypeError(
                "An open form from this modifier and a non-negative page index are required",
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
            if (!result) throw new Error("Unable to end PDF copying context");
            return this;
          },
        };
      },
      createPDFCopyingContextAsync: async function (sourceBytes) {
        return this.createPDFCopyingContext(
          await normalizeBytesAsync(sourceBytes, "PDF input"),
        );
      },
      createPDFCopyingContextForModifiedFile: function () {
        requireOpen();
        var copying =
          module._muhammara_wasm_modifier_create_copying_context_for_modified_file(
            modifier,
          );
        if (!copying) {
          throw new Error(
            "Unable to create PDF copying context for modified file",
          );
        }
        var copyingEnded = false;
        var sourceParsers = [];
        function cleanupCopying() {
          if (!copying) return;
          sourceParsers.forEach((parser) => parser._end());
          if (!copyingEnded)
            module._muhammara_wasm_copying_context_end(copying);
          module._muhammara_wasm_modifier_destroy_copying_context(copying);
          copying = 0;
          copyingEnded = true;
          lifecycle.untrack(cleanupCopying);
        }
        lifecycle.track(cleanupCopying);
        function requireCopying() {
          requireOpen();
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
            for (var index = start; index <= end; ++index) {
              this.appendPDFPageFromPDF(index);
            }
            return this;
          },
          mergePDFPageToPage: function (targetPage, index) {
            requireCopying();
            if (
              targetPage !== page ||
              context ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new Error(
                "Merge before starting the target page context with a non-negative source index",
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
            if (!objectId) {
              throw new RangeError(`Unable to create form from page ${index}`);
            }
            return objectId;
          },
          mergePDFPageToFormXObject: function (form, index) {
            requireCopying();
            if (
              !form ||
              form._owner !== owner ||
              form._ended ||
              !Number.isInteger(index) ||
              index < 0
            ) {
              throw new TypeError(
                "An open form from this modifier and a non-negative page index are required",
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
      end: function () {
        requireOpen();
        if (
          page ||
          context ||
          lifecycle.hasChildren() ||
          (objectsContext && objectsContext._hasActive())
        )
          throw new Error("Write the active page before ending the PDF");
        var lengthPointer = module._malloc(4);
        try {
          var pdfPointer = module._muhammara_wasm_modifier_end_pdf(
            modifier,
            lengthPointer,
          );
          var length = module.HEAPU32[lengthPointer >>> 2];
          if (!pdfPointer || !length)
            throw new Error("Unable to finish modified PDF");
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
  }

  return createWriterToModify;
}
