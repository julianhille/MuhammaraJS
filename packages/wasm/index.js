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

export {
  ByteReader,
  ByteReaderWithPosition,
  ByteWriter,
  ByteWriterWithPosition,
  PDFRStreamForBuffer,
  PDFWStreamForBuffer,
};

/** Loads the Muhammara WebAssembly module and its byte-first PDF API. */
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
  var module = await createModule(moduleOptions);
  function normalizeBytes(value, label) {
    var bytes = normalizeByteSource(value, label);
    if (bytes.length > maxInputBytes) {
      throw new RangeError(`${label || "Byte input"} exceeds maxInputBytes`);
    }
    return bytes;
  }
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
  function replaceAsset(registry, name, path) {
    var previous = registry.get(name);
    registry.set(name, path);
    if (previous && previous !== path) helpers.removeFile(previous);
  }
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
  var { copyingObjectOperations } = createCopyingHelpers({
    module,
    constants,
    withString: helpers.withString,
  });
  var createReader = createReaderFactory({
    module,
    constants,
    normalizeBytes,
    withString: helpers.withString,
    textStringValue,
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

  var api = {
    ...constants,
    PDFPage,
    PDFDate,
    PDFTextString,
    createWriter,
    ByteReader,
    ByteReaderWithPosition,
    ByteWriter,
    ByteWriterWithPosition,
    PDFRStreamForBuffer,
    PDFWStreamForBuffer,
    registerFont: function (name, bytes) {
      bytes = normalizeBytes(bytes, "Font bytes");
      var path = `/fonts/${state.nextAsset++}.font`;
      module.FS.mkdirTree("/fonts");
      module.FS.writeFile(path, bytes);
      replaceAsset(fonts, name, path);
      return path;
    },
    registerFontAsync: async function (name, bytes) {
      return this.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
      );
    },
    registerImage: function (name, bytes, extension) {
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
          ? "jpeg"
          : /png/i.test(extension)
            ? "png"
            : "tiff",
      );
    },
    registerImageAsync: async function (name, bytes, extension) {
      return this.registerImage(
        name,
        await normalizeBytesAsync(bytes, "Image bytes"),
        extension,
      );
    },
    registerPdf: function (name, bytes) {
      bytes = normalizeBytes(bytes, "PDF bytes");
      var path = `/pdfs/${state.nextPdf++}.pdf`;
      module.FS.mkdirTree("/pdfs");
      module.FS.writeFile(path, bytes);
      replaceAsset(pdfs, name, path);
    },
    registerPdfAsync: async function (name, bytes) {
      return this.registerPdf(
        name,
        await normalizeBytesAsync(bytes, "PDF bytes"),
      );
    },
    unregisterFont: function (name) {
      return unregisterAsset(fonts, name);
    },
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
 * @returns {Promise<object>} The initialized Muhammara API.
 */
export async function createMuhammaraWasm(options) {
  return (await createRuntime(options)).api;
}

/**
 * Loads the browser-native Recipe constructor. Inputs and outputs are bytes,
 * not Node paths or streams; callers register fonts and other assets as bytes.
 *
 * @param {object} [options] Emscripten module options and optional byte limits.
 * @returns {Promise<Function>} The initialized Recipe constructor.
 */
export async function createRecipe(options) {
  var {
    api: muhammara,
    module,
    helpers,
    normalizeBytes,
    normalizeBytesAsync,
    assertOutputSize,
  } = await createRuntime(options);
  function removeFile(path) {
    if (!path) return;
    try {
      module.FS.unlink(path);
    } catch (error) {
      if (module.FS.analyzePath(path).exists) throw error;
    }
  }
  return createRecipeFactory({
    module,
    encoder,
    colorValue,
    normalizeBytes,
    normalizeBytesAsync,
    createReader: muhammara.createReader,
    createWriterToModify: muhammara.createWriterToModify,
    registerWriterFont: muhammara.registerFont.bind(muhammara),
    unregisterWriterFont: muhammara.unregisterFont.bind(muhammara),
    removeFile,
    withString: helpers.withString,
    withDoubles: helpers.withDoubles,
    assertOutputSize,
  });
}
