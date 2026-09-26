import createModule from "./dist/muhammara-wasm.js";
import {
  ByteReader,
  ByteReaderWithPosition,
  ByteWriter,
  ByteWriterWithPosition,
  encoder,
  normalizeBytes as normalizeByteSource,
  normalizeBytesAsync as normalizeByteSourceAsync,
  PDFRStreamForBuffer,
  PDFWStreamForBuffer,
} from "./lib/bytes.js";
import { colorValue } from "./lib/color.js";
import { constants } from "./lib/constants.js";
import { createHelpers } from "./lib/helpers.js";
import { createValueTypes } from "./lib/value-types.js";
import { createRawObjectsContext } from "./lib/raw-objects.js";
import { createCopyingHelpers } from "./lib/copying.js";
import { createReaderFactory } from "./lib/reader.js";
import { createWriterFactory, createWriterSupport } from "./lib/writer.js";
import { createModifierFactory } from "./lib/modifier.js";
import { createWriterToModifyFactory } from "./lib/writer-to-modify.js";
import { createRecipeFactory } from "./lib/recipe.js";
import { createRecrypt } from "./lib/recrypt.js";
import {
  DeviceColorSpace,
  ImageFitPolicy,
  PageBox,
  TextEncoding,
  DrawingPathType,
  RecipeTextWrap,
  RecipeHorizontalAlignment,
  RecipeVerticalAlignment,
  RecipeTextAlignment,
  RecipeTriangleTrait,
  RecipeTrianglePosition,
  RecipeArrowAnchor,
  RecipeArrowType,
  RecipeLineCap,
  RecipeLineJoin,
  RecipeTableRowParity,
  RecipePageLayout,
  RecipeStructureFormat,
  RecipeFontStyle,
  ObjectReplacementScope,
  PDFImageType,
  RegisteredImageFormat,
  ETokenSeparator,
  LineCapStyle,
} from "./lib/value-sets.js";

export {
  ByteReader,
  ByteReaderWithPosition,
  ByteWriter,
  ByteWriterWithPosition,
  DeviceColorSpace,
  DrawingPathType,
  ETokenSeparator,
  ImageFitPolicy,
  LineCapStyle,
  ObjectReplacementScope,
  PageBox,
  PDFImageType,
  PDFRStreamForBuffer,
  PDFWStreamForBuffer,
  RecipeArrowAnchor,
  RecipeArrowType,
  RecipeFontStyle,
  RecipeHorizontalAlignment,
  RecipeLineCap,
  RecipeLineJoin,
  RecipePageLayout,
  RecipeStructureFormat,
  RecipeTableRowParity,
  RecipeTextAlignment,
  RecipeTextWrap,
  RecipeTrianglePosition,
  RecipeTriangleTrait,
  RecipeVerticalAlignment,
  TextEncoding,
};

/**
 * Loads the Muhammara WebAssembly module and its byte-first PDF API.
 * @param {MuhammaraWasmOptions} [options] - Emscripten options and byte `limits`.
 * @returns {Promise<object>} The API, module, helpers, and byte guards.
 * @throws {TypeError} If `limits` is not an object or `wasmBinary` is not bytes.
 * @throws {RangeError} If a byte limit is not a positive safe integer.
 */
