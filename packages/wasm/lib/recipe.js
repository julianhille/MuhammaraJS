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

  /**
   * The handle of one writer pass, as the shared Recipe expects it.
   * @param {object} writer - The writer.
   * @returns {{writer: object, finish: Function, abort: Function}} The
   *   writer, `finish()` that ends it and returns the bytes, and `abort()`
   *   that releases it, also after `finish()`.
   */
  function writerHandle(writer) {
    return {
      writer,
      finish: () => writer.end(),
      abort: () => writer.dispose(),
    };
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
       * @throws {RangeError} If the page does not exist, in the words Wasm
       *   Recipe has always used.
       */
      PDFPageModifier: function (
        writer,
        pageIndex,
        ensureContentEncapsulation,
      ) {
        if (
          !Number.isInteger(pageIndex) ||
          pageIndex < 0 ||
          pageIndex >= writer.getModifiedFileParser().getPagesCount()
        ) {
          throw new RangeError("pageNumber must identify an existing page");
        }
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
    pageInfoIsRecord: true,
    sourceName: "PDF bytes",
    noPageError: () => new Error("A page is required for coordinates"),
    /**
     * The error of a PDF source that cannot be read or edited: the error as
     * raised, as Wasm Recipe has always thrown it, and native's pages=0
     * message without its brand.
     * @param {*} err - The error the reader raised.
     * @returns {Error} The error to throw.
     */
    sourceError: (err) =>
      typeof err === "string" ? new Error(err.replace("HummusJS: ", "")) : err,
    /**
     * Checks the insertPage() arguments at the call, as Wasm Recipe always
     * did.
     * @param {*} afterPageNumber - The page to insert after.
     * @param {*} source - A registered name or bytes.
     * @param {*} pageNumber - The one-based source page.
     * @returns {void}
     * @throws {Error} If afterPageNumber is not a whole number of at least 0.
     * @throws {TypeError} If the source is no registered name or bytes, or the
     *   page is not a whole number of at least 1.
     */
    checkInsertPage(afterPageNumber, source, pageNumber) {
      if (!Number.isInteger(afterPageNumber) || afterPageNumber < 0) {
        throw new Error("The afterPageNumber is inValid.");
      }
      var isPdf =
        typeof source === "string"
          ? assets.pdfs.has(source)
          : source instanceof ArrayBuffer || ArrayBuffer.isView(source);
      if (!isPdf || !Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new TypeError(
          "insertPage requires a registered PDF and one-based source page",
        );
      }
    },
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

    /**
     * Hands the finished PDF over: its bytes.
     * @param {Recipe} recipe - The recipe.
     * @param {Uint8Array} bytes - The PDF.
     * @returns {Uint8Array} The bytes.
     */
    deliver: (recipe, bytes) => bytes,
    // endPDF(callback) returns the bytes, as typed since 1.0.
    endPDFReturnsResult: true,

    /**
     * What the reader and copying APIs accept for a PDF: bytes, read from a
     * registered asset for a name.
     * @param {string|Uint8Array} source - A registered name or bytes.
     * @returns {Uint8Array} The bytes.
     * @throws {Error} If `source` names no registered PDF or image.
     */
    readerSource(source) {
      if (typeof source !== "string") return source;
      if (!assets.pdfs.has(source) && !assets.images.has(source)) {
        throw unknownAsset("Unknown PDF", source);
      }
      return assetBytes(source);
    },

    /**
     * Starts the writer of a new PDF; native's Recipe.js describes the handle.
     * @param {object} options - The writer options.
     * @returns {{writer: object, finish: Function, abort: Function}} The handle.
     */
    newWriter: (options) => writerHandle(api.createWriter(options)),

    /**
     * Starts a writer that modifies PDF bytes.
     * @param {Uint8Array} bytes - The PDF.
     * @param {object} options - The writer options.
     * @returns {{writer: object, finish: Function, abort: Function}} The handle.
     */
    modifyWriter: (bytes, options) =>
      writerHandle(api.createWriterToModify(bytes, options)),

    /**
     * Encrypts PDF bytes, keeping their Info dictionary.
     * @param {Uint8Array} bytes - The PDF.
     * @param {object} options - The encryption options and opening password.
     * @returns {Uint8Array} The encrypted PDF.
     */
    recrypt: (bytes, options) => api.recrypt(bytes, options),

    readBytes: assetBytes,

    /**
     * A key that changes when a registered image or PDF is replaced.
     * @param {string} ref - The registered name.
     * @returns {?string} The key, or null for an unregistered name.
     */
    assetVersion(ref) {
      return assets.images.get(ref) || assets.pdfs.get(ref) || null;
    },

    /**
     * Gives a Recipe the shared font registry, with the default font.
     * @param {Recipe} recipe - The recipe.
     * @returns {void}
     */
    loadFonts(recipe) {
      // fontSrcPath names folders, which Wasm cannot read; it is ignored, as
      // it always was.
      ensureDefaultFont();
      recipe.fonts = fonts;
    },

    /**
     * No font folders: Wasm cannot read them.
     * @returns {Array} An empty list.
     */
    fontFiles: () => [],

    /**
     * Stores registered font bytes under a fresh low-level name.
     * @param {string} name - The family name.
     * @param {Uint8Array} bytes - The font bytes.
     * @returns {string} The low-level font name.
     */
    fontSource: (name, bytes) => storeFont(bytes),

    /**
     * Whether a low-level font name is still registered.
     * @param {string} ref - The low-level font name.
     * @returns {boolean} Whether it is.
     */
    fontExists: (ref) => assets.fonts.has(ref),

    /**
     * Loads a registered font into a writer.
     * @param {object} writer - The writer.
     * @param {string} ref - The low-level font name.
     * @returns {object} The writer's font.
     */
    getFont: (writer, ref) => writer.getFontForBytes(ref),
  };

  /**
   * @name Recipe
   * @desc Creates a byte-first high-level PDF Recipe. Pass PDF bytes as the
   * first argument to modify an existing document, or pass only options to
   * create a new document. For Blob or File input, await `arrayBuffer()` and
   * pass the resulting bytes to the constructor.
   * @namespace
   * @constructor
   * @param {ByteSource|RecipeOptions} [sourceOrOptions={}] Source PDF bytes or
   *   creation options.
   * @param {RecipeOptions} [options={}] Options used when modifying source
   *   bytes.
   * @throws {TypeError} If Recipe options are not an object, or `pdfa` has an
   *   unknown level, an unusable profile or an `outputCondition` that is no
   *   string.
   * @throws {Error} If the source has no readable pages, as with an encrypted
   *   source opened without its password, the PDF cannot be created, or
   *   `pdfa` is given for a source PDF, with another `version`, or with
   *   encryption.
   */
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

  Object.defineProperty(Recipe.prototype, "metadata", {
    /**
     * The metadata of the source PDF, as typed since 1.0.
     * @returns {RecipeMetadata|undefined} The metadata, or undefined for a
     *   new PDF.
     */
    get() {
      return this.isNewPDF ? undefined : this._metadata;
    },
    /**
     * Replaces the metadata, as the plain field it once was allowed.
     * @private
     * @param {RecipeMetadata} value - The metadata.
     * @returns {void}
     */
    set(value) {
      this._metadata = value;
    },
  });

  Object.assign(Recipe.prototype, {
    /**
     * Adds a named extension method to all Recipe instances.
     * The callback executes with the Recipe as `this`. Existing Recipe methods
     * cannot be replaced through this API. Unlike native, which throws
     * strings, it throws Error objects, as Wasm always has.
     *
     * @name register
     * @function
     * @memberof Recipe#
     * @param {string|RecipeExtension} key - Method name, or a named callback.
     * @param {RecipeExtension} [callback] - Extension implementation when a name is supplied.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If no method name or callback is available.
     * @throws {Error} If the method name already exists.
     */
    register(key, callback) {
      if (typeof key !== "string") {
        callback = key;
        key = callback?.name;
      }
      if (!key || typeof callback !== "function") {
        throw new TypeError("Register requires a named callback function");
      }
      if (key in Recipe.prototype) {
        throw new Error(`Recipe method already exists: ${key}`);
      }
      Recipe.prototype[key] = callback;
      return this;
    },
    /**
     * Returns the document information dictionary without changing page state.
     * This method reports PDF metadata, not Recipe-coordinate page geometry;
     * use `pageInfo()` or `getCurrentPageInfo()` for geometry.
     * For a new PDF it returns the `info()` record, as Wasm always has.
     *
     * @name getPageInfo
     * @function
     * @memberof Recipe#
     * @returns {Record<string, unknown>|InfoDictionary} The current document information dictionary.
     */
    getPageInfo() {
      return this.isNewPDF
        ? this.info()
        : this.writer.getDocumentContext().getInfoDictionary();
    },
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
      this._output.abort();
      this._releaseReader();
      if (!this.ended) {
        this.endError = new Error("Cannot end the PDF after disposal");
      }
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
      var reader = api.createReader(
        bytes,
        Object.keys(this.encryption_).length
          ? this.encryption_
          : this.encryptOptions,
      );
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
