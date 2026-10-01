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
  ImageFit,
  PageBox,
  DrawingPathType,
  ObjectReplacementScope,
  PDFImageType,
  RegisteredImageFormat,
  ETokenSeparator,
  LineCapStyle,
  EEncoding,
} from "./lib/value-sets.js";

export {
  ByteReader,
  ByteReaderWithPosition,
  ByteWriter,
  ByteWriterWithPosition,
  DeviceColorSpace,
  DrawingPathType,
  EEncoding,
  ETokenSeparator,
  ImageFit,
  LineCapStyle,
  ObjectReplacementScope,
  PageBox,
  PDFImageType,
  PDFRStreamForBuffer,
  PDFWStreamForBuffer,
};

var wasmFileName = "muhammara-wasm.wasm";
var licenseSectionName = "license";
var licensesFileName = "@muhammara/wasm/THIRD_PARTY_LICENSES.md";
// Emscripten does not keep the compiled WebAssembly.Module, so the runtime
// compiles it and hands Emscripten the instance; thirdPartyLicenses() reads
// the module's "license" section from here.
var loadedWasm = { initialized: false, module: undefined };

/**
 * Tells whether this is Node, using Emscripten's own test.
 * @returns {boolean} True under Node (but not an Electron renderer).
 */
function isNode() {
  return (
    typeof process == "object" &&
    typeof process.versions == "object" &&
    typeof process.versions.node == "string" &&
    process.type != "renderer"
  );
}

/**
 * Returns a Node built-in module without an import statement, so browser
 * bundlers never see a Node dependency.
 * @param {string} name - Built-in module name.
 * @returns {object|undefined} The module, or undefined before Node 20.16/22.3.
 */
function nodeBuiltin(name) {
  return typeof process.getBuiltinModule == "function"
    ? process.getBuiltinModule(name)
    : undefined;
}

/**
 * Compiles `muhammara-wasm.wasm` the way Emscripten would load it: from
 * `wasmBinary` when given, otherwise from `locateFile`'s result or the file
 * next to the package, read from disk under Node and fetched with
 * `credentials: "same-origin"` and streaming compilation elsewhere.
 * @param {MuhammaraWasmOptions} options - Emscripten module options.
 * @returns {Promise<WebAssembly.Module|undefined>} The compiled module, or
 * undefined when this Node version cannot read files without an import, in
 * which case Emscripten loads the binary itself.
 * @throws {Error} If the binary cannot be loaded or compiled.
 */
