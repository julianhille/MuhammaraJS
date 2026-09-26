import { createChildLifecycle } from "./lifecycle.js";
import {
  AssetExtension,
  ImageFit,
  PageBox,
  PDFImageType,
  RegisteredImageFormat,
} from "./value-sets.js";
import { isPageBoxType } from "./constants.js";
import { imageXObjects } from "./image-xobjects.js";
import { selectedPageRanges } from "./page-ranges.js";
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
      extension = AssetExtension.JPEG;
    } else if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      extension = AssetExtension.PNG;
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
      extension = AssetExtension.TIFF;
    } else if (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      extension = AssetExtension.PDF;
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
   * a value has the wrong type or is not an ImageFit.
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
      !Object.values(ImageFit).includes(transformation.fit)
    ) {
      throw new TypeError("drawImage fit must be always or overflow");
    }
    result.method = 2;
    result.width = transformation.width;
    result.height = transformation.height;
    result.proportional = transformation.proportional || false;
    result.fit = transformation.fit === ImageFit.ALWAYS ? 0 : 1;
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
       * Maps an image XObject into the resources dictionary.
       * @param {number|ImageXObject|ModifierImageXObject} image - Indirect
       *   object ID of the image XObject, or an image created by a writer or
       *   modifier, as native accepts.
       * @returns {string} The resource name to use in content operators.
       * @throws {RangeError} If `image` is neither an image XObject nor a positive integer.
       * @throws {Error} If the owner is closed or the mapping fails.
       */
      addImageXObjectMapping: (image) =>
        addMapping(7, imageXObjects.has(image) ? image.id : image),
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
   * Reads native's writer encryption options. A string `userPassword`
   * enables encryption; `ownerPassword` and `userProtectionFlag` (4 by
   * default) apply only with it, as in native.
   * @param {WriterOptions} options - Writer options.
   * @param {number} version - The writer's PDF version.
   * @returns {{userPassword: string, ownerPassword: string, userProtectionFlag: number}|null}
   *   The encryption settings, or `null` when the PDF is not encrypted.
   * @throws {TypeError} If a password is not a string, `userProtectionFlag`
   *   is not an integer, or `log` is set, which needs a file system.
   * @throws {Error} If encryption is requested for PDF 2.0, which needs AES-256.
   */
  function writerEncryption(options, version) {
    if (options.log !== undefined) {
      throw new TypeError(
        "createWriter log files are unavailable in WebAssembly",
      );
    }
    var { userPassword, ownerPassword, userProtectionFlag } = options;
    if (userPassword !== undefined && typeof userPassword !== "string")
      throw new TypeError("createWriter userPassword must be a string");
    if (ownerPassword !== undefined && typeof ownerPassword !== "string")
      throw new TypeError("createWriter ownerPassword must be a string");
    if (
      userProtectionFlag !== undefined &&
      !Number.isInteger(userProtectionFlag)
    )
      throw new TypeError("createWriter userProtectionFlag must be an integer");
    if (userPassword === undefined) return null;
    if (version === constants.ePDFVersion20) {
      throw new Error(
        "PDF 2.0 encryption needs AES-256, which is unavailable in WebAssembly",
      );
    }
    return {
      userPassword,
      ownerPassword: ownerPassword ?? "",
      userProtectionFlag: userProtectionFlag ?? 4,
    };
  }

  /**
   * Opens an in-memory PDF writer.
   * @param {WriterOptions} [options={}] - PDF version, stream compression, and
   *   native's `userPassword`, `ownerPassword`, and `userProtectionFlag`
   *   encryption options.
   * @returns {PDFWriter} The writer; call `end()` for the bytes or `dispose()` to discard it.
   * @throws {TypeError} If `options` is not an object, `compress` is not a
   *   boolean, an encryption option has the wrong type, or `log` is set.
   * @throws {RangeError} If `version` is not a supported `ePDFVersion*` constant.
   * @throws {Error} If PDF 2.0 encryption is requested or the native writer cannot be created.
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
    var encryption = writerEncryption(options, version);
    var recipe = encryption
      ? withString(encryption.userPassword, (user) =>
          withString(encryption.ownerPassword, (owner) =>
            module._muhammara_wasm_recipe_create_encrypted(
              version,
              compress ? 1 : 0,
              user,
              owner,
              encryption.userProtectionFlag,
            ),
          ),
        )
      : module._muhammara_wasm_recipe_create_with_options(
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
        v: function (x2, y2, x3, y3) {
          return operator("v", 13, [x2, y2, x3, y3]);
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
        y: function (x1, y1, x3, y3) {
          return operator("y", 14, [x1, y1, x3, y3]);
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
        /**
         * Shows text (`Tj`).
         * @param {string|Glyph} text - Text, or glyph entries to show without encoding.
         * @param {TextOptions} [options] - Text encoding; only for string text.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `options` is not an options object, has an unknown encoding, or is given with glyphs.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Moves to the next line and shows text (`'`).
         * @param {string|Glyph} text - Text, or glyph entries.
         * @param {TextOptions} [options] - Text encoding; only for string text.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `options` is invalid or given with glyphs.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Sets word and character spacing, moves to the next line, and shows text (`"`).
         * @param {number} wordSpace - Word spacing.
         * @param {number} characterSpace - Character spacing.
         * @param {string|Glyph} text - Text, or glyph entries.
         * @param {TextOptions} [options] - Text encoding; only for string text.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If a spacing is not finite, or `options` is invalid or given with glyphs.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Shows text with individual glyph positioning (`TJ`).
         * @param {...(string|number|Glyph|TextOptions)} items - Strings or glyph arrays and
         * kerning adjustments in thousandths of text space; a trailing options object sets the encoding.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If an item or the encoding is invalid.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Paints an XObject (`Do`).
         * @param {string|number|FormXObject|ImageXObject} xobject - Resource name, form object ID,
         * or a completed XObject from this writer.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `xobject` is an unfinished form or belongs to another writer.
         * @throws {Error} If the content context is no longer active or the XObject cannot be placed.
         */
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
      /**
       * Writes one line of text with a writer font.
       * @param {string} text - Text to write.
       * @param {number} x - Baseline start x.
       * @param {number} y - Baseline y.
       * @param {WriteTextOptions} [options={}] - Font, size, color, opacity, and underline.
       * @returns {this} The content context, for chaining.
       * @throws {TypeError} If `text`, a coordinate, or the font is invalid, or a color option is invalid.
       * @throws {RangeError} If `size` is not positive.
       * @throws {Error} If the content context is no longer active or the operator fails.
       */
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
      /**
       * Draws an image or PDF page at a position.
       * @param {number} x - Left position.
       * @param {number} y - Bottom position.
       * @param {string|ByteSource} image - Registered image or PDF name, or JPEG, PNG, TIFF, or PDF bytes.
       * @param {DrawImageOptions} [options] - Page index and a matrix or fit transformation.
       * @returns {this} The content context, for chaining.
       * @throws {TypeError} If a coordinate or option is invalid or the bytes are not a supported image.
       * @throws {RangeError} If `index` or the fit box is out of range.
       * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
       */
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
      /**
       * Draws an image after reading an asynchronous byte source.
       * @async
       * @param {number} x - Left position.
       * @param {number} y - Bottom position.
       * @param {string|AsyncByteSource} image - Registered name, bytes, Blob, or File.
       * @param {DrawImageOptions} [options] - Page index and transformation.
       * @returns {Promise<this>} Resolves to the content context.
       * @throws {TypeError} If a coordinate, option, or byte source is invalid.
       * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
       */
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

      /**
       * Measures text or glyphs set in this font.
       * @param {string|number[]} text - Text, or glyph IDs.
       * @param {number} [size=1] - Positive font size.
       * @returns {TextDimensions} Bounding box and advance in user space units.
       * @throws {TypeError} If the writer ended, `text` is invalid, or `size` is not positive.
       * @throws {Error} If the font cannot measure the text.
       */
      calculateTextDimensions(text, size = 1) {
        requireOpenWriter();
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

      /**
       * Reads underline thickness, position, and text advance for writeText.
       * @param {string} text - Text to underline.
       * @param {number} size - Font size.
       * @returns {object} `thickness`, `position`, and `advance` in points.
       * @throws {Error} If the font cannot provide underline metrics.
       */
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

      /**
       * Reads vertical metrics scaled to a font size.
       * @param {number} [size=1] - Positive font size.
       * @returns {FontMetrics} Pixels per em, ascender, descender, height, and maximum advance.
       * @throws {TypeError} If the writer ended or `size` is not positive.
       * @throws {Error} If the metrics cannot be read.
       */
      getFontMetrics(size = 1) {
        requireOpenWriter();
        if (!Number.isFinite(size) || size <= 0) {
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
        imageXObjects.add(this);
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

      /**
       * Returns a content context that writes to this form.
       * @returns {ContentContext} The form content context.
       * @throws {Error} If the writer or the form has ended.
       */
      getContentContext() {
        if (ended || this._ended) {
          throw new Error("Form XObject content is not writable");
        }
        var form = this;
        /**
         * Applies one numeric content operator to this form.
         * @param {string} name - Operator name for error messages.
         * @param {number} code - Native operator code.
         * @param {number[]} [args=[]] - Operands; a missing operand is `undefined` and rejected.
         * @param {boolean} [integers=false] - Whether operands must be integers.
         * @returns {ContentContext} The content context.
         * @throws {TypeError} If an operand is not finite, or not an integer when required.
         * @throws {Error} If the form ended or the operator fails.
         */
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
          v: function (x2, y2, x3, y3) {
            return operator("v", 13, [x2, y2, x3, y3]);
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
          y: function (x1, y1, x3, y3) {
            return operator("y", 14, [x1, y1, x3, y3]);
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
          /**
           * Paints an XObject (`Do`).
           * @param {string|number|FormXObject|ImageXObject} xobject - Resource name, form object ID,
           * or a completed XObject from this writer.
           * @returns {this} The content context, for chaining.
           * @throws {TypeError} If `xobject` is an unfinished form or belongs to another writer.
           * @throws {Error} If the content context is no longer active or the XObject cannot be placed.
           */
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
        /**
         * Selects the font and size for text (`Tf`).
         * @param {PDFUsedFont|string} font - Font from this writer, or a font resource name.
         * @param {number} size - Positive font size.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `font` is neither a font from this writer nor a string.
         * @throws {RangeError} If `size` is not a positive finite number.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
        /**
         * Draws an image or PDF page at a position.
         * @param {number} x - Left position.
         * @param {number} y - Bottom position.
         * @param {string|ByteSource} image - Registered image or PDF name, or JPEG, PNG, TIFF, or PDF bytes.
         * @param {DrawImageOptions} [options] - Page index and a matrix or fit transformation.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If a coordinate or option is invalid or the bytes are not a supported image.
         * @throws {RangeError} If `index` or the fit box is out of range.
         * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
         */
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
        /**
         * Draws an image after reading an asynchronous byte source.
         * @async
         * @param {number} x - Left position.
         * @param {number} y - Bottom position.
         * @param {string|AsyncByteSource} image - Registered name, bytes, Blob, or File.
         * @param {DrawImageOptions} [options] - Page index and transformation.
         * @returns {Promise<this>} Resolves to the content context.
         * @throws {TypeError} If a coordinate, option, or byte source is invalid.
         * @throws {Error} If the asset is unknown, the context is inactive, or drawing fails.
         */
        context.drawImageAsync = async function (x, y, image, options) {
          return context.drawImage(
            x,
            y,
            await normalizeBytesAsync(image, "Image bytes"),
            options,
          );
        };
        /**
         * Shows text (`Tj`).
         * @param {string|Glyph} text - Text, or glyph entries to show without encoding.
         * @param {TextOptions} [options] - Text encoding; only for string text.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `options` is not an options object, has an unknown encoding, or is given with glyphs.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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
            /**
             * Runs a native string text-showing operator on this form.
             * @param {...number} args - Operator kind, encoding, spacing, and text pointer and length.
             * @returns {boolean} Whether the operator was written.
             */
            text: (...args) =>
              module._muhammara_wasm_writer_form_show_text_operator(
                recipe,
                form._handle,
                ...args,
              ),
            /**
             * Runs a native glyph text-showing operator on this form.
             * @param {...number} args - Operator kind, spacing, and glyph pointer and count.
             * @returns {boolean} Whether the operator was written.
             */
            glyphs: (...args) =>
              module._muhammara_wasm_writer_form_show_glyphs_operator(
                recipe,
                form._handle,
                ...args,
              ),
            /**
             * Runs the native `TJ` operator on this form.
             * @param {...number} args - Encoding and the encoded item pointers.
             * @returns {boolean} Whether the operator was written.
             */
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
        /**
         * Writes one line of text with a writer font.
         * @param {string} text - Text to write.
         * @param {number} x - Baseline start x.
         * @param {number} y - Baseline y.
         * @param {WriteTextOptions} [options={}] - Font, size, color, opacity, and underline.
         * @returns {this} The content context, for chaining.
         * @throws {TypeError} If `text`, a coordinate, or the font is invalid, or a color option is invalid.
         * @throws {RangeError} If `size` is not positive.
         * @throws {Error} If the content context is no longer active or the operator fails.
         */
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

      /**
       * Returns the form content stream.
       * @returns {PDFStream} The stream; `getWriteStream()` exposes a byte writer.
       * @throws {Error} If the writer or the form has ended.
       */
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
          /**
           * Returns a writer that appends raw bytes to the form content stream.
           * @returns {ByteWriteStream} The byte writer.
           * @throws {Error} If the writer or the form has ended.
           */
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
              /**
               * Appends raw bytes to the form content stream.
               * @param {ByteSource} bytes - Bytes to append.
               * @returns {number} The number of bytes written.
               * @throws {TypeError} If `bytes` is not a supported byte source.
               * @throws {Error} If the writer or the form has ended.
               */
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

      /**
       * Returns the form resources dictionary.
       * @returns {ResourcesDictionary} The resources dictionary.
       * @throws {Error} If the writer or the form has ended.
       */
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

      /**
       * Returns the form resources dictionary; misspelled native alias.
       * @returns {ResourcesDictionary} The resources dictionary.
       * @throws {Error} If the writer or the form has ended.
       */
      getResourcesDictinary() {
        return this.getResourcesDictionary();
      }
    }

    /**
     * Resolves a registered image name to its virtual path.
     * @param {string} name - Registered image name.
     * @param {string} [expectedType] - Required RegisteredImageFormat.
     * @returns {string} Virtual file system path.
     * @throws {TypeError} If the writer ended, the name is not registered, or the format differs.
     */
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

    /**
     * Runs a callback with the path of a registered image or of temporarily stored bytes.
     * @param {string|ByteSource} value - Registered image name or image bytes.
     * @param {string} label - Name used in byte errors.
     * @param {string} [expectedType] - Required RegisteredImageFormat for a name.
     * @param {function(string): *} callback - Receives the virtual path.
     * @returns {*} The callback result.
     * @throws {TypeError} If the name is not registered or the bytes are unsupported.
     */
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

    /**
     * Reads the bytes of a registered image or PDF, or normalizes given bytes.
     * @param {string|ByteSource} value - Registered name or bytes.
     * @returns {Uint8Array} The bytes.
     * @throws {TypeError} If the name is not registered or the bytes are unsupported.
     * @throws {Error} If the writer has ended.
     */
    function imageBytes(value) {
      if (typeof value !== "string")
        return normalizeBytes(value, "Image bytes");
      if (ended) throw new Error("PDF writer has ended");
      var path = images.get(value) || pdfs.get(value);
      if (!path)
        throw new TypeError("A registered image or PDF name is required");
      return new Uint8Array(module.FS.readFile(path));
    }

    /**
     * Reads the dimensions of an image or PDF page.
     * @param {string|ByteSource} image - Registered image or PDF name, or bytes.
     * @param {number} [imageIndex=0] - Page or TIFF frame index.
     * @returns {{width: number, height: number}} Size in points.
     * @throws {RangeError} If `imageIndex` is not a 32-bit unsigned integer.
     * @throws {TypeError} If the name is not registered or the bytes are unsupported.
     * @throws {Error} If the writer ended or the dimensions cannot be read.
     */
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

    /**
     * Validates an optional reserved object ID.
     * @param {number} [value] - Object ID to write the XObject under.
     * @returns {number} The ID, or 0 to allocate a new one.
     * @throws {RangeError} If `value` is not a positive 32-bit integer.
     */
    function optionalObjectId(value) {
      if (value === undefined) return 0;
      if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff) {
        throw new RangeError("objectId must be a positive object ID");
      }
      return value;
    }

    /**
     * Appends pages of a source PDF as new pages.
     * @param {ByteSource} source - Source PDF bytes.
     * @param {PageRangeOptions} [options={}] - Pages to append; all by default.
     * @returns {number[]} Object IDs of the appended pages.
     * @throws {TypeError} If `options` is not an object or holds a password.
     * @throws {RangeError} If `type` is not an ERangeType constant, or
     * `specificRanges` is empty for a specific range or holds an invalid range.
     * @throws {Error} If a page is active, the writer ended, or the source is encrypted
     * or unreadable; a failed append disposes the writer.
     */
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
      var selectedRanges = selectedPageRanges(options, constants);
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

    /**
     * Merges pages of a source PDF into the content of a target page.
     * @param {PDFPage} targetPage - Page being written; started when no page is active.
     * @param {ByteSource} source - Source PDF bytes.
     * @param {PageRangeOptions|Function} [options] - Pages to merge, or the callback.
     * @param {Function} [callback] - Called with `globalThis` after the merge completes.
     * @returns {PDFWriter} The writer.
     * @throws {TypeError} If the page, options, or callback is invalid, or a password is given.
     * @throws {RangeError} If `type` is not an ERangeType constant, or
     * `specificRanges` is empty for a specific range or holds an invalid range.
     * @throws {Error} If another page is active, the writer ended, or the source is
     * encrypted or unreadable.
     */
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
      var selectedRanges = selectedPageRanges(options, constants);
      if (!currentPage) writer.startPageContentContext(targetPage);
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

    /**
     * Creates a completed form XObject that draws a registered image.
     * @param {string} name - Registered image name.
     * @param {string} expectedType - Required RegisteredImageFormat.
     * @param {number} [objectId] - Reserved object ID.
     * @returns {FormXObject} The form.
     * @throws {TypeError} If the name is not registered or has another format.
     * @throws {RangeError} If `objectId` is invalid.
     * @throws {Error} If the form cannot be created.
     */
    function createImageForm(name, expectedType, objectId) {
      var path = imagePath(name, expectedType);
      var types = {
        [RegisteredImageFormat.JPEG]: 0,
        [RegisteredImageFormat.PNG]: 1,
        [RegisteredImageFormat.TIFF]: 2,
      };
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
      /**
       * Appends pages of a source PDF as new pages.
       * @param {ByteSource} source - Source PDF bytes.
       * @param {PageRangeOptions} [options] - Pages to append; all by default.
       * @returns {number[]} Object IDs of the appended pages.
       * @throws {TypeError} If `options` is not an object or holds a password.
       * @throws {RangeError} If `type` is not an ERangeType constant, or
       * `specificRanges` is empty for a specific range or holds an invalid range.
       * @throws {Error} If a page is active, the writer ended, or the source is encrypted
       * or unreadable; a failed append disposes the writer.
       */
      appendPDFPagesFromPDF: function (source, options) {
        return appendPDFPagesFromPDF(source, options);
      },
      /**
       * Appends pages of a source PDF after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} source - Source PDF bytes, Blob, or File.
       * @param {PageRangeOptions} [options] - Pages to append.
       * @returns {Promise<number[]>} Object IDs of the appended pages.
       * @throws {TypeError} If the source or options are invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If a page is active, the writer ended, or the source is unreadable.
       */
      appendPDFPagesFromPDFAsync: async function (source, options) {
        return appendPDFPagesFromPDF(
          await normalizeBytesAsync(source, "PDF input"),
          options,
        );
      },
      /**
       * Merges pages of a source PDF into a target page.
       * @param {PDFPage} targetPage - Page being written.
       * @param {ByteSource} source - Source PDF bytes.
       * @param {PageRangeOptions|Function} [options] - Pages to merge, or the callback.
       * @param {Function} [callback] - Called after the merge completes.
       * @returns {this} The writer.
       * @throws {TypeError} If the page, options, or callback is invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If another page is active, the writer ended, or the source is unreadable.
       */
      mergePDFPagesToPage: function (targetPage, source, options, callback) {
        return mergePDFPagesToPage(targetPage, source, options, callback);
      },
      /**
       * Merges pages of a source PDF after reading an asynchronous byte source.
       * @async
       * @param {PDFPage} targetPage - Page being written.
       * @param {AsyncByteSource} source - Source PDF bytes, Blob, or File.
       * @param {PageRangeOptions|Function} [options] - Pages to merge, or the callback.
       * @param {Function} [callback] - Called after the merge completes.
       * @returns {Promise<this>} The writer.
       * @throws {TypeError} If the page, source, options, or callback is invalid.
       * @throws {RangeError} If the page range is invalid.
       * @throws {Error} If another page is active, the writer ended, or the source is unreadable.
       */
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
      /**
       * Returns the document context.
       * @returns {DocumentContext} Access to the Info dictionary.
       * @throws {Error} If the writer has ended.
       */
      getDocumentContext: function () {
        requireOpenWriter();
        return documentContext;
      },
      /**
       * Creates a PDF text string.
       * @param {string|number[]|Uint8Array|ArrayBuffer} [value] - Text or encoded bytes.
       * @returns {PDFTextString} The text string.
       * @throws {TypeError} If `value` is not text or bytes from 0 to 255.
       */
      createPDFTextString: function (value) {
        return new PDFTextString(value);
      },
      /**
       * Creates a PDF date.
       * @param {string|Date|PDFDate} [value] - Date; empty when omitted.
       * @returns {PDFDate} The date.
       * @throws {TypeError} If `value` is not a valid date.
       * @throws {Error} If a date string cannot be parsed.
       */
      createPDFDate: function (value) {
        return new PDFDate(value);
      },
      /**
       * Returns the raw objects context for writing indirect objects.
       * @returns {ObjectsContext} The objects context, created once per writer.
       * @throws {Error} If the writer has ended or the context cannot be created.
       */
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
      /**
       * Adds a URL link annotation to the next written page.
       * @param {string} url - Link target.
       * @param {number} left - Rectangle left.
       * @param {number} bottom - Rectangle bottom.
       * @param {number} right - Rectangle right, not less than `left`.
       * @param {number} top - Rectangle top, not less than `bottom`.
       * @returns {this} The writer.
       * @throws {TypeError} If `url` is not a string or the rectangle is invalid.
       * @throws {Error} If the writer has ended or the link cannot be attached.
       */
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
      /**
       * Writes an annotation object; register it with
       * `registerAnnotationReferenceForNextPageWrite()` to show it on a page.
       * @param {string} subtype - Annotation subtype, such as `Text` or `Highlight`.
       * @param {number} left - Rectangle left.
       * @param {number} bottom - Rectangle bottom.
       * @param {number} right - Rectangle right.
       * @param {number} top - Rectangle top.
       * @param {AnnotationOptions} [options] - Contents, color, border, and flags.
       * @returns {number} The annotation object ID.
       * @throws {TypeError} If the subtype, rectangle, or an option is invalid.
       * @throws {Error} If the writer has ended or the annotation cannot be created.
       */
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
      /**
       * Adds an annotation to the `/Annots` of the next written page.
       * @param {number} objectId - Annotation object ID.
       * @returns {this} The writer.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the writer has ended or the annotation cannot be registered.
       */
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
      /**
       * Loads a registered font for text on this writer.
       * @param {string} name - Registered font name.
       * @param {string|number} [metricsNameOrIndex] - Registered Type 1 metrics font name, or the font index.
       * @param {number} [fontIndex=0] - Face index in a font collection, after a metrics name.
       * @returns {PDFUsedFont} The font.
       * @throws {TypeError} If the writer ended, `name` is not a string, or the arguments are misordered.
       * @throws {RangeError} If the font index is not a 32-bit unsigned integer.
       * @throws {Error} If a font is not registered or cannot be loaded.
       */
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
      /**
       * Forces the catalog to be rewritten when the PDF ends.
       * @returns {void}
       * @throws {Error} If the writer has ended or the update cannot be requested.
       */
      requireCatalogUpdate: function () {
        requireOpenWriter();
        if (!module._muhammara_wasm_writer_require_catalog_update(recipe)) {
          throw new Error("Unable to require catalog update");
        }
      },
      /**
       * Reads the dimensions of an image or PDF page.
       * @param {string|ByteSource} image - Registered image or PDF name, or bytes.
       * @param {number} [imageIndex=0] - Page or TIFF frame index.
       * @returns {{width: number, height: number}} Size in points.
       * @throws {RangeError} If `imageIndex` is not a 32-bit unsigned integer.
       * @throws {TypeError} If the name is not registered or the bytes are unsupported.
       * @throws {Error} If the writer ended or the dimensions cannot be read.
       */
      getImageDimensions: function (image, imageIndex) {
        return getImageDimensions(image, imageIndex);
      },
      /**
       * Reads image dimensions after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - Image or PDF bytes, Blob, or File.
       * @param {number} [imageIndex=0] - Page or TIFF frame index.
       * @returns {Promise<{width: number, height: number}>} Size in points.
       * @throws {RangeError} If `imageIndex` is invalid.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer ended or the dimensions cannot be read.
       */
      getImageDimensionsAsync: async function (image, imageIndex) {
        return getImageDimensions(
          await normalizeBytesAsync(image, "Image bytes"),
          imageIndex,
        );
      },
      /**
       * Detects the format of an image or PDF.
       * @param {string|ByteSource} image - Registered image name, or bytes.
       * @returns {PDFImageType|undefined} The format, or undefined when unknown.
       * @throws {TypeError} If the name is not registered or the bytes are unsupported.
       * @throws {Error} If the writer has ended.
       */
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
        return [
          undefined,
          PDFImageType.PDF,
          PDFImageType.JPG,
          PDFImageType.TIFF,
          PDFImageType.PNG,
        ][type];
      },
      /**
       * Detects an image format after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - Image bytes, Blob, or File.
       * @returns {Promise<PDFImageType|undefined>} The format, or undefined when unknown.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer has ended.
       */
      getImageTypeAsync: async function (image) {
        return this.getImageType(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      /**
       * Counts the pages of a PDF or the frames of a TIFF.
       * @param {string|ByteSource} image - Registered image name, or bytes.
       * @returns {number} The page or frame count; 1 for single-image formats.
       * @throws {TypeError} If the name is not registered or the bytes are unsupported.
       * @throws {Error} If the writer has ended.
       */
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
      /**
       * Counts pages or frames after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - Image bytes, Blob, or File.
       * @returns {Promise<number>} The page or frame count.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer has ended.
       */
      getImagePagesCountAsync: async function (image) {
        return this.getImagePagesCount(
          await normalizeBytesAsync(image, "Image bytes"),
        );
      },
      /**
       * Reads JPEG sample size, components, and JFIF, Exif, and Photoshop densities.
       * @param {string|ByteSource} image - Registered JPEG name, or JPEG bytes.
       * @returns {JPGImageInformation} The information; density fields exist only for present headers.
       * @throws {TypeError} If the name is not a registered JPEG or the bytes are unsupported.
       * @throws {Error} If the writer ended or the JPEG cannot be read.
       */
      retrieveJPGImageInformation: function (image) {
        requireOpenWriter();
        var bytes;
        if (typeof image === "string") {
          bytes = module.FS.readFile(
            imagePath(image, RegisteredImageFormat.JPEG),
          );
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
      /**
       * Reads JPEG information after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - JPEG bytes, Blob, or File.
       * @returns {Promise<JPGImageInformation>} The information.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer ended or the JPEG cannot be read.
       */
      retrieveJPGImageInformationAsync: async function (image) {
        return this.retrieveJPGImageInformation(
          await normalizeBytesAsync(image, "JPEG bytes"),
        );
      },
      /**
       * Creates an image XObject from a registered JPEG.
       * @param {string} name - Registered JPEG name.
       * @param {number} [objectId] - Reserved object ID.
       * @returns {ImageXObject} The image.
       * @throws {TypeError} If the name is not a registered JPEG.
       * @throws {RangeError} If `objectId` is invalid.
       * @throws {Error} If the writer ended or the image cannot be created.
       */
      createImageXObjectFromJPGBytes: function (name, objectId) {
        var path = imagePath(name, RegisteredImageFormat.JPEG);
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
      /**
       * Creates a completed form XObject that draws a registered JPEG.
       * @param {string} name - Registered JPEG name.
       * @param {number} [objectId] - Reserved object ID.
       * @returns {FormXObject} The form.
       * @throws {TypeError} If the name is not a registered JPEG.
       * @throws {RangeError} If `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromJPGBytes: function (name, objectId) {
        return createImageForm(name, RegisteredImageFormat.JPEG, objectId);
      },
      /**
       * Creates a completed form XObject that draws a registered PNG.
       * @param {string} name - Registered PNG name.
       * @param {number} [objectId] - Reserved object ID.
       * @returns {FormXObject} The form.
       * @throws {TypeError} If the name is not a registered PNG.
       * @throws {RangeError} If `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromPNGBytes: function (name, objectId) {
        return createImageForm(name, RegisteredImageFormat.PNG, objectId);
      },
      /**
       * Creates a form XObject from a TIFF page.
       * @param {string|ByteSource} image - Registered TIFF name, or TIFF bytes.
       * @param {TIFFOptions} [options={}] - Page index, reserved object ID, and
       * black-and-white or grayscale treatment.
       * @returns {FormXObject} The completed form.
       * @throws {TypeError} If an option or treatment color is invalid, the name is not a
       * registered TIFF, or the bytes are unsupported.
       * @throws {RangeError} If `pageIndex` or `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromTIFF: function (image, options = {}) {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
          throw new TypeError("TIFF options must be an object");
        }
        /**
         * Reads an optional TIFF treatment object.
         * @param {string} name - `bwTreatment` or `grayscaleTreatment`.
         * @returns {object|undefined} The treatment.
         * @throws {TypeError} If the treatment is not an object.
         */
        function treatment(name) {
          var value = options[name];
          if (value === undefined) return undefined;
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new TypeError(`TIFF ${name} must be an object`);
          }
          return value;
        }
        /**
         * Validates an optional TIFF treatment color.
         * @param {string} name - Option name for error messages.
         * @param {number[]} [value] - RGB or CMYK components from 0 to 255.
         * @returns {{components: number, values: number[]}} Component count (0 when omitted) and four values.
         * @throws {TypeError} If `value` is not three or four integers from 0 to 255.
         */
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
        var handle = withImagePathOrBytes(
          image,
          "TIFF bytes",
          RegisteredImageFormat.TIFF,
          (path) =>
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
      /**
       * Creates a form XObject from TIFF bytes; alias of `createFormXObjectFromTIFF()`.
       * @param {string|ByteSource} image - Registered TIFF name, or TIFF bytes.
       * @param {TIFFOptions} [options] - Page index, reserved object ID, and
       * black-and-white or grayscale treatment.
       * @returns {FormXObject} The completed form.
       * @throws {TypeError} If an option or treatment color is invalid, the name is not a
       * registered TIFF, or the bytes are unsupported.
       * @throws {RangeError} If `pageIndex` or `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromTIFFBytes: function (image, options) {
        return this.createFormXObjectFromTIFF(image, options);
      },
      /**
       * Creates a TIFF form XObject after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} image - TIFF bytes, Blob, or File.
       * @param {TIFFOptions} [options] - Page index, object ID, and treatments.
       * @returns {Promise<FormXObject>} The completed form.
       * @throws {TypeError} If an option or the bytes are invalid.
       * @throws {RangeError} If `pageIndex` or `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromTIFFAsync: async function (image, options) {
        return this.createFormXObjectFromTIFF(
          await normalizeBytesAsync(image, "TIFF bytes"),
          options,
        );
      },
      /**
       * Alias of `createFormXObjectFromTIFFAsync()`.
       * @async
       * @param {AsyncByteSource} image - TIFF bytes, Blob, or File.
       * @param {TIFFOptions} [options] - Page index, object ID, and treatments.
       * @returns {Promise<FormXObject>} The completed form.
       * @throws {TypeError} If an option or the bytes are invalid.
       * @throws {RangeError} If `pageIndex` or `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
      createFormXObjectFromTIFFBytesAsync: async function (image, options) {
        return this.createFormXObjectFromTIFFAsync(image, options);
      },
      /**
       * Starts a form XObject; draw through `getContentContext()`, then call `endFormXObject()`.
       * @param {number} left - Bounding box left.
       * @param {number} bottom - Bounding box bottom.
       * @param {number} right - Bounding box right.
       * @param {number} top - Bounding box top.
       * @param {number} [objectId] - Reserved object ID.
       * @returns {FormXObject} The open form.
       * @throws {TypeError} If a coordinate is not finite.
       * @throws {RangeError} If `objectId` is invalid.
       * @throws {Error} If the writer ended or the form cannot be created.
       */
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
      /**
       * Finishes a form XObject so it can be placed with `doXObject()`.
       * @param {FormXObject} form - Open form from this writer.
       * @returns {this} The writer.
       * @throws {TypeError} If `form` is not an open form from this writer or the writer ended.
       * @throws {Error} If the form cannot be finished.
       */
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
      /**
       * Creates one form XObject per source PDF page.
       * @param {string|ByteSource} source - Registered PDF name, or PDF bytes.
       * @param {PDFPageBoxType|PDFRectangle} [pageBox=ePDFPageBoxMediaBox] - Box used as
       * the form bounds, or an explicit rectangle.
       * @param {PDFFormOptions} [options={}] - Pages, transformation, and additional object IDs to copy.
       * @returns {number[]} Object IDs of the forms.
       * @throws {TypeError} If `options` is not an object, holds a password, or a rectangle
       * or matrix is not finite.
       * @throws {RangeError} If `pageBox`, the page range, or an object ID is invalid.
       * @throws {Error} If the writer ended, the PDF is not registered, or the forms cannot be created.
       */
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
        var selectedRanges = selectedPageRanges(options, constants);
        /**
         * Validates a fixed-length array of finite numbers.
         * @param {string} name - Option name for error messages.
         * @param {*} value - Candidate array.
         * @param {number} length - Required length.
         * @returns {number[]} `value`.
         * @throws {TypeError} If `value` has another length or a non-finite entry.
         */
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
      /**
       * Creates forms from PDF pages after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} source - PDF bytes, Blob, or File.
       * @param {PDFPageBoxType|PDFRectangle} [pageBox] - Form bounds.
       * @param {PDFFormOptions} [options] - Pages, transformation, and object IDs.
       * @returns {Promise<number[]>} Object IDs of the forms.
       * @throws {TypeError} If the source or an option is invalid.
       * @throws {RangeError} If `pageBox`, the page range, or an object ID is invalid.
       * @throws {Error} If the writer ended or the forms cannot be created.
       */
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
      /**
       * Opens a source PDF for copying pages and objects into this writer.
       * @param {ByteSource} sourceBytes - Source PDF bytes.
       * @returns {DocumentCopyingContext} The copying context; call `end()` when done.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer ended or the source cannot be opened.
       */
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
        /**
         * Ends the copying context, its parsers, and its stored source. Idempotent.
         * @returns {void}
         */
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
        /**
         * Rejects use of an ended copying context.
         * @returns {void}
         * @throws {Error} If the writer or the copying context has ended.
         */
        function requireCopying() {
          requireOpenWriter();
          if (copyingEnded) throw new Error("PDF copying context has ended");
        }
        return {
          /**
           * Returns a reader over the source PDF.
           * @returns {PDFReader} The reader; it ends with the copying context.
           * @throws {Error} If the writer or the copying context has ended.
           */
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
          /**
           * Returns a positioned reader over the source PDF bytes.
           * @returns {PositionedPDFByteReader} The byte reader.
           * @throws {Error} If the writer or the copying context has ended.
           */
          getSourceDocumentStream: function () {
            requireCopying();
            var parser = this.getSourceDocumentParser();
            return parser.getSourceDocumentStream();
          },
          /**
           * Writes a source object into the current output object unchanged.
           * @param {PDFObject} object - Object from this context's source parser.
           * @returns {this} The copying context.
           * @throws {TypeError} If `object` is from another source.
           * @throws {Error} If the context ended or the object cannot be copied.
           */
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
          /**
           * Appends one source page as a new page.
           * @param {number} index - Zero-based source page index.
           * @returns {number} Object ID of the new page.
           * @throws {RangeError} If `index` is not a non-negative integer or the page cannot be appended.
           * @throws {Error} If the writer or the copying context has ended.
           */
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
          /**
           * Appends an inclusive range of source pages.
           * @param {number} start - First zero-based page index.
           * @param {number} end - Last page index, not less than `start`.
           * @returns {this} The copying context.
           * @throws {RangeError} If the range is invalid or a page cannot be appended.
           * @throws {Error} If the writer or the copying context has ended.
           */
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
          /**
           * Merges a source page into the active target page.
           * @param {PDFPage} targetPage - Active page, or a new page that is started.
           * @param {number} index - Zero-based source page index.
           * @returns {this} The copying context.
           * @throws {Error} If the context ended, `targetPage` is not active, or `index` is invalid.
           * @throws {RangeError} If the page cannot be merged.
           */
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
          /**
           * Creates a form XObject from a source page.
           * @param {number} index - Zero-based source page index.
           * @param {PDFPageBoxType|PDFRectangle} [pageBox=ePDFPageBoxMediaBox] - Box used as the form bounds, or a rectangle.
           * @param {PDFMatrix} [transformation] - Form matrix.
           * @returns {number} Object ID of the form.
           * @throws {TypeError} If a rectangle or matrix is not finite.
           * @throws {RangeError} If `index` or `pageBox` is invalid or the form cannot be created.
           * @throws {Error} If the writer or the copying context has ended.
           */
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
          /**
           * Merges a source page into an open form XObject.
           * @param {FormXObject} form - Open form from this writer.
           * @param {number} index - Zero-based source page index.
           * @returns {this} The copying context.
           * @throws {TypeError} If `form` is not open or from this writer, or `index` is invalid.
           * @throws {RangeError} If the page cannot be merged.
           * @throws {Error} If the writer or the copying context has ended.
           */
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
          /**
           * Ends the copying context and releases its source.
           * @returns {this} The copying context.
           * @throws {Error} If the context already ended or cannot be ended.
           */
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
      /**
       * Opens a copying context after reading an asynchronous byte source.
       * @async
       * @param {AsyncByteSource} sourceBytes - PDF bytes, Blob, or File.
       * @returns {Promise<DocumentCopyingContext>} The copying context.
       * @throws {TypeError} If the bytes are unsupported.
       * @throws {Error} If the writer ended or the source cannot be opened.
       */
      createPDFCopyingContextAsync: async function (sourceBytes) {
        return this.createPDFCopyingContext(
          await normalizeBytesAsync(sourceBytes, "PDF input"),
        );
      },
      /**
       * Creates a page with a media box; A4 by default.
       * @param {number} [left=0] - Media box left.
       * @param {number} [bottom=0] - Media box bottom.
       * @param {number} [right=595] - Media box right, greater than `left`.
       * @param {number} [top=842] - Media box top, greater than `bottom`.
       * @returns {PDFPage} The page; start it with `startPageContentContext()`.
       * @throws {RangeError} If the media box is not finite or empty.
       * @throws {Error} If the writer has ended.
       */
      createPage: function (left = 0, bottom = 0, right = 595, top = 842) {
        requireOpenWriter();
        var page = new PDFPage(left, bottom, right, top);
        // Like native, a new page exposes its resources before any content
        // context; activating it starts the page the same way writePage does.
        /**
         * Starts the page so its resources are available before any content.
         * @returns {void}
         * @throws {Error} If another page is active or the page cannot be started.
         */
        page._activate = function () {
          writer.startPageContentContext(page);
        };
        return page;
      },
      /**
       * Starts writing a page, or returns its context when it is already active.
       * @param {PDFPage} page - Page from `createPage()`.
       * @returns {ContentContext} The page content context.
       * @throws {Error} If the writer ended, `page` is not a PDFPage, another page is active,
       * or the page cannot be started.
       */
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
        /**
         * Writes a page box to the active native page.
         * @param {PageBox} name - Box to set.
         * @param {PDFRectangle} box - Rectangle.
         * @returns {void}
         * @throws {Error} If the box cannot be set.
         */
        page._setNativeBox = function (name, box) {
          var indexes = {
            [PageBox.MEDIA]: 0,
            [PageBox.CROP]: 1,
            [PageBox.BLEED]: 2,
            [PageBox.TRIM]: 3,
            [PageBox.ART]: 4,
          };
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
        /**
         * Writes `/Rotate` to the active native page.
         * @param {number} rotation - Multiple of 90 degrees.
         * @returns {void}
         * @throws {Error} If the rotation cannot be set.
         */
        page._setNativeRotation = function (rotation) {
          if (
            !module._muhammara_wasm_recipe_set_page_rotation(recipe, rotation)
          ) {
            throw new Error("Unable to set page rotation");
          }
        };
        /**
         * Returns the resources dictionary of the active page.
         * @returns {ResourcesDictionary} The resources dictionary.
         * @throws {Error} If the writer ended, the page is not active, or the resources cannot be read.
         */
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
      /**
       * Ends the current content stream so objects can be written before the page continues.
       * @param {ContentContext} context - Active page content context.
       * @returns {this} The writer.
       * @throws {Error} If `context` is not active or cannot be paused.
       */
      pausePageContentContext: function (context) {
        requireActiveContext(context);
        if (!module._muhammara_wasm_recipe_pause_page(recipe)) {
          throw new Error("Unable to pause page content context");
        }
        return this;
      },
      /**
       * Writes a page, starting it first when it has no content.
       * @param {PDFPage} page - The active page, or a page when none is active.
       * @returns {this} The writer.
       * @throws {Error} If the writer ended, another page is active, or the page cannot be written.
       */
      writePage: function (page) {
        writePage(page, function () {
          return module._muhammara_wasm_recipe_end_page(recipe);
        });
        return this;
      },
      /**
       * Writes a page and returns its object ID.
       * @param {PDFPage} page - The active page, or a page when none is active.
       * @returns {number} Object ID of the page.
       * @throws {Error} If the writer ended, another page is active, or the page cannot be written.
       */
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
      /**
       * Finishes the PDF, releases the writer, and returns the bytes.
       * @returns {Uint8Array} The PDF bytes.
       * @throws {Error} If the writer ended, a page or objects-context operation is active,
       * the PDF cannot be finished, or it exceeds the output limit.
       */
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
      /**
       * Discards the writer without producing a PDF. Idempotent.
       * @returns {void}
       */
      dispose: function () {
        dispose();
      },
    };

    /**
     * Ends the active page, starting it first when needed, and clears its hooks.
     * @param {PDFPage} page - Page to write.
     * @param {function(): number} endPage - Native end call; returns nonzero on success.
     * @returns {number} The `endPage` result.
     * @throws {Error} If the writer ended, another page is active, or the page cannot be written.
     */
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