async function createRuntime(options) {
  var limits = options?.limits || {};
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
    throw new TypeError("Wasm limits must be an object");
  }
  var maxInputBytes = limits.maxInputBytes ?? 256 * 1024 * 1024;
  var maxOutputBytes = limits.maxOutputBytes ?? 256 * 1024 * 1024;
  [maxInputBytes, maxOutputBytes].forEach((value) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError("Wasm byte limits must be positive safe integers");
    }
  });
  var moduleOptions = options ? { ...options } : options;
  if (moduleOptions) delete moduleOptions.limits;
  // Emscripten copies wasmBinary with new Uint8Array(), which converts other
  // views element by element instead of copying their bytes.
  var wasmBinary = moduleOptions?.wasmBinary;
  if (
    wasmBinary !== undefined &&
    !(wasmBinary instanceof Uint8Array || wasmBinary instanceof ArrayBuffer)
  ) {
    throw new TypeError("wasmBinary must be a Uint8Array or ArrayBuffer");
  }
  var module = await createModule(moduleOptions);
  /**
   * Copies byte input and enforces `maxInputBytes`.
   * @param {ByteSource} value - Bytes.
   * @param {string} [label] - Name used in error messages.
   * @returns {Uint8Array} A copy of the bytes.
   * @throws {TypeError} If `value` is not a synchronous byte source.
   * @throws {RangeError} If the bytes exceed `maxInputBytes`.
   */
  function normalizeBytes(value, label) {
    var bytes = normalizeByteSource(value, label);
    if (bytes.length > maxInputBytes) {
      throw new RangeError(`${label || "Byte input"} exceeds maxInputBytes`);
    }
    return bytes;
  }
  /**
   * Reads byte input, including Blob and File, and enforces `maxInputBytes`.
   * @async
   * @param {AsyncByteSource} value - Bytes or a Blob-like object.
   * @param {string} [label] - Name used in error messages.
   * @returns {Promise<Uint8Array>} A copy of the bytes.
   * @throws {TypeError} If `value` is not a supported byte source.
   * @throws {RangeError} If the bytes exceed `maxInputBytes`.
   */
  async function normalizeBytesAsync(value, label) {
    if (
      typeof Blob !== "undefined" &&
      value instanceof Blob &&
      value.size > maxInputBytes
    ) {
      throw new RangeError(`${label || "Byte input"} exceeds maxInputBytes`);
    }
    return normalizeBytes(await normalizeByteSourceAsync(value, label), label);
  }
  /**
   * Rejects PDF output larger than `maxOutputBytes`.
   * @param {number} length - Output size in bytes.
   * @returns {void}
   * @throws {RangeError} If `length` exceeds `maxOutputBytes`.
   */
  function assertOutputSize(length) {
    if (length > maxOutputBytes) {
      throw new RangeError("PDF output exceeds maxOutputBytes");
    }
  }
  var state = { nextPdf: 0, nextAsset: 0 };
  var fonts = new Map();
  var images = new Map();
  var imageTypes = new Map();
  var pdfs = new Map();
  var helpers = createHelpers(module);
  /**
   * Rejects an asset name that cannot be looked up again.
   * @param {*} name - Candidate asset name.
   * @returns {void}
   * @throws {TypeError} If `name` is not a non-empty string.
   */
  function requireAssetName(name) {
    if (typeof name !== "string" || !name) {
      throw new TypeError("Asset names must be non-empty strings");
    }
  }
  /**
   * Registers an asset path and removes the file it replaces.
   * @param {Map<string, string>} registry - Font, image, or PDF registry.
   * @param {string} name - Asset name.
   * @param {string} path - Virtual file system path.
   * @returns {void}
   */
  function replaceAsset(registry, name, path) {
    var previous = registry.get(name);
    registry.set(name, path);
    if (previous && previous !== path) helpers.removeFile(previous);
  }
  /**
   * Removes a registered asset and its file.
   * @param {Map<string, string>} registry - Font, image, or PDF registry.
   * @param {string} name - Asset name.
   * @returns {boolean} Whether an asset was removed.
   */
  function unregisterAsset(registry, name) {
    var path = registry.get(name);
    if (!path) return false;
    registry.delete(name);
    helpers.removeFile(path);
    return true;
  }
  var { PDFTextString, PDFDate, PDFPage, normalizePDFDate, textStringValue } =
    createValueTypes({
      module,
      withString: helpers.withString,
      withBytes: helpers.withBytes,
    });
  var rawObjectsContext = createRawObjectsContext({
    module,
    constants,
    normalizeBytes,
    withString: helpers.withString,
    withBytes: helpers.withBytes,
  });
  var { copyingObjectOperations } = createCopyingHelpers({ module });
  var createReader = createReaderFactory({
    module,
    constants,
    normalizeBytes,
    withString: helpers.withString,
    textStringValue,
    /**
     * Reserves a unique virtual path for reader input.
     * @returns {string} The path.
     */
    allocatePdfPath: () => `/pdfs/${state.nextPdf++}.pdf`,
    removeFile: helpers.removeFile,
  });
  var dependencies = {
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
    ...helpers,
    assertOutputSize,
  };
  var support = createWriterSupport(dependencies);
  var createWriter = createWriterFactory({ ...dependencies, ...support });
  var createModifier = createModifierFactory(dependencies);
  var createWriterToModify = createWriterToModifyFactory({
    ...dependencies,
    ...support,
  });
  var recrypt = createRecrypt(dependencies);

  var api = {
    ...constants,
    PDFPage,
    PDFDate,
    PDFTextString,
    createWriter,
    recrypt,
    ByteReader,
    ByteReaderWithPosition,
    ByteWriter,
    ByteWriterWithPosition,
    PDFRStreamForBuffer,
    PDFWStreamForBuffer,
    /**
     * Registers font bytes for `getFontForBytes()`; a name registered again is replaced.
     * @param {string} name - Non-empty font name.
     * @param {ByteSource} bytes - Font bytes.
     * @returns {string} The virtual path of the font.
     * @throws {TypeError} If `name` is empty or the bytes are unsupported.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerFont: function (name, bytes) {
      requireAssetName(name);
      bytes = normalizeBytes(bytes, "Font bytes");
      var path = `/fonts/${state.nextAsset++}.font`;
      module.FS.mkdirTree("/fonts");
      module.FS.writeFile(path, bytes);
      replaceAsset(fonts, name, path);
      return path;
    },
    /**
     * Registers font bytes after reading an asynchronous byte source.
     * @async
     * @param {string} name - Non-empty font name.
     * @param {AsyncByteSource} bytes - Font bytes, Blob, or File.
     * @returns {Promise<string>} The virtual path of the font.
     * @throws {TypeError} If `name` is empty or the bytes are unsupported.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerFontAsync: async function (name, bytes) {
      return this.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
      );
    },
    /**
     * Registers image bytes for the image and form XObject methods.
     * @param {string} name - Non-empty image name.
     * @param {ByteSource} bytes - Image bytes.
     * @param {string} extension - `jpg`, `jpeg`, `png`, `tif`, or `tiff`, in any case.
     * @returns {void}
     * @throws {TypeError} If `name` is empty, the bytes are unsupported, or the extension is unknown.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerImage: function (name, bytes, extension) {
      requireAssetName(name);
      bytes = normalizeBytes(bytes, "Image bytes");
      if (!/^(jpe?g|png|tiff?)$/i.test(extension || "")) {
        throw new TypeError("Image extensions must be jpeg, png, or tiff");
      }
      var path = `/images/${state.nextAsset++}.${extension.toLowerCase()}`;
      module.FS.mkdirTree("/images");
      module.FS.writeFile(path, bytes);
      replaceAsset(images, name, path);
      imageTypes.set(
        name,
        /jpe?g/i.test(extension)
          ? RegisteredImageFormat.JPEG
          : /png/i.test(extension)
            ? RegisteredImageFormat.PNG
            : RegisteredImageFormat.TIFF,
      );
    },
    /**
     * Registers an image after reading an asynchronous byte source.
     * @async
     * @param {string} name - Non-empty image name.
     * @param {AsyncByteSource} bytes - Image bytes, Blob, or File.
     * @param {string} extension - `jpg`, `jpeg`, `png`, `tif`, or `tiff`.
     * @returns {Promise<void>} Resolves after the image is registered.
     * @throws {TypeError} If `name` is empty, the bytes are unsupported, or the extension is unknown.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerImageAsync: async function (name, bytes, extension) {
      return this.registerImage(
        name,
        await normalizeBytesAsync(bytes, "Image bytes"),
        extension,
      );
    },
    /**
     * Registers PDF bytes for methods that accept a registered PDF name.
     * @param {string} name - Non-empty PDF name.
     * @param {ByteSource} bytes - PDF bytes.
     * @returns {void}
     * @throws {TypeError} If `name` is empty or the bytes are unsupported.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerPdf: function (name, bytes) {
      requireAssetName(name);
      bytes = normalizeBytes(bytes, "PDF bytes");
      var path = `/pdfs/${state.nextPdf++}.pdf`;
      module.FS.mkdirTree("/pdfs");
      module.FS.writeFile(path, bytes);
      replaceAsset(pdfs, name, path);
    },
    /**
     * Registers a PDF after reading an asynchronous byte source.
     * @async
     * @param {string} name - Non-empty PDF name.
     * @param {AsyncByteSource} bytes - PDF bytes, Blob, or File.
     * @returns {Promise<void>} Resolves after the PDF is registered.
     * @throws {TypeError} If `name` is empty or the bytes are unsupported.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     */
    registerPdfAsync: async function (name, bytes) {
      return this.registerPdf(
        name,
        await normalizeBytesAsync(bytes, "PDF bytes"),
      );
    },
    /**
     * Removes a registered font.
     * @param {string} name - Font name.
     * @returns {boolean} Whether a font was removed.
     */
    unregisterFont: function (name) {
      return unregisterAsset(fonts, name);
    },
    /**
     * Removes a registered image.
     * @param {string} name - Image name.
     * @returns {boolean} Whether an image was removed.
     */
    unregisterImage: function (name) {
      imageTypes.delete(name);
      return unregisterAsset(images, name);
    },
    unregisterPdf: function (name) {
      return unregisterAsset(pdfs, name);
    },
    disposeAssets: function () {
      new Set([
        ...fonts.values(),
        ...images.values(),
        ...pdfs.values(),
      ]).forEach(helpers.removeFile);
      fonts.clear();
      images.clear();
      imageTypes.clear();
      pdfs.clear();
    },
    createBlankPdf: function (width, height) {
      if (![width, height].every(Number.isFinite)) {
        throw new TypeError(
          "createBlankPdf requires a finite width and height",
        );
      }
      if (width <= 0 || height <= 0) {
        throw new RangeError(
          "createBlankPdf requires a positive width and height",
        );
      }
      var lengthPointer = module._malloc(4);
      try {
        var pdfPointer = module._muhammara_wasm_create_blank_pdf(
          width,
          height,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!pdfPointer || !length) throw new Error("Unable to create PDF");
        try {
          assertOutputSize(length);
          return module.HEAPU8.slice(pdfPointer, pdfPointer + length);
        } finally {
          module._muhammara_wasm_free(pdfPointer);
        }
      } finally {
        module._free(lengthPointer);
      }
    },
    createReader,
    createReaderAsync: async function (bytes) {
      return this.createReader(await normalizeBytesAsync(bytes, "PDF input"));
    },
    createModifier,
    createModifierAsync: async function (bytes) {
      return this.createModifier(await normalizeBytesAsync(bytes, "PDF input"));
    },
    createWriterToModify,
    createWriterToModifyAsync: async function (bytes, writerOptions) {
      return this.createWriterToModify(
        await normalizeBytesAsync(bytes, "PDF input"),
        writerOptions,
      );
    },
  };
  return {
    api,
    module,
    helpers,
    normalizeBytes,
    normalizeBytesAsync,
    assertOutputSize,
  };
}

