// The Wasm Recipe: the shared Recipe on the byte-first Wasm low-level API,
// with registered assets (fonts, images, PDFs) in place of paths.
import { createRecipe as createSharedRecipe } from "@muhammara/shared/recipe/Recipe.js";
import { FontStyle, StructureFormat } from "@muhammara/shared/value-sets.js";
import { createInspectPdf } from "./recipe/inspection.js";
import { permission } from "./recipe/security.js";
import { thirdPartyLicenses } from "./recipe/licenses.js";
import { unknownAsset } from "./recipe/unknown-asset.js";
import { htmlToTextObjects } from "./recipe/html-text-runs.js";

// Keys of the per-style font files stored for each family, as in the shared
// Recipe's font registry.
var FontSlot = Object.freeze({
  [FontStyle.REGULAR]: "r",
  [FontStyle.BOLD]: "b",
  [FontStyle.ITALIC]: "i",
  [FontStyle.BOLD_ITALIC]: "bi",
  r: "r",
  b: "b",
  i: "i",
  bi: "bi",
});

/**
 * Creates the Wasm Recipe class on one Wasm runtime.
 * @param {object} runtime - The runtime: its low-level `api`, the Emscripten
 *   `module`, the low-level asset maps, byte helpers and the default font.
 * @returns {Function} The Recipe class.
 */
