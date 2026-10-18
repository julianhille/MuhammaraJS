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
 * Create the output file of a path Recipe, where the addon used to open it,
 * so an unwritable output fails before any page is drawn.
 * @param {Recipe} recipe - The recipe, with its `output` path.
 * @returns {void}
 * @throws {TypeError} If the output file cannot be created or written, in
 *   the words of the addon.
 */
function claimOutput(recipe) {
  try {
    // "a" creates a missing file and never truncates the source.
    fs.closeSync(fs.openSync(recipe.output, "a"));
  } catch {
    throw new TypeError(
      recipe.isNewPDF
        ? "Unable to create PDF file, make sure that output file target is available"
        : "Unable to modify PDF file, make sure that output file target is available and that it is not protected",
    );
  }
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
   *   The writer handle newWriter() describes.
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
    /**
     * The error of a drawing call that needs a page when none is active.
     * @returns {TypeError} The error.
     */
    noPageError: () =>
      new TypeError("No page is active; call createPage() or editPage() first"),

    /**
     * Read the native constructor arguments: `"new"` (or `Buffer.from("new")`)
     * for a new PDF, otherwise the path or bytes of the PDF to edit, then an
     * optional output path and the options. A `Uint8Array` or `ArrayBuffer`
     * is wrapped in a Buffer without copying.
     * @param {Array} args - The constructor arguments.
     * @returns {Object} The source bytes (null for a new PDF), the options,
     *   and the instance state native Recipe has always had: `src`, `output`,
     *   `isBufferSrc`, `logFile`, and `outStream` for a Buffer source or
     *   `filename` for a path.
     * @throws {TypeError} If the source is not a string, Buffer, Uint8Array or
     *   ArrayBuffer.
     * @throws {Error} If a source path cannot be read.
     */
    openArguments([src, output, options = {}]) {
      src = toRecipeSource(src);
      const isBufferSrc = Buffer.isBuffer(src);
      const isNew = isBufferSrc
        ? src.equals(Buffer.from(Source.NEW))
        : String(src).toLowerCase() === Source.NEW;
      let source = isNew ? null : src;
      if (!isBufferSrc && !isNew) {
        // Fail at construction, in the words of the addon, as Recipe did
        // when it opened the file there.
        try {
          source = fs.readFileSync(src);
        } catch {
          throw new Error("TypeError: Unable to start parsing PDF file");
        }
      }
      const state = { src, isBufferSrc, logFile: LOG_FILE };
      return {
        source,
        options,
        // A path source writes its output file, by default the source itself.
        state: isBufferSrc
          ? { ...state, output, outStream: new PDFWStreamForBuffer() }
          : { ...state, output: output || src, filename: path.basename(src) },
      };
    },

    /**
     * Hand the finished PDF over: write the output path, and return what the
     * endPDF() callback receives. A Buffer source also keeps it in
     * `outStream.buffer`.
     * @param {Recipe} recipe - The recipe.
     * @param {Uint8Array} bytes - The finished PDF.
     * @returns {Buffer|string|undefined} The Buffer for a Buffer source, its
     *   output path when it has one, and nothing for a path source.
     */
    deliver(recipe, bytes) {
      const buffer = asBuffer(bytes);
      if (recipe.isBufferSrc) recipe.outStream.buffer = buffer;
      if (!recipe.output) return buffer;
      fs.writeFileSync(recipe.output, buffer);
      return recipe.isBufferSrc ? recipe.output : undefined;
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

    /**
     * Start the writer of a new PDF, or of the insert pass. The writer's
     * output collects in memory; deliver() writes it to the output path.
     * @param {Object} options - The writer options: `version`, `compress`.
     * @param {Recipe} [recipe] - The recipe a new PDF is created for. Its
     *   output path is created here, and a Buffer source gets the error log.
     * @returns {{writer: Object, finish: function(): Uint8Array, abort: function(): void}}
     *   The writer, `finish()` that ends it and returns the PDF, and
     *   `abort()` that releases it without output, also after `finish()`.
     * @throws {TypeError} If the output file cannot be created.
     */
    newWriter(options, recipe) {
      if (recipe && !recipe.isBufferSrc) claimOutput(recipe);
      return bufferedWriter((stream) =>
        muhammara.createWriter(
          stream,
          recipe?.isBufferSrc ? { ...options, log: recipe.logFile } : options,
        ),
      );
    },

    /**
     * Start a writer that modifies a PDF: the source, or the finished first
     * pass for the annotation pass. It returns the handle newWriter() does.
     * @param {Uint8Array} bytes - The PDF to modify.
     * @param {Object} options - The writer options: `password`, `compress`.
     * @param {Recipe} recipe - The recipe. Its output path is claimed, and
     *   the writer gets its error log.
     * @returns {{writer: Object, finish: function(): Uint8Array, abort: function(): void}}
     *   The writer handle.
     * @throws {TypeError} If the output file cannot be written, or the PDF
     *   cannot be modified.
     */
    modifyWriter(bytes, options, recipe) {
      if (!recipe.isBufferSrc) claimOutput(recipe);
      return bufferedWriter((stream) =>
        muhammara.createWriterToModify(
          new muhammara.PDFRStreamForBuffer(asBuffer(bytes)),
          stream,
          { ...options, log: recipe.logFile },
        ),
      );
    },

    /**
     * Encrypt a finished PDF, keeping its Info dictionary.
     * @param {Uint8Array} bytes - The PDF.
     * @param {Object} options - The encryption options, and the `password`
     *   that opens an encrypted input.
     * @returns {Buffer} The encrypted PDF.
     * @throws {Error} If the PDF cannot be read or encrypted.
     */
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

    /**
     * What a font registered from a file is stored as: its path.
     * @param {string} name - The family name.
     * @param {string} file - The font path.
     * @returns {string} The path.
     */
    fontSource(name, file) {
      return file;
    },

    /**
     * Whether a stored font can still be loaded.
     * @param {string} file - The font path.
     * @returns {boolean} Whether the file exists.
     */
    fontExists(file) {
      return fs.existsSync(file);
    },

    /**
     * Load a stored font into a writer.
     * @param {Object} writer - The writer.
     * @param {string} file - The font path.
     * @returns {Object} The writer's font.
     */
    getFont(writer, file) {
      return writer.getFontForFile(file);
    },

    /**
     * Write one page that split() made.
     * @param {string} outputDir - The directory.
     * @param {string} fileName - The file name.
     * @param {Uint8Array} bytes - The one-page PDF.
     * @returns {void}
     * @throws {TypeError} If the file cannot be written, with the message
     *   createWriter() throws for such a path.
     */
    saveSplit(outputDir, fileName, bytes) {
      try {
        fs.writeFileSync(path.join(outputDir, fileName), bytes);
      } catch {
        throw new TypeError(
          "Unable to create PDF file, make sure that output file target is available",
        );
      }
    },

    /**
     * Write the text structure() made.
     * @param {string} output - The output path.
     * @param {string} text - The structure.
     * @returns {void}
     */
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
  return Recipe;
}

module.exports = { createRecipe, Source };