/**
 * Loads the browser-safe Muhammara API for reading, creating, modifying, and
 * composing PDFs entirely from bytes.
 *
 * @param {object} [options] Emscripten module options and optional byte limits.
 * @param {object} [options.limits] Limits for individual inputs and outputs.
 * @param {number} [options.limits.maxInputBytes=268435456] Maximum input size.
 * @param {number} [options.limits.maxOutputBytes=268435456] Maximum output size.
 * @param {Uint8Array|ArrayBuffer} [options.wasmBinary] Bytes of
 * `muhammara-wasm.wasm`; when supplied the binary is not fetched or read.
 * @param {Function} [options.locateFile] Maps the requested file name to the
 * URL or path to load it from.
 * @returns {Promise<object>} The initialized Muhammara API.
 */
export async function createMuhammaraWasm(options) {
  return (await createRuntime(options)).api;
}

/**
 * Loads the browser-native Recipe constructor. Inputs and outputs are bytes,
 * not Node paths or streams. Loads bundled Roboto Regular for zero-setup text
 * unless a custom default font or defaultFont: false is supplied.
 *
 * @param {object} [options] Emscripten module options and optional byte limits.
 * @param {Uint8Array|ArrayBuffer|Blob|false} [options.defaultFont] Custom default
 * font bytes (also accepts File), or false to require explicit registered fonts.
 * Omitting this option dynamically imports bundled Roboto Regular.
 * @returns {Promise<Function>} The initialized Recipe constructor.
 */