export function createRecipeFactory({
  api,
  module,
  assets,
  normalizeBytes,
  normalizeBytesAsync,
  withString,
  defaultFont,
}) {
  // Family (lower-cased) -> style slot -> low-level font name. Every Recipe
  // of this class uses this one object as its font registry, so a font
  // registered later is available to existing Recipes too.
  var fonts = {};
  var state = { nextFont: 0, nextPdf: 0 };

  /**
   * Registers font bytes in the low-level registry under a fresh name.
   * @param {Uint8Array} bytes - Font bytes.
   * @returns {string} The low-level font name.
   */
  function storeFont(bytes) {
    var name = `recipe-font-${state.nextFont++}`;
    api.registerFont(name, normalizeBytes(bytes, "Font bytes"));
    return name;
  }

  /**
   * Records a font under a family and style for every future Recipe.
   * @param {string} family - The family name.
   * @param {string} ref - The low-level font name.
   * @param {string} [type] - The style.
   * @returns {void}
   */
  function recordFont(family, ref, type) {
    var key = family.toLowerCase();
    var slots = fonts[key] || {};
    var slot = FontSlot[type] || FontSlot.r;
    if (slots[slot]) api.unregisterFont(slots[slot]);
    slots[slot] = ref;
    fonts[key] = slots;
  }

  /**
   * Registers the default font on first use.
   * @returns {void}
   */
  function ensureDefaultFont() {
    if (!defaultFont || fonts[defaultFont.name.toLowerCase()]) return;
    recordFont(defaultFont.name, storeFont(defaultFont.loadBytes()));
  }

  /**
   * Reads the bytes of a registered image or PDF, or normalizes given bytes.
   * @param {string|Uint8Array} ref - A registered name or bytes.
   * @param {string} [user] - What reads them, for the error message.
   * @returns {Uint8Array} The bytes.
   * @throws {TypeError} If `ref` is neither bytes nor a registered name.
   */
  function assetBytes(ref, user) {
    if (typeof ref !== "string") {
      // Bytes are normalized; anything else is left for the caller's check.
      var isBytes = ref instanceof ArrayBuffer || ArrayBuffer.isView(ref);
      return isBytes ? normalizeBytes(ref, "Asset bytes") : ref;
    }
    var path = assets.images.get(ref) || assets.pdfs.get(ref);
    if (!path) {
      throw new TypeError(
        `${user ? `${user} reads` : "Wasm reads"} registered assets or bytes, not paths: ${ref}`,
      );
    }
    return module.FS.readFile(path);
  }

  var platform = {
    muhammara: Object.assign(Object.create(api), {
      /**
       * Opens a page of the modified PDF for drawing, as native's
       * PDFPageModifier does.
       * @param {object} writer - The writer to modify.
       * @param {number} pageIndex - The zero-based page.
       * @param {boolean} [ensureContentEncapsulation] - Wrap existing content in q/Q.
       * @returns {object} The page modifier.
       */
      PDFPageModifier: function (
        writer,
        pageIndex,
        ensureContentEncapsulation,
      ) {
        return writer.createPageModifier(pageIndex, ensureContentEncapsulation);
      },
    }),
    // What image() takes, for its error messages.
    imageReference: "a registered name",
    // Wasm's behaviour where the ends differed; kept until a major release
    // unifies them, see DIFFERENCES.md.
    fontFallsBackToDefault: false,
    textWithoutPageThrows: true,
    rejectsImageIndex: true,
    unknownPageInfoIsNull: true,
    pageInfoIsRecord: true,
    sourceName: "PDF bytes",
    noPageError: () => new Error("A page is required for coordinates"),
    get defaultFontFamily() {
      return defaultFont?.name.toLowerCase();
    },

    /**
     * Reads `new Recipe(options)` or `new Recipe(bytes, options)`.
     * @param {Array} args - The constructor arguments.
     * @returns {object} The source bytes (null for a new PDF) and the options.
     */
    openArguments([source, options]) {
      var hasSource =
        source instanceof Uint8Array ||
        source instanceof ArrayBuffer ||
        ArrayBuffer.isView(source) ||
        (typeof Blob !== "undefined" && source instanceof Blob);
      if (hasSource) options = options || {};
      else options = source === undefined ? {} : source;
      if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Recipe options must be an object");
      }
      return {
        source: hasSource ? normalizeBytes(source, "PDF bytes") : null,
        options,
      };
    },

    deliver: (recipe, bytes) => bytes,
    // endPDF(callback) returns the bytes, as typed since 1.0.
    endPDFReturnsResult: true,

    readerSource(source) {
      return typeof source === "string" ? assetBytes(source) : source;
    },

    newWriter(options) {
      var writer = api.createWriter(options);
      return { writer, finish: () => writer.end() };
    },

    modifyWriter(bytes, options) {
      var writer = api.createWriterToModify(bytes, options);
      return { writer, finish: () => writer.end() };
    },

    recrypt: (bytes, options) => api.recrypt(bytes, options),

    readBytes: assetBytes,

    assetVersion(ref) {
      return assets.images.get(ref) || assets.pdfs.get(ref) || null;
    },

    loadFonts(recipe) {
      // fontSrcPath names folders, which Wasm cannot read; it is ignored, as
      // it always was.
      ensureDefaultFont();
      recipe.fonts = fonts;
    },

    fontFiles: () => [],

    fontSource: (name, bytes) => storeFont(bytes),

    fontExists: (ref) => assets.fonts.has(ref),

    getFont: (writer, ref) => writer.getFontForBytes(ref),
  };

  var Recipe = createSharedRecipe(platform, { StructureFormat });
  var inspectPdf = createInspectPdf({ module, withString, pdfs: assets.pdfs });

  Object.assign(Recipe, {
    /**
     * Registers font bytes under a name and style for future Recipe instances.
     * Registering the same name and style replaces the prior font.
     *
     * @name registerFont
     * @function
     * @memberof Recipe
     * @param {string} name Non-empty font family name used by Recipe text.
     * @param {ByteSource} bytes Font bytes.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {void}
     * @throws {TypeError} If the name is empty or the bytes are unsupported.
     */
    registerFont(name, bytes, type) {
      if (typeof name !== "string" || !name) {
        throw new TypeError("Font names must be non-empty strings");
      }
      recordFont(name, storeFont(bytes), type);
    },
    /**
     * Asynchronously registers a font for future Recipe instances.
     * @name registerFontAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name Non-empty font family name used by Recipe text.
     * @param {AsyncByteSource} bytes Font bytes, Blob, or File.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {Promise<void>} Resolves after the font is registered.
     * @throws {TypeError} If the name is empty or the bytes are unsupported.
     */
    async registerFontAsync(name, bytes, type) {
      return Recipe.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
        type,
      );
    },
    /**
     * Registers image bytes for `Recipe#image`.
     * @name registerImage
     * @function
     * @memberof Recipe
     * @param {string} name Image name used by `Recipe#image`.
     * @param {ByteSource} bytes Image bytes.
     * @param {string} extension Image filename extension.
     * @returns {void}
     * @throws {TypeError} If the bytes are unsupported or the extension is not
     * a supported JPEG, PNG, or TIFF extension.
     */
    registerImage: (name, bytes, extension) =>
      api.registerImage(name, bytes, extension),
    /**
     * Asynchronously registers an image for `Recipe#image`.
     * @name registerImageAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name Image name.
     * @param {AsyncByteSource} bytes Image bytes, Blob, or File.
     * @param {string} extension Image filename extension.
     * @returns {Promise<void>} Resolves after the image is registered.
     */
    registerImageAsync: (name, bytes, extension) =>
      api.registerImageAsync(name, bytes, extension),
    /**
     * Registers PDF bytes for appendPage, insertPage, overlay and image.
     * @name registerPdf
     * @function
     * @memberof Recipe
     * @param {string} name PDF name.
     * @param {ByteSource} bytes PDF bytes.
     * @returns {void}
     */
    registerPdf: (name, bytes) => api.registerPdf(name, bytes),
    /**
     * Asynchronously registers PDF bytes.
     * @name registerPdfAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name PDF name.
     * @param {AsyncByteSource} bytes PDF bytes, Blob, or File.
     * @returns {Promise<void>} Resolves after the PDF is registered.
     */
    registerPdfAsync: (name, bytes) => api.registerPdfAsync(name, bytes),
    /**
     * Removes a registered font style.
     * @name unregisterFont
     * @function
     * @memberof Recipe
     * @param {string} name Font family name.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {boolean} Whether a font was removed.
     */
    unregisterFont(name, type = FontStyle.REGULAR) {
      var key = String(name).toLowerCase();
      var slots = fonts[key];
      var slot = FontSlot[type] || FontSlot.r;
      if (!slots || !slots[slot]) return false;
      api.unregisterFont(slots[slot]);
      delete slots[slot];
      if (!Object.keys(slots).length) delete fonts[key];
      return true;
    },
    /**
     * Removes a registered image.
     * @name unregisterImage
     * @function
     * @memberof Recipe
     * @param {string} name Image name.
     * @returns {boolean} Whether an image was removed.
     */
    unregisterImage: (name) => api.unregisterImage(name),
    /**
     * Removes a registered PDF.
     * @name unregisterPdf
     * @function
     * @memberof Recipe
     * @param {string} name PDF name.
     * @returns {boolean} Whether a PDF was removed.
     */
    unregisterPdf: (name) => api.unregisterPdf(name),
    /**
     * Removes every registered font, image, and PDF.
     * @name disposeAssets
     * @function
     * @memberof Recipe
     * @returns {void}
     */
    disposeAssets() {
      Object.keys(fonts).forEach((key) => delete fonts[key]);
      api.disposeAssets();
    },
    inspectPdf,
    permission,
    thirdPartyLicenses,
    /**
     * Splits a registered PDF into one-page PDF byte arrays.
     * @name splitPdf
     * @function
     * @memberof Recipe
     * @param {string} name Registered PDF name.
     * @param {string} [prefix="page"] Prefix used for each output filename.
     * @returns {RecipeSplitResult[]} One result per source page, in page order.
     * @throws {Error} If no PDF is registered under `name` or it cannot be parsed.
     */
    splitPdf(name, prefix = "page") {
      if (!assets.pdfs.has(name)) throw unknownAsset("Unknown PDF", name);
      var pages = inspectPdf(name).pages;
      return Array.from({ length: pages }, (_, index) => ({
        name: `${prefix}-${index + 1}.pdf`,
        bytes: new Recipe().appendPage(name, index + 1).endPDF(),
      }));
    },
  });

  Object.assign(Recipe.prototype, {
    /**
     * Converts supported HTML into styled text fragments. Ordered and
     * unordered list fragments include their visual prefix and native-style
     * indentation. Unlike native's nested XML-derived layout tree, Wasm
     * returns flat visual fragments, as it always has. This helper does not
     * draw content or alter Recipe state.
     *
     * @name htmlToTextObjects
     * @function
     * @memberof Recipe#
     * @param {string} html - HTML source to convert.
     * @param {Partial<RecipeTextOptions>} [options] - Initial text options.
     * @returns {RecipeHtmlTextObject[]} Styled fragments in source order.
     */
    htmlToTextObjects(html, options = {}) {
      return htmlToTextObjects(html, options);
    },
    /**
     * Asynchronously reads PDF metadata. Blob and File inputs are accepted in
     * addition to synchronous byte sources.
     * @name readAsync
     * @function
     * @memberof Recipe#
     * @param {AsyncByteSource} bytes - PDF bytes or a blob-like source.
     * @returns {Promise<RecipeMetadata>} One-based page geometry and the page count.
     */
    async readAsync(bytes) {
      return this.read(await normalizeBytesAsync(bytes, "PDF input"));
    },
    /**
     * Asynchronously registers a font for this Recipe.
     * @name registerFontAsync
     * @function
     * @memberof Recipe#
     * @async
     * @param {string} name Font family name.
     * @param {AsyncByteSource} bytes Font bytes, Blob, or File.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {Promise<Recipe>} The recipe instance.
     */
    async registerFontAsync(name, bytes, type) {
      return this.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
        type,
      );
    },
    /**
     * Releases this Recipe's writer and reader. The instance must not be used
     * after disposal; registered assets stay until `Recipe.disposeAssets()`.
     * @name dispose
     * @function
     * @memberof Recipe#
     * @returns {void}
     */
    dispose() {
      if (this.writer?.dispose) this.writer.dispose();
      this._releaseReader();
      this.ended = true;
      this.disposed_ = true;
    },
    /**
     * Finishes this Recipe and splits it into one-page PDF byte arrays.
     * @name split
     * @function
     * @memberof Recipe#
     * @param {string} [prefix="page"] - Prefix for each output filename.
     * @returns {RecipeSplitResult[]} One result per page.
     */
    split(prefix = "page") {
      var name = `split-${state.nextPdf++}`;
      Recipe.registerPdf(name, this.endPDF());
      try {
        return Recipe.splitPdf(name, prefix);
      } finally {
        Recipe.unregisterPdf(name);
      }
    },
    /**
     * Reports basic structure for the finished PDF, finishing the Recipe.
     * @name structure
     * @function
     * @memberof Recipe#
     * @param {RecipeStructureFormat} [format="string"] Output format.
     * @returns {string|RecipeStructure} A text summary, or page, encryption
     *   and indirect-object counts for JSON output.
     */
    structure(format = StructureFormat.STRING) {
      var bytes = this.endPDF();
      var text = new TextDecoder("latin1").decode(bytes);
      var objects = (text.match(/\n\d+ \d+ obj\b/g) || []).length;
      var reader = api.createReader(bytes, this.encryptOptions);
      var pages;
      try {
        pages = reader.getPagesCount();
      } finally {
        reader.end();
      }
      if (format === StructureFormat.JSON || format?.json) {
        return { pages, encrypted: /\/Encrypt\b/.test(text), objects };
      }
      return `Info\nRoot\nSize: ${objects}\nPages: ${pages}`;
    },
  });

  return Recipe;
}