async function compileWasm(options) {
  if (options.wasmBinary !== undefined) {
    return WebAssembly.compile(options.wasmBinary);
  }
  var node = isNode();
  var fs = node ? nodeBuiltin("fs") : undefined;
  if (node && !fs) return undefined;
  var location = new URL(`./dist/${wasmFileName}`, import.meta.url).href;
  if (typeof options.locateFile === "function") {
    var directory = new URL("./dist/", import.meta.url);
    var prefix =
      node && directory.protocol === "file:"
        ? nodeBuiltin("url").fileURLToPath(directory)
        : directory.href;
    location = options.locateFile(wasmFileName, prefix);
  }
  if (node) {
    return WebAssembly.compile(
      await fs.promises.readFile(
        String(location).startsWith("file:") ? new URL(location) : location,
      ),
    );
  }
  var request = () => fetch(location, { credentials: "same-origin" });
  if (
    typeof WebAssembly.compileStreaming == "function" &&
    !String(location).startsWith("data:")
  ) {
    try {
      return await WebAssembly.compileStreaming(request());
    } catch {
      // A wrong MIME type or a failed stream falls back to an ArrayBuffer,
      // as in Emscripten.
    }
  }
  var response = await request();
  if (!response.ok) {
    throw new Error(`Failed to load ${location}: HTTP ${response.status}`);
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

/**
 * Instantiates the Emscripten module and keeps its compiled WebAssembly.Module.
 * @param {MuhammaraWasmOptions} moduleOptions - Emscripten module options.
 * @returns {Promise<object>} The Emscripten module.
 */
async function instantiate(moduleOptions) {
  var options = { ...moduleOptions };
  var wasmModule;
  var module;
  var customHook = options.instantiateWasm;
  if (typeof customHook === "function") {
    // A caller's own hook does the loading; keep the module if it passes one.
    options.instantiateWasm = (imports, receiveInstance) =>
      customHook(imports, (instance, module) => {
        if (module instanceof WebAssembly.Module) wasmModule = module;
        return receiveInstance(instance, module);
      });
    module = await createModule(options);
  } else if (!(wasmModule = await compileWasm(options))) {
    module = await createModule(options);
  } else {
    var failed;
    var failure = new Promise((resolve, reject) => {
      failed = reject;
    });
    options.instantiateWasm = (imports, receiveInstance) => {
      WebAssembly.instantiate(wasmModule, imports).then(
        (instance) => receiveInstance(instance, wasmModule),
        failed,
      );
      return {};
    };
    module = await Promise.race([createModule(options), failure]);
  }
  loadedWasm = { initialized: true, module: wasmModule };
  return module;
}

/**
 * Returns the third-party license notices embedded in the loaded
 * `muhammara-wasm.wasm` as its `license` custom section. Nothing is fetched:
 * the text is read from the module that `createMuhammaraWasm()` or
 * `createRecipe()` most recently loaded.
 * @returns {string} The notices, Markdown, identical to
 * `@muhammara/wasm/THIRD_PARTY_LICENSES.md`.
 * @throws {Error} If no module has been initialized yet, or the loaded module
 * has no `license` section (for example after `wasm-strip`).
 */
export function thirdPartyLicenses() {
  if (!loadedWasm.initialized) {
    throw new Error(
      `thirdPartyLicenses() reads the loaded WebAssembly module; await createMuhammaraWasm() or createRecipe() first, or read ${licensesFileName}`,
    );
  }
  var sections = loadedWasm.module
    ? WebAssembly.Module.customSections(loadedWasm.module, licenseSectionName)
    : [];
  if (sections.length === 0) {
    throw new Error(
      loadedWasm.module
        ? `The loaded ${wasmFileName} has no "${licenseSectionName}" section; a tool such as wasm-strip may have removed it. The same notices ship as ${licensesFileName}`
        : `The WebAssembly.Module was not available to read its "${licenseSectionName}" section: a custom instantiateWasm hook did not pass it to its callback, or this Node.js version lacks process.getBuiltinModule(). The same notices ship as ${licensesFileName}`,
    );
  }
  return new TextDecoder().decode(sections[0]);
}

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
  var moduleOptions = { ...options };
  delete moduleOptions.limits;
  // Emscripten copies wasmBinary with new Uint8Array(), which converts other
  // views element by element instead of copying their bytes.
  var wasmBinary = moduleOptions.wasmBinary;
  if (
    wasmBinary !== undefined &&
    !(wasmBinary instanceof Uint8Array || wasmBinary instanceof ArrayBuffer)
  ) {
    throw new TypeError("wasmBinary must be a Uint8Array or ArrayBuffer");
  }
  var module = await instantiate(moduleOptions);
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
  /**
   * Reads native's `createReader` password option.
   * @param {PDFReaderOptions} options - Reader options.
   * @returns {string|undefined} The password, when given.
   * @throws {TypeError} If `options` is not an object or `password` is not a string.
   */
  function readerPassword(options) {
    if (!options || typeof options !== "object" || Array.isArray(options))
      throw new TypeError("createReader options must be an object");
    if (options.password !== undefined && typeof options.password !== "string")
      throw new TypeError("createReader password must be a string");
    return options.password;
  }

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
    /**
     * Removes a registered PDF.
     * @param {string} name - PDF name.
     * @returns {boolean} Whether a PDF was removed.
     */
    unregisterPdf: function (name) {
      return unregisterAsset(pdfs, name);
    },
    /**
     * Removes every registered font, image, and PDF.
     * @returns {void}
     */
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
    /**
     * Creates a one-page PDF with an empty page.
     * @param {number} width - Page width in points.
     * @param {number} height - Page height in points.
     * @returns {Uint8Array} The PDF bytes.
     * @throws {TypeError} If a size is not a finite number.
     * @throws {RangeError} If a size is not positive or the output exceeds `maxOutputBytes`.
     * @throws {Error} If the PDF cannot be created.
     */
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
    /**
     * Opens a reader for PDF bytes.
     * @param {ByteSource} bytes - PDF bytes.
     * @param {PDFReaderOptions} [options] - `password` opens an encrypted PDF,
     *   as in native `createReader`.
     * @returns {PDFReader} The reader; call `end()` to release it.
     * @throws {TypeError} If the bytes are unsupported, `options` is not an
     *   object, or `password` is not a string.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     * @throws {Error} If the PDF cannot be parsed.
     */
    createReader: function (bytes, options = {}) {
      return createReader(
        bytes,
        undefined,
        undefined,
        undefined,
        true,
        readerPassword(options),
      );
    },
    /**
     * Opens a reader after reading an asynchronous byte source.
     * @async
     * @param {AsyncByteSource} bytes - PDF bytes, Blob, or File.
     * @param {PDFReaderOptions} [options] - `password` opens an encrypted PDF.
     * @returns {Promise<PDFReader>} The reader.
     * @throws {TypeError} If the bytes are unsupported, or `options` is invalid.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     * @throws {Error} If the PDF cannot be parsed.
     */
    createReaderAsync: async function (bytes, options = {}) {
      readerPassword(options);
      return this.createReader(
        await normalizeBytesAsync(bytes, "PDF input"),
        options,
      );
    },
    createModifier,
    /**
     * Opens a high-level modifier after reading an asynchronous byte source.
     * @async
     * @param {AsyncByteSource} bytes - PDF bytes, Blob, or File.
     * @returns {Promise<CompactModifier>} The modifier.
     * @throws {TypeError} If the bytes are unsupported.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     * @throws {Error} If the PDF cannot be opened.
     */
    createModifierAsync: async function (bytes) {
      return this.createModifier(await normalizeBytesAsync(bytes, "PDF input"));
    },
    createWriterToModify,
    /**
     * Opens a low-level modifier after reading an asynchronous byte source.
     * @async
     * @param {AsyncByteSource} bytes - PDF bytes, Blob, or File.
     * @param {WriterOptions} [writerOptions] - PDF version and stream compression.
     * @returns {Promise<PDFModifier>} The modifier.
     * @throws {TypeError} If the bytes or options are invalid.
     * @throws {RangeError} If the version is unsupported or the bytes exceed `maxInputBytes`.
     * @throws {Error} If the PDF cannot be opened.
     */
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
    rawObjectsContext,
    resourcesDictionary: support.resourcesDictionary,
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
    rawObjectsContext,
    resourcesDictionary,
  } = await createRuntime(moduleOptions);
  var defaultFont;
  if (fontSource === undefined) {
    var { defaultFontBytes } = await import("./fonts/Roboto-Regular.js");
    defaultFont = { name: "Roboto", loadBytes: defaultFontBytes };
  } else if (fontSource !== false) {
    var fontBytes = await normalizeBytesAsync(fontSource, "Default font bytes");
    defaultFont = {
      name: "default",
      /**
       * Returns the custom default font bytes.
       * @returns {Uint8Array} The font bytes.
       */
      loadBytes: () => fontBytes,
    };
  }
  var { removeFile } = helpers;
  return createRecipeFactory({
    defaultFont,
    module,
    encoder,
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
    rawObjectsContext,
    resourcesDictionary,
    assertOutputSize,
  });
}