export async function createRecipe(options) {
  var { defaultFont: fontSource, ...moduleOptions } = options || {};
  var {
    api: muhammara,
    module,
    helpers,
    normalizeBytes,
    normalizeBytesAsync,
    assertOutputSize,
  } = await createRuntime(moduleOptions);
  var defaultFont;
  if (fontSource === undefined) {
    var { defaultFontBytes } = await import("./fonts/Roboto-Regular.js");
    defaultFont = { name: "Roboto", loadBytes: defaultFontBytes };
  } else if (fontSource !== false) {
    var fontBytes = await normalizeBytesAsync(fontSource, "Default font bytes");
    defaultFont = { name: "default", loadBytes: () => fontBytes };
  }
  var { removeFile } = helpers;
  return createRecipeFactory({
    defaultFont,
    module,
    encoder,
    colorValue,
    normalizeBytes,
    normalizeBytesAsync,
    createReader: muhammara.createReader,
    createWriterToModify: muhammara.createWriterToModify,
    recrypt: muhammara.recrypt,
    pageBoxes: {
      media: muhammara.ePDFPageBoxMediaBox,
      crop: muhammara.ePDFPageBoxCropBox,
      bleed: muhammara.ePDFPageBoxBleedBox,
      trim: muhammara.ePDFPageBoxTrimBox,
      art: muhammara.ePDFPageBoxArtBox,
    },
    registerWriterFont: muhammara.registerFont.bind(muhammara),
    unregisterWriterFont: muhammara.unregisterFont.bind(muhammara),
    removeFile,
    withString: helpers.withString,
    withDoubles: helpers.withDoubles,
    assertOutputSize,
  });
}
