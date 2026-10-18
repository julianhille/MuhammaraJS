// The native Recipe: the shared Recipe on the native addon, with paths,
// Buffers and the font folders as its I/O.
const fs = require("fs");
const path = require("path");
const PDFWStreamForBuffer = require("./PDFWStreamForBuffer");
const {
  createRecipe: createSharedRecipe,
} = require("./shared/recipe/Recipe.js");
const { Column, Line, Word } = require("./shared/recipe/text.helper.js");

/**
 * Special Recipe sources.
 * @readonly
 * @enum {string}
 */
const Source = Object.freeze({
  /** Create a new PDF instead of editing one; matched case-insensitively. */
  NEW: "new",
});

const FONT_TYPES = [".ttf", ".ttc", ".otf"];
// The error log native Recipe has always passed to its writers, except to the
// writer of a new PDF with an output path.
const LOG_FILE = "muhammara-error.log";
const BUNDLED_FONTS = path.join(__dirname, "../fonts");

/**
 * View bytes as a Buffer without copying them.
 * @param {Uint8Array} bytes - The bytes.
 * @returns {Buffer} The same bytes as a Buffer.
 */
function asBuffer(bytes) {
  return Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Wrap a byte source in a Buffer that shares its memory.
 * @param {string|Buffer|Uint8Array|ArrayBuffer} src - A PDF path or bytes.
 * @returns {string|Buffer} The path, or the bytes as a Buffer.
 * @throws {TypeError} If `src` is not a string, Buffer, Uint8Array or ArrayBuffer.
 */
function toRecipeSource(src) {
  if (src instanceof ArrayBuffer) return Buffer.from(src);
  if (src instanceof Uint8Array) return asBuffer(src);
  if (typeof src === "string") return src;
  throw new TypeError(
    "Recipe source must be a path string, Buffer, Uint8Array or ArrayBuffer",
  );
}

/**
 * Create the I/O of the shared Recipe for one loaded addon.
 * @param {Object} muhammara - The public API built by createMuhammara().
 * @returns {Object} The platform the shared Recipe runs on.
 */
function createNativePlatform(muhammara) {
  /**
   * Start a writer whose output collects in memory.
   * @param {Function} create - Creates the writer on the given output stream.
   * @returns {{writer: Object, finish: function(): Uint8Array, abort: function(): void}}
   *   The writer, `finish()` that ends it and returns the PDF, and `abort()`
   *   that releases it without output, also after `finish()`.
   */
  function bufferedWriter(create) {
    const stream = new PDFWStreamForBuffer();
    const writer = create(stream);
    return {
      writer,
      finish() {
        writer.end();
        return stream.buffer || Buffer.alloc(0);
      },
      abort() {
        writer._abort();
      },
    };
  }

  return {
    muhammara,
    defaultFontFamily: "helvetica",
    // What image() takes, for its error messages.
    imageReference: "an image path",
    // Native's behaviour where the ends differed; kept until a major release
    // unifies them, see packages/wasm/DIFFERENCES.md.
    fontFallsBackToDefault: true,
    textWithoutPageThrows: false,
    rejectsImageIndex: false,
    pageInfoIsRecord: false,
    sourceName: "an existing PDF",
    noPageError: () =>
      new TypeError("No page is active; call createPage() or editPage() first"),

    /**
     * Read the native constructor arguments: `"new"` (or `Buffer.from("new")`)
     * for a new PDF, otherwise the path or bytes of the PDF to edit, then an
     * optional output path and the options. A `Uint8Array` or `ArrayBuffer`
     * is wrapped in a Buffer without copying.
     * @param {Array} args - The constructor arguments.
     * @returns {Object} The source bytes (null for a new PDF), the output, the
     *   options and the source file name.
     * @throws {TypeError} If the source is not a string, Buffer, Uint8Array or
     *   ArrayBuffer, or the output file of a new PDF cannot be created.
     * @throws {Error} If a source path cannot be read, or its output file
     *   cannot be written.
     */
    openArguments([src, output, options = {}]) {
      src = toRecipeSource(src);
      const isBuffer = Buffer.isBuffer(src);
      const isNew = isBuffer
        ? src.equals(Buffer.from(Source.NEW))
        : String(src).toLowerCase() === Source.NEW;
      let source = isNew ? null : src;
      if (!isBuffer) {
        // Fail at construction, in the words of the addon, as Recipe did
        // when it opened the files there.
        if (!isNew) {
          try {
            source = fs.readFileSync(src);
          } catch {
            throw new Error("TypeError: Unable to start parsing PDF file");
          }
        }
        try {
          // "a" creates a missing file and never truncates the source.
          fs.closeSync(fs.openSync(output || src, "a"));
        } catch {
          throw isNew
            ? new TypeError(
                "Unable to create PDF file, make sure that output file target is available",
              )
            : new Error(
                "TypeError: Unable to modify PDF file, make sure that output file target is available and that it is not protected",
              );
        }
      }
      return {
        source,
        // A path source writes its output file, by default the source itself.
        output: isBuffer
          ? { src, path: output, buffer: true, log: LOG_FILE }
          : { src, path: output || src, log: isNew ? undefined : LOG_FILE },
        options,
        name: isBuffer ? undefined : path.basename(src),
      };
    },

    /**
     * Hand the finished PDF over: write the output path, and return what the
     * endPDF() callback receives.
     * @param {Recipe} recipe - The recipe.
     * @param {Uint8Array} bytes - The finished PDF.
     * @returns {Buffer|string|undefined} The Buffer for a Buffer source, its
     *   output path when it has one, and nothing for a path source.
     */
    deliver(recipe, bytes) {
      const { path: outputPath, buffer } = recipe._target;
      if (outputPath) {
        fs.writeFileSync(outputPath, bytes);
        return buffer ? outputPath : undefined;
      }
      return asBuffer(bytes);
    },

    /**
     * What the reader and copying APIs accept for a PDF: a stream over bytes,
     * or a path as given.
     * @param {string|Uint8Array|ArrayBuffer} source - A path or bytes.
     * @returns {string|Object} The path or stream.
     * @throws {TypeError} If `source` is not a string, Buffer, Uint8Array or
     *   ArrayBuffer.
     */
    readerSource(source) {
      source = toRecipeSource(source);
      return typeof source === "string"
        ? source
        : new muhammara.PDFRStreamForBuffer(source);
    },

    newWriter(options, recipe) {
      const log = recipe?._target.log;
      return bufferedWriter((stream) =>
        muhammara.createWriter(stream, log ? { ...options, log } : options),
      );
    },

    modifyWriter(bytes, options, recipe) {
      const log = recipe?._target.log;
      return bufferedWriter((stream) =>
        muhammara.createWriterToModify(
          new muhammara.PDFRStreamForBuffer(asBuffer(bytes)),
          stream,
          log ? { ...options, log } : options,
        ),
      );
    },

    recrypt(bytes, options) {
      const encrypted = new PDFWStreamForBuffer();
      muhammara.recrypt(
        new muhammara.PDFRStreamForBuffer(asBuffer(bytes)),
        encrypted,
        options,
      );
      return encrypted.buffer;
    },

    /**
     * Read a file the Recipe was given by path.
     * @param {string|Uint8Array} file - The path, or the bytes themselves.
     * @returns {Uint8Array} The bytes.
     */
    readBytes(file) {
      if (typeof file === "string") return fs.readFileSync(file);
      if (file instanceof ArrayBuffer) return new Uint8Array(file);
      if (ArrayBuffer.isView(file) && !(file instanceof Uint8Array)) {
        return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
      }
      return file;
    },

    /**
     * A key that changes when an image file changes, or null for a missing
     * file.
     * @param {string} file - The image path.
     * @returns {?string} The key.
     */
    assetVersion(file) {
      try {
        const stat = fs.statSync(file);
        return `${file}\0${stat.mtimeMs}\0${stat.size}`;
      } catch {
        return null;
      }
    },

    /**
     * Register the bundled fonts and those of the `fontSrcPath` option.
     * @param {Recipe} recipe - The recipe.
     * @param {Object} options - The constructor options.
     * @returns {void}
     */
    loadFonts(recipe, options) {
      recipe._loadFonts(BUNDLED_FONTS);
      if (options.fontSrcPath) recipe._loadFonts(options.fontSrcPath);
    },

    /**
     * The font files in the given directories; missing directories are
     * skipped.
     * @param {string[]} directories - The directories.
     * @returns {Array<{name: string, ref: string}>} Each file's name without its
     *   extension, and its path.
     */
    fontFiles(directories) {
      return directories
        .filter((directory) => fs.existsSync(directory))
        .flatMap((directory) =>
          fs
            .readdirSync(directory)
            .filter((file) =>
              FONT_TYPES.includes(path.extname(file).toLowerCase()),
            )
            .map((file) => ({
              name: path.basename(file, path.extname(file)),
              ref: path.join(directory, file),
            })),
        );
    },

    fontSource(name, file) {
      return file;
    },

    fontExists(file) {
      return fs.existsSync(file);
    },

    getFont(writer, file) {
      return writer.getFontForFile(file);
    },

    saveSplit(outputDir, fileName, bytes) {
      fs.writeFileSync(path.join(outputDir, fileName), bytes);
    },

    writeStructure(output, text) {
      fs.writeFileSync(output, text);
    },
  };
}

/**
 * Create the Recipe class for one loaded addon.
 * @private
 * @param {Object} muhammara - The public API built by createMuhammara().
 * @returns {Function} The Recipe class bound to that addon.
 */
function createRecipe(muhammara) {
  const Recipe = createSharedRecipe(createNativePlatform(muhammara), {
    Source,
  });
  // The text layout classes native Recipe has always exposed.
  Object.assign(Recipe.prototype, { Column, Line, Word });
  // The instance state native Recipe has always exposed, read-only.
  Object.defineProperties(
    Recipe.prototype,
    Object.getOwnPropertyDescriptors({
      /** @returns {string|Buffer} The source as given: a path or a Buffer. */
      get src() {
        return this._target.src;
      },
      /** @returns {string|undefined} The output path. */
      get output() {
        return this._target.path;
      },
      /** @returns {boolean} Whether the source is a Buffer. */
      get isBufferSrc() {
        return this._target.buffer === true;
      },
      /** @returns {string} The error log the writers are given. */
      get logFile() {
        return LOG_FILE;
      },
      /**
       * @returns {{buffer: Buffer}|undefined} For a Buffer source, the
       *   finished PDF once endPDF() ran.
       */
      get outStream() {
        return this._target.buffer ? { buffer: this.bytes_ } : undefined;
      },
    }),
  );
  return Recipe;
}

module.exports = { createRecipe, Source };
