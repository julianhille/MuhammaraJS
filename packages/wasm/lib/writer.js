import { createChildLifecycle } from "./lifecycle.js";
import { ImageFitPolicy } from "./value-sets.js";
import { isPageBoxType } from "./constants.js";
import {
  readTextOptions,
  validateDrawingGeometry,
  applyDrawingColor,
  installDrawingHelpers,
  checkOperatorRange,
  measureFontText,
  readFontUnderline,
  prepareUnderline,
  strokeUnderline,
} from "./drawing-options.js";

/**
 * Creates shared support functions used by low-level PDF writers.
 * @param {object} dependencies - Module, asset registries, and byte helpers.
 * @returns {object} `imageAssetPath`, `drawImageCall`, `removeAssets`,
 * `resourcesDictionary`, and `createAnnotation`.
 */
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
  /**
   * Resolves a registered asset name, or stores sniffed image bytes, as a virtual path.
   * @param {string|ByteSource} value - Registered image or PDF name, or JPEG, PNG, TIFF, or PDF bytes.
   * @param {string[]} retainedPaths - Receives the path of stored bytes so the caller can remove it.
   * @returns {string} Virtual file system path.
   * @throws {Error} If `value` names no registered asset.
   * @throws {TypeError} If the bytes are not JPEG, PNG, TIFF, or PDF.
   */
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

  /**
   * Validates drawImage options and flattens them for the native call.
   * @param {DrawImageOptions} [options] - Page index and a matrix or fit transformation.
   * @returns {object} `index`, `method` (0 none, 1 matrix, 2 fit), `matrix`,
   * `width`, `height`, `proportional`, and native `fit` (0 always, 1 overflow).
   * @throws {TypeError} If an option is unknown, a Node-only option is passed, or
   * a value has the wrong type or is not an ImageFitPolicy.
   * @throws {RangeError} If `index` is not a 32-bit unsigned integer or the fit box is not positive.
   */
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
      !Object.values(ImageFitPolicy).includes(transformation.fit)
    ) {
      throw new TypeError("drawImage fit must be always or overflow");
    }
    result.method = 2;
    result.width = transformation.width;
    result.height = transformation.height;
    result.proportional = transformation.proportional || false;
    result.fit = transformation.fit === ImageFitPolicy.ALWAYS ? 0 : 1;
    return result;
  }

  /**
   * Validates drawImage arguments and runs a native draw call.
   * @param {Function} call - Native draw call taking `(pathPointer, drawOptions, matrixPointer)`.
   * @param {number} x - Left position.
   * @param {number} y - Bottom position.
   * @param {string|ByteSource} image - Registered asset name or image bytes.
   * @param {DrawImageOptions} [options] - Page index and transformation.
   * @param {string[]} retainedPaths - Receives the path of stored bytes.
   * @returns {void}
   * @throws {TypeError} If a coordinate is not finite or an option is invalid.
   * @throws {Error} If the image cannot be drawn.
   */
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

  /**
   * Removes stored asset files and empties the list.
   * @param {string[]} paths - Virtual file system paths.
   * @returns {void}
   */
  function removeAssets(paths) {
    paths.forEach(removeFile);
    paths.length = 0;
  }

  /**
   * Wraps a native resources dictionary handle.
   * @param {number} handle - Native resources dictionary.
   * @param {Function} requireOpen - Throws when the owning page or form is closed.
   * @returns {ResourcesDictionary} The resources dictionary.
   */
  function resourcesDictionary(handle, requireOpen) {
    /**
     * Adds an object to one resource category and returns its resource name.
     * @param {number} type - Native category, from 0 (ExtGState) to 8 (Shading).
     * @param {number} objectId - Indirect object ID.
     * @returns {string} The generated resource name.
     * @throws {RangeError} If `objectId` is not a positive integer.
     * @throws {Error} If the owner is closed or the mapping fails.
     */
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
      /**
       * Adds a procedure set name to `/ProcSet`.
       * @param {ProcsetName} name - Procedure set, such as `KProcsetText`.
       * @returns {void}
       * @throws {TypeError} If `name` is not a non-empty string.
       * @throws {Error} If the owner is closed or the procset cannot be added.
       */
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
      /**
       * Maps a graphics state object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the graphics state.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addExtGStateMapping: (objectId) => addMapping(0, objectId),
      /**
       * Maps a font object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the font.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addFontMapping: (objectId) => addMapping(1, objectId),
      /**
       * Maps a color space object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the color space.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addColorSpaceMapping: (objectId) => addMapping(2, objectId),
      /**
       * Maps a pattern object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the pattern.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addPatternMapping: (objectId) => addMapping(3, objectId),
      /**
       * Maps a marked-content property list object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the marked-content property list.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addPropertyMapping: (objectId) => addMapping(4, objectId),
      /**
       * Maps a XObject object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the XObject.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addXObjectMapping: (objectId) => addMapping(5, objectId),
      /**
       * Maps a form XObject object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the form XObject.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addFormXObjectMapping: (objectId) => addMapping(6, objectId),
      /**
       * Maps a image XObject object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the image XObject.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addImageXObjectMapping: (objectId) => addMapping(7, objectId),
      /**
       * Maps a shading object into the resources dictionary.
       * @param {number} objectId - Indirect object ID of the shading.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addShadingMapping: (objectId) => addMapping(8, objectId),
    };
  }

  /**
   * Validates annotation options and runs a native annotation call.
   * @param {Function} call - Native call receiving the encoded arguments.
   * @param {string} subtype - Annotation subtype, such as `Text` or `Highlight`.
   * @param {number} left - Rectangle left.
   * @param {number} bottom - Rectangle bottom.
   * @param {number} right - Rectangle right, not less than `left`.
   * @param {number} top - Rectangle top, not less than `bottom`.
   * @param {AnnotationOptions} [options={}] - Contents, color, border, and flags.
   * @returns {number} The annotation object ID.
   * @throws {TypeError} If the subtype, rectangle, or an option is invalid.
   * @throws {Error} If the annotation cannot be created.
   */
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

/**
 * Creates the low-level PDF writer factory.
 * @param {object} dependencies - Module, constants, value types, and shared helpers.
 * @returns {object} Writer factory; its `createWriter(options)` opens a writer.
 */
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
  /**
   * Opens an in-memory PDF writer.
   * @param {WriterOptions} [options={}] - PDF version and stream compression.
   * @returns {PDFWriter} The writer; call `end()` for the bytes or `dispose()` to discard it.
   * @throws {TypeError} If `options` is not an object or `compress` is not a boolean.
   * @throws {RangeError} If `version` is not a supported `ePDFVersion*` constant.
   * @throws {Error} If the native writer cannot be created.
   */
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

    /**
     * Releases the native writer, its children, and stored assets. Idempotent.
     * @returns {void}
     */
    function dispose() {
      if (disposed) return;
      disposed = true;
      lifecycle.disposeChildren();
      removeAssets(directImagePaths);
      if (recipe) module._muhammara_wasm_recipe_destroy(recipe);
      recipe = 0;
      ended = true;
    }

    /**
     * Rejects use of a page content context after its page was written or paused.
     * @param {object} context - Content context being used.
     * @returns {void}
     * @throws {Error} If the writer ended or `context` is not the current page context.
     */
    function requireActiveContext(context) {
      if (ended || context !== currentContext || !currentPage) {
        throw new Error("Page content context is not active");
      }
    }

    /**
     * Rejects use of a finalized writer.
     * @returns {void}
     * @throws {Error} If the writer has ended.
     */
    function requireOpenWriter() {
      if (ended) throw new Error("PDF writer has ended");
    }

    /**
     * Guards a writer method while preserving asynchronous rejection semantics.
     * @param {Function} method - Method to wrap.
     * @param {boolean} asynchronous - Whether the wrapper returns a promise that rejects.
     * @returns {Function} The guarded method.
     */
    function withActiveWriter(method, asynchronous) {
      if (asynchronous) {
        /** Reject calls on a finalized writer before normalizing async inputs. */
        return async function (...args) {
          requireOpenWriter();
          return method.apply(this, args);
        };
      }
      /** Reject calls on a finalized writer before touching its resources. */
      return function (...args) {
        requireOpenWriter();
        return method.apply(this, args);
      };
    }

    var additionalInfo = new Map();
    var infoDictionary = {
      /**
       * Sets a custom Info dictionary entry.
       * @param {string} key - Entry name without the leading slash.
       * @param {string} value - Text value.
       * @returns {void}
       * @throws {TypeError} If `key` or `value` is not a string.
       * @throws {Error} If the writer has ended or the entry cannot be set.
       */
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
      /**
       * Removes a custom Info dictionary entry.
       * @param {string} key - Entry name.
       * @returns {void}
       * @throws {TypeError} If `key` is not a string.
       * @throws {Error} If the writer has ended or the entry cannot be removed.
       */
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
      /**
       * Removes every custom Info dictionary entry.
       * @returns {void}
       * @throws {Error} If the writer has ended or the entries cannot be cleared.
       */
      clearAdditionalInfoEntries: function () {
        requireOpenWriter();
        if (!module._muhammara_wasm_recipe_clear_info(recipe)) {
          throw new Error("Unable to clear additional info entries");
        }
        additionalInfo.clear();
      },
      /**
       * Reads a custom Info dictionary entry.
       * @param {string} key - Entry name.
       * @returns {string} The value, or an empty string when unset.
       * @throws {TypeError} If `key` is not a string.
       * @throws {Error} If the writer has ended.
       */
      getAdditionalInfoEntry: function (key) {
        requireOpenWriter();
        if (typeof key !== "string")
          throw new TypeError("getAdditionalInfoEntry requires a string");
        return additionalInfo.get(key) || "";
      },
      /**
       * Reads every custom Info dictionary entry.
       * @returns {Record<string, string>} Entries keyed by name.
       * @throws {Error} If the writer has ended.
       */
      getAdditionalInfoEntries: function () {
        requireOpenWriter();
        return Object.fromEntries(additionalInfo);
      },
      /**
       * Sets `/CreationDate`.
       * @param {string|Date|PDFDate} value - PDF date string, Date, or PDFDate.
       * @returns {void}
       * @throws {TypeError} If `value` is not a valid date.
       * @throws {Error} If the writer has ended or the date cannot be parsed or set.
       */
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
      /**
       * Sets `/ModDate`.
       * @param {string|Date|PDFDate} value - PDF date string, Date, or PDFDate.
       * @returns {void}
       * @throws {TypeError} If `value` is not a valid date.
       * @throws {Error} If the writer has ended or the date cannot be parsed or set.
       */
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
          /**
           * Reads the text entry.
           * @returns {string} The value, or an empty string when unset.
           */
          get: function () {
            return value;
          },
          /**
           * Writes the text entry.
           * @param {string} nextValue - New value; other values are converted with `String()`.
           * @returns {void}
           * @throws {Error} If the writer has ended or the entry cannot be set.
           */
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
    var TRAPPED_VALUES = [
      constants.EInfoTrappedTrue,
      constants.EInfoTrappedFalse,
      constants.EInfoTrappedUnknown,
    ];
    var trapped = constants.EInfoTrappedUnknown;
    Object.defineProperty(infoDictionary, "trapped", {
      /**
       * Reads `/Trapped`.
       * @returns {EInfoTrapped} The trapped state; `EInfoTrappedUnknown` by default.
       */
      get: function () {
        return trapped;
      },
      /**
       * Writes `/Trapped`.
       * @param {EInfoTrapped} value - An `EInfoTrapped*` constant.
       * @returns {void}
       * @throws {RangeError} If `value` is not an EInfoTrapped constant.
       * @throws {Error} If the writer has ended or the entry cannot be set.
       */
      set: function (value) {
        requireOpenWriter();
        if (!TRAPPED_VALUES.includes(value)) {
          throw new RangeError("trapped must be an EInfoTrapped value");
        }
        if (!module._muhammara_wasm_recipe_set_info_trapped(recipe, value)) {
          throw new Error("Unable to set trapped");
        }
        trapped = value;
      },
    });
    var documentContext = {
      /**
       * Returns the document Info dictionary.
       * @returns {InfoDictionary} The Info dictionary.
       * @throws {Error} If the writer has ended.
       */
      getInfoDictionary: function () {
        requireOpenWriter();
        return infoDictionary;
      },
    };

    /**
     * Creates the content context of the current page.
     * @returns {ContentContext} The page content context.
     */
    function contentContext() {
      /**
       * Applies one numeric content operator to the current page.
       * @param {string} name - Operator name for error messages.
       * @param {number} code - Native operator code.
       * @param {number[]} [args=[]] - Operands; a missing operand is `undefined` and rejected.
       * @param {boolean} [integers=false] - Whether operands must be integers.
       * @returns {ContentContext} The content context.
       * @throws {TypeError} If an operand is not finite, or not an integer when required.
       * @throws {Error} If the context is inactive or the operator fails.
       */
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
        /**
         * Returns the page this content context writes to.
         * @returns {PDFPage} The current page.
         * @throws {Error} If the content context is no longer active.
         */
        getAssociatedPage: function () {
          requireActiveContext(context);
          return currentPage;
        },
        /**
         * Returns the page content stream being written.
         * @returns {object} The stream; `getWriteStream()` exposes a byte writer.
         * @throws {Error} If the content context or its stream is no longer active.
         */
        getCurrentPageContentStream: function () {
          requireActiveContext(context);
          var stream = module._muhammara_wasm_page_content_get_stream(recipe);
          if (!stream)
            throw new Error("Page content stream is no longer active");
          return {
            /**
             * Returns a writer that appends raw bytes to the page content stream.
             * @returns {object} A writer with `write(bytes)`.
             * @throws {Error} If the content context or its stream is no longer active.
             */
            getWriteStream: function () {
              requireActiveContext(context);
              var writer =
                module._muhammara_wasm_content_stream_get_write_stream(stream);
              if (!writer)
                throw new Error("Page content stream is no longer active");
              return {
                /**
                 * Appends raw bytes to the page content stream.
                 * @param {ByteSource} bytes - Bytes to append.
                 * @returns {number} The number of bytes written.
                 * @throws {TypeError} If `bytes` is not a supported byte source.
                 * @throws {Error} If the content context is no longer active or the write fails.
                 */
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
        /**
         * Appends raw content-stream code.
         * @param {string} freeCode - Operators to write verbatim.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `freeCode` is not a string.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Sets fill and stroke opacity through an ExtGState resource.
         * @param {number} opacity - Opacity from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `opacity` is not a finite number from 0 to 1.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Closes, fills (nonzero winding), and strokes the current path (`b`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        b: function () {
          return operator("b", 0);
        },
        /**
         * Fills (nonzero winding) and strokes the current path (`B`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        B: function () {
          return operator("B", 1);
        },
        /**
         * Closes, fills (even-odd), and strokes the current path (`b*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        bStar: function () {
          return operator("bStar", 2);
        },
        /**
         * Fills (even-odd) and strokes the current path (`B*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        BStar: function () {
          return operator("BStar", 3);
        },
        /**
         * Closes and strokes the current path (`s`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        s: function () {
          return operator("s", 4);
        },
        /**
         * Fills the current path using the nonzero winding rule (`F`, the obsolete `f` spelling).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        F: function () {
          return operator("F", 7);
        },
        /**
         * Fills the current path using the even-odd rule (`f*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        fStar: function () {
          return operator("fStar", 8);
        },
        /**
         * Ends the current path without filling or stroking it (`n`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        n: function () {
          return operator("n", 9);
        },
        /**
         * Appends a cubic Bezier curve (`c`).
         * @param {number} x1 - First control point x.
         * @param {number} y1 - First control point y.
         * @param {number} x2 - Second control point x.
         * @param {number} y2 - Second control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        c: function (x1, y1, x2, y2, x3, y3) {
          return operator("c", 12, [x1, y1, x2, y2, x3, y3]);
        },
        /**
         * Appends a cubic Bezier curve whose first control point is the current point (`v`).
         * @param {number} x2 - Second control point x.
         * @param {number} y2 - Second control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        v: function (x1, y1, x2, y2) {
          return operator("v", 13, [x1, y1, x2, y2]);
        },
        /**
         * Appends a cubic Bezier curve whose second control point is the end point (`y`).
         * @param {number} x1 - First control point x.
         * @param {number} y1 - First control point y.
         * @param {number} x3 - End point x.
         * @param {number} y3 - End point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        y: function (x1, y1, x2, y2) {
          return operator("y", 14, [x1, y1, x2, y2]);
        },
        /**
         * Closes the current subpath (`h`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        h: function () {
          return operator("h", 15);
        },
        /**
         * Concatenates a matrix to the current transformation matrix (`cm`).
         * @param {number} a - Matrix component `a`.
         * @param {number} b - Matrix component `b`.
         * @param {number} c - Matrix component `c`.
         * @param {number} d - Matrix component `d`.
         * @param {number} e - Matrix component `e`.
         * @param {number} f - Matrix component `f`.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        cm: function (a, b, c, d, e, f) {
          return operator("cm", 19, [a, b, c, d, e, f]);
        },
        /**
         * Sets the line cap style (`J`).
         * @param {LineCapStyle} value - 0 butt, 1 round, or 2 projecting square.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `value` is missing or not an integer.
         * @throws {RangeError} If `value` is not 0, 1, or 2.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        J: function (value) {
          checkOperatorRange("J", value, 2, "line cap");
          return operator("J", 21, [value]);
        },
        /**
         * Sets the line join style (`j`).
         * @param {LineJoinStyle} value - 0 miter, 1 round, or 2 bevel.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `value` is missing or not an integer.
         * @throws {RangeError} If `value` is not 0, 1, or 2.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        j: function (value) {
          checkOperatorRange("j", value, 2, "line join");
          return operator("j", 22, [value]);
        },
        /**
         * Sets the miter limit (`M`).
         * @param {number} value - Miter limit.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        M: function (value) {
          return operator("M", 23, [value]);
        },
        /**
         * Sets the dash pattern (`d`).
         * @param {number[]} dash - Alternating dash and gap lengths; empty for a solid line.
         * @param {number} [phase=0] - Offset into the pattern.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `dash` is not an array of finite numbers or `phase` is not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Sets the nonstroking gray color (`g`).
         * @param {number} value - Gray level from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        g: function (value) {
          return operator("g", 24, [value]);
        },
        /**
         * Sets the stroking CMYK color (`K`).
         * @param {number} cyan - Cyan from 0 to 1.
         * @param {number} magenta - Magenta from 0 to 1.
         * @param {number} yellow - Yellow from 0 to 1.
         * @param {number} black - Black from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        K: function (cyan, magenta, yellow, black) {
          return operator("K", 29, [cyan, magenta, yellow, black]);
        },
        /**
         * Sets the nonstroking RGB color (`rg`).
         * @param {number} red - Red from 0 to 1.
         * @param {number} green - Green from 0 to 1.
         * @param {number} blue - Blue from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        rg: function (red, green, blue) {
          return operator("rg", 26, [red, green, blue]);
        },
        /**
         * Sets the stroking RGB color (`RG`).
         * @param {number} red - Red from 0 to 1.
         * @param {number} green - Green from 0 to 1.
         * @param {number} blue - Blue from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        RG: function (red, green, blue) {
          return operator("RG", 27, [red, green, blue]);
        },
        /**
         * Intersects the clipping path with the current path, nonzero winding (`W`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        W: function () {
          return operator("W", 30);
        },
        /**
         * Intersects the clipping path with the current path, even-odd (`W*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        WStar: function () {
          return operator("WStar", 31);
        },
        /**
         * Begins a text object (`BT`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        BT: function () {
          return operator("BT", 32);
        },
        /**
         * Ends a text object (`ET`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        ET: function () {
          return operator("ET", 33);
        },
        /**
         * Sets the text matrix and text line matrix (`Tm`).
         * @param {number} a - Matrix component `a`.
         * @param {number} b - Matrix component `b`.
         * @param {number} c - Matrix component `c`.
         * @param {number} d - Matrix component `d`.
         * @param {number} e - Matrix component `e`.
         * @param {number} f - Matrix component `f`.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tm: function (a, b, c, d, e, f) {
          return operator("Tm", 34, [a, b, c, d, e, f]);
        },
        /**
         * Sets the character spacing (`Tc`).
         * @param {number} characterSpace - Extra space per glyph in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tc: function (characterSpace) {
          return operator("Tc", 35, [characterSpace]);
        },
        /**
         * Sets the word spacing (`Tw`).
         * @param {number} wordSpace - Extra space per ASCII space in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tw: function (wordSpace) {
          return operator("Tw", 36, [wordSpace]);
        },
        /**
         * Sets the horizontal text scaling (`Tz`).
         * @param {number} horizontalScaling - Integer percentage; 100 is normal width.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {TypeError} If `horizontalScaling` is not an integer.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tz: function (horizontalScaling) {
          return operator("Tz", 37, [horizontalScaling], true);
        },
        /**
         * Sets the text leading (`TL`).
         * @param {number} textLeading - Line spacing in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        TL: function (textLeading) {
          return operator("TL", 38, [textLeading]);
        },
        /**
         * Sets the text rendering mode (`Tr`).
         * @param {TextRenderingMode} renderingMode - Mode from 0 (fill) to 7 (add to clip).
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `renderingMode` is missing or not an integer.
         * @throws {RangeError} If `renderingMode` is outside 0 to 7.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Tr: function (renderingMode) {
          checkOperatorRange("Tr", renderingMode, 7, "text rendering mode");
          return operator("Tr", 39, [renderingMode], true);
        },
        /**
         * Sets the text rise (`Ts`).
         * @param {number} fontRise - Baseline shift in unscaled text space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Ts: function (fontRise) {
          return operator("Ts", 40, [fontRise]);
        },
        /**
         * Selects the font and size for text (`Tf`).
         * @param {PDFUsedFont|string} font - Font from this writer, or a font resource name.
         * @param {number} size - Positive font size.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `font` is neither a font from this writer nor a string.
         * @throws {RangeError} If `size` is not a positive finite number.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
            return withString(text, (textPointer, textLength) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  0,
                  encoding,
                  0,
                  0,
                  textPointer,
                  textLength,
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
            return withString(text, (pointer, length) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  1,
                  textEncoding(options),
                  0,
                  0,
                  pointer,
                  length,
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
            return withString(text, (pointer, length) => {
              if (
                !module._muhammara_wasm_writer_show_text_operator(
                  recipe,
                  2,
                  textEncoding(options),
                  wordSpace,
                  characterSpace,
                  pointer,
                  length,
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
        /**
         * Moves to the start of the next text line, offset from the current one (`Td`).
         * @param {number} x - Horizontal offset.
         * @param {number} y - Vertical offset.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Td: function (x, y) {
          return operator("Td", 41, [x, y]);
        },
        /**
         * Moves to the next text line and sets the leading to `-y` (`TD`).
         * @param {number} x - Horizontal offset.
         * @param {number} y - Vertical offset.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        TD: function (x, y) {
          return operator("TD", 42, [x, y]);
        },
        /**
         * Moves to the start of the next text line (`T*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        TStar: function () {
          return operator("TStar", 43);
        },
        /**
         * Saves the graphics state (`q`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        q: function () {
          return operator("q", 17);
        },
        /**
         * Restores the graphics state (`Q`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        Q: function () {
          return operator("Q", 18);
        },
        /**
         * Sets the nonstroking CMYK color (`k`).
         * @param {number} cyan - Cyan from 0 to 1.
         * @param {number} magenta - Magenta from 0 to 1.
         * @param {number} yellow - Yellow from 0 to 1.
         * @param {number} black - Black from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        k: function (cyan, magenta, yellow, black) {
          return operator("k", 28, [cyan, magenta, yellow, black]);
        },
        /**
         * Sets the stroking gray color (`G`).
         * @param {number} gray - Gray level from 0 to 1.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        G: function (gray) {
          return operator("G", 25, [gray]);
        },
        /**
         * Sets the line width (`w`).
         * @param {number} width - Line width in user space units.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        w: function (width) {
          return operator("w", 20, [width]);
        },
        /**
         * Begins a new subpath at a point (`m`).
         * @param {number} x - Point x.
         * @param {number} y - Point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        m: function (x, y) {
          return operator("m", 10, [x, y]);
        },
        /**
         * Appends a straight line to a point (`l`).
         * @param {number} x - Point x.
         * @param {number} y - Point y.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        l: function (x, y) {
          return operator("l", 11, [x, y]);
        },
        /**
         * Appends a rectangle subpath (`re`).
         * @param {number} x - Lower-left x.
         * @param {number} y - Lower-left y.
         * @param {number} width - Rectangle width.
         * @param {number} height - Rectangle height.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        re: function (x, y, width, height) {
          return operator("re", 16, [x, y, width, height]);
        },
        /**
         * Fills the current path using the nonzero winding rule (`f`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        f: function () {
          return operator("f", 6);
        },
        /**
         * Strokes the current path (`S`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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

      installDrawingHelpers(context, colorValue);
      context.writeText = function (text, x, y, options = {}) {
        options = readTextOptions(options, colorValue);
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
        var underline = prepareUnderline(options, text, x, y, size);
        context.BT();
        applyDrawingColor(context, options, false);
        context.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
        strokeUnderline(context, options, underline, x);
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
        if (ended) {
          throw new TypeError(
            "Text or glyph ids and a positive font size are required",
          );
        }
        return measureFontText(
          module,
          withString,
          text,
          size,
          (textPointer, resultPointer) =>
            module._muhammara_wasm_writer_font_text_dimensions(
              recipe,
              this._font,
              textPointer,
              size,
              resultPointer,
            ),
          (glyphPointer, count, resultPointer) =>
            module._muhammara_wasm_writer_font_glyph_dimensions(
              recipe,
              this._font,
              glyphPointer,
              count,
              size,
              resultPointer,
            ),
        );
      }

      /** Read underline thickness, position, and text advance for writeText. */
      _underline(text, size) {
        return readFontUnderline(
          module,
          withString,
          text,
          size,
          (textPointer, resultPointer) =>
            module._muhammara_wasm_writer_font_underline(
              recipe,
              this._font,
              textPointer,
              size,
              resultPointer,
            ),
        );
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
          /**
           * Appends raw content-stream code.
           * @param {string} freeCode - Operators to write verbatim.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `freeCode` is not a string.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
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
          /**
           * Sets fill and stroke opacity through an ExtGState resource.
           * @param {number} opacity - Opacity from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `opacity` is not a finite number from 0 to 1.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
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
          /**
           * Closes, fills (nonzero winding), and strokes the current path (`b`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          b: function () {
            return operator("b", 0);
          },
          /**
           * Fills (nonzero winding) and strokes the current path (`B`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          B: function () {
            return operator("B", 1);
          },
          /**
           * Closes, fills (even-odd), and strokes the current path (`b*`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          bStar: function () {
            return operator("bStar", 2);
          },
          /**
           * Fills (even-odd) and strokes the current path (`B*`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          BStar: function () {
            return operator("BStar", 3);
          },
          /**
           * Closes and strokes the current path (`s`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          s: function () {
            return operator("s", 4);
          },
          /**
           * Fills the current path using the nonzero winding rule (`F`, the obsolete `f` spelling).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          F: function () {
            return operator("F", 7);
          },
          /**
           * Fills the current path using the even-odd rule (`f*`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          fStar: function () {
            return operator("fStar", 8);
          },
          /**
           * Ends the current path without filling or stroking it (`n`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          n: function () {
            return operator("n", 9);
          },
          /**
           * Appends a cubic Bezier curve (`c`).
           * @param {number} x1 - First control point x.
           * @param {number} y1 - First control point y.
           * @param {number} x2 - Second control point x.
           * @param {number} y2 - Second control point y.
           * @param {number} x3 - End point x.
           * @param {number} y3 - End point y.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          c: function (x1, y1, x2, y2, x3, y3) {
            return operator("c", 12, [x1, y1, x2, y2, x3, y3]);
          },
          /**
           * Appends a cubic Bezier curve whose first control point is the current point (`v`).
           * @param {number} x2 - Second control point x.
           * @param {number} y2 - Second control point y.
           * @param {number} x3 - End point x.
           * @param {number} y3 - End point y.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          v: function (x1, y1, x2, y2) {
            return operator("v", 13, [x1, y1, x2, y2]);
          },
          /**
           * Appends a cubic Bezier curve whose second control point is the end point (`y`).
           * @param {number} x1 - First control point x.
           * @param {number} y1 - First control point y.
           * @param {number} x3 - End point x.
           * @param {number} y3 - End point y.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          y: function (x1, y1, x2, y2) {
            return operator("y", 14, [x1, y1, x2, y2]);
          },
          /**
           * Closes the current subpath (`h`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          h: function () {
            return operator("h", 15);
          },
          /**
           * Sets the line cap style (`J`).
           * @param {LineCapStyle} value - 0 butt, 1 round, or 2 projecting square.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `value` is missing or not an integer.
           * @throws {RangeError} If `value` is not 0, 1, or 2.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          J: function (value) {
            checkOperatorRange("J", value, 2, "line cap");
            return operator("J", 21, [value]);
          },
          /**
           * Sets the line join style (`j`).
           * @param {LineJoinStyle} value - 0 miter, 1 round, or 2 bevel.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `value` is missing or not an integer.
           * @throws {RangeError} If `value` is not 0, 1, or 2.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          j: function (value) {
            checkOperatorRange("j", value, 2, "line join");
            return operator("j", 22, [value]);
          },
          /**
           * Sets the miter limit (`M`).
           * @param {number} value - Miter limit.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          M: function (value) {
            return operator("M", 23, [value]);
          },
          /**
           * Sets the dash pattern (`d`).
           * @param {number[]} dash - Alternating dash and gap lengths; empty for a solid line.
           * @param {number} [phase=0] - Offset into the pattern.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `dash` is not an array of finite numbers or `phase` is not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
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
          /**
           * Sets the nonstroking RGB color (`rg`).
           * @param {number} red - Red from 0 to 1.
           * @param {number} green - Green from 0 to 1.
           * @param {number} blue - Blue from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          rg: function (red, green, blue) {
            return operator("rg", 26, [red, green, blue]);
          },
          /**
           * Sets the nonstroking gray color (`g`).
           * @param {number} value - Gray level from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          g: function (value) {
            return operator("g", 24, [value]);
          },
          /**
           * Sets the stroking RGB color (`RG`).
           * @param {number} red - Red from 0 to 1.
           * @param {number} green - Green from 0 to 1.
           * @param {number} blue - Blue from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          RG: function (red, green, blue) {
            return operator("RG", 27, [red, green, blue]);
          },
          /**
           * Sets the stroking CMYK color (`K`).
           * @param {number} cyan - Cyan from 0 to 1.
           * @param {number} magenta - Magenta from 0 to 1.
           * @param {number} yellow - Yellow from 0 to 1.
           * @param {number} black - Black from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          K: function (cyan, magenta, yellow, black) {
            return operator("K", 29, [cyan, magenta, yellow, black]);
          },
          /**
           * Intersects the clipping path with the current path, nonzero winding (`W`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          W: function () {
            return operator("W", 30);
          },
          /**
           * Intersects the clipping path with the current path, even-odd (`W*`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          WStar: function () {
            return operator("WStar", 31);
          },
          /**
           * Saves the graphics state (`q`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          q: function () {
            return operator("q", 17);
          },
          /**
           * Restores the graphics state (`Q`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Q: function () {
            return operator("Q", 18);
          },
          /**
           * Concatenates a matrix to the current transformation matrix (`cm`).
           * @param {number} a - Matrix component `a`.
           * @param {number} b - Matrix component `b`.
           * @param {number} c - Matrix component `c`.
           * @param {number} d - Matrix component `d`.
           * @param {number} e - Matrix component `e`.
           * @param {number} f - Matrix component `f`.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          cm: function (a, b, c, d, e, f) {
            return operator("cm", 19, [a, b, c, d, e, f]);
          },
          /**
           * Sets the character spacing (`Tc`).
           * @param {number} characterSpace - Extra space per glyph in unscaled text space units.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Tc: function (characterSpace) {
            return operator("Tc", 35, [characterSpace]);
          },
          /**
           * Sets the word spacing (`Tw`).
           * @param {number} wordSpace - Extra space per ASCII space in unscaled text space units.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Tw: function (wordSpace) {
            return operator("Tw", 36, [wordSpace]);
          },
          /**
           * Sets the horizontal text scaling (`Tz`).
           * @param {number} horizontalScaling - Integer percentage; 100 is normal width.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {TypeError} If `horizontalScaling` is not an integer.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Tz: function (horizontalScaling) {
            return operator("Tz", 37, [horizontalScaling], true);
          },
          /**
           * Sets the text leading (`TL`).
           * @param {number} textLeading - Line spacing in unscaled text space units.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          TL: function (textLeading) {
            return operator("TL", 38, [textLeading]);
          },
          /**
           * Sets the text rendering mode (`Tr`).
           * @param {TextRenderingMode} renderingMode - Mode from 0 (fill) to 7 (add to clip).
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `renderingMode` is missing or not an integer.
           * @throws {RangeError} If `renderingMode` is outside 0 to 7.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Tr: function (renderingMode) {
            checkOperatorRange("Tr", renderingMode, 7, "text rendering mode");
            return operator("Tr", 39, [renderingMode], true);
          },
          /**
           * Sets the text rise (`Ts`).
           * @param {number} fontRise - Baseline shift in unscaled text space units.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          Ts: function (fontRise) {
            return operator("Ts", 40, [fontRise]);
          },
          /**
           * Sets the nonstroking CMYK color (`k`).
           * @param {number} cyan - Cyan from 0 to 1.
           * @param {number} magenta - Magenta from 0 to 1.
           * @param {number} yellow - Yellow from 0 to 1.
           * @param {number} black - Black from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          k: function (cyan, magenta, yellow, black) {
            return operator("k", 28, [cyan, magenta, yellow, black]);
          },
          /**
           * Sets the stroking gray color (`G`).
           * @param {number} gray - Gray level from 0 to 1.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          G: function (value) {
            return operator("G", 25, [value]);
          },
          /**
           * Sets the line width (`w`).
           * @param {number} width - Line width in user space units.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          w: function (value) {
            return operator("w", 20, [value]);
          },
          /**
           * Begins a new subpath at a point (`m`).
           * @param {number} x - Point x.
           * @param {number} y - Point y.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          m: function (x, y) {
            return operator("m", 10, [x, y]);
          },
          /**
           * Appends a straight line to a point (`l`).
           * @param {number} x - Point x.
           * @param {number} y - Point y.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          l: function (x, y) {
            return operator("l", 11, [x, y]);
          },
          /**
           * Appends a rectangle subpath (`re`).
           * @param {number} x - Lower-left x.
           * @param {number} y - Lower-left y.
           * @param {number} width - Rectangle width.
           * @param {number} height - Rectangle height.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If an operand is missing or not finite.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          re: function (x, y, width, height) {
            return operator("re", 16, [x, y, width, height]);
          },
          /**
           * Fills the current path using the nonzero winding rule (`f`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
          f: function () {
            return operator("f", 6);
          },
          /**
           * Strokes the current path (`S`).
           * @returns {this} The content context, for chaining.
           * @throws {Error} If the content context is no longer active or the operator fails.
           */
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
        /**
         * Begins a text object (`BT`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.BT = function () {
          return operator("BT", 32);
        };
        /**
         * Ends a text object (`ET`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.ET = function () {
          return operator("ET", 33);
        };
        /**
         * Sets the text matrix and text line matrix (`Tm`).
         * @param {number} a - Matrix component `a`.
         * @param {number} b - Matrix component `b`.
         * @param {number} c - Matrix component `c`.
         * @param {number} d - Matrix component `d`.
         * @param {number} e - Matrix component `e`.
         * @param {number} f - Matrix component `f`.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.Tm = function (a, b, c, d, e, f) {
          return operator("Tm", 34, [a, b, c, d, e, f]);
        };
        /**
         * Moves to the start of the next text line, offset from the current one (`Td`).
         * @param {number} x - Horizontal offset.
         * @param {number} y - Vertical offset.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.Td = function (x, y) {
          return operator("Td", 41, [x, y]);
        };
        /**
         * Moves to the next text line and sets the leading to `-y` (`TD`).
         * @param {number} x - Horizontal offset.
         * @param {number} y - Vertical offset.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an operand is missing or not finite.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.TD = function (x, y) {
          return operator("TD", 42, [x, y]);
        };
        /**
         * Moves to the start of the next text line (`T*`).
         * @returns {this} The content context, for chaining.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
        context.TStar = function () {
          return operator("TStar", 43);
        };
        context.Tf = function (font, size) {
          if (ended || form._ended) {
            throw new Error("Form XObject content has ended");
          }
          if (!(
            (font instanceof PDFUsedFont && font._owner === owner) ||
            typeof font === "string"
          )) {
            throw new TypeError("Tf requires a font from this writer");
          }
          if (!Number.isFinite(size) || size <= 0) {
            throw new RangeError("Tf requires a positive font size");
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
          if (ended || form._ended) {
            throw new Error("Form XObject content has ended");
          }
          if (typeof text === "string")
            return withString(text, (pointer, length) => {
              if (
                !module._muhammara_wasm_writer_form_show_text_operator(
                  recipe,
                  form._handle,
                  0,
                  textEncoding(options),
                  0,
                  0,
                  pointer,
                  length,
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
        installDrawingHelpers(context, colorValue);
        context.writeText = function (text, x, y, options = {}) {
          options = readTextOptions(options, colorValue);
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
          var underline = prepareUnderline(options, text, x, y, size);
          context.BT();
          applyDrawingColor(context, options, false);
          context.Tf(options.font, size).Tm(1, 0, 0, 1, x, y).Tj(text).ET();
          strokeUnderline(context, options, underline, x);
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
            dispose();
            throw new Error("Encrypted PDF input is not supported in Wasm");
          }
          if (errorCode !== 0) {
            dispose();
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
          if (callback) Reflect.apply(callback, globalThis, []);
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
        if (!isPageBoxType(pageBox)) {
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
            // Like native, a new page can be the target before any content.
            if (
              !currentPage &&
              targetPage instanceof PDFPage &&
              targetPage._activate
            )
              targetPage._activate();
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
            sourceParsers.forEach((parser) => parser._end());
            sourceParsers.length = 0;
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
        var page = new PDFPage(left, bottom, right, top);
        // Like native, a new page exposes its resources before any content
        // context; activating it starts the page the same way writePage does.
        page._activate = function () {
          writer.startPageContentContext(page);
        };
        return page;
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
        requireOpenWriter();
        if (currentPage) {
          throw new Error("Write the active page before ending the PDF");
        }
        if (objectsContext && objectsContext._hasActive()) {
          throw new Error(
            "End the active objects context operation before ending the PDF",
          );
        }
        // Like native, release copying contexts the caller left open.
        lifecycle.disposeChildren();
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
      page._activate = null;
      return result;
    }

    // Like native WithActiveWriter<Method>, guard stateful entry points once at
    // the API boundary. Keep inner guards for borrowed objects and async resumes.
    Object.keys(writer).forEach(function (name) {
      if (
        ["end", "dispose", "createPDFTextString", "createPDFDate"].includes(
          name,
        )
      ) {
        return;
      }
      writer[name] = withActiveWriter(writer[name], name.endsWith("Async"));
    });
    return writer;
  }

  return createWriter;
}
