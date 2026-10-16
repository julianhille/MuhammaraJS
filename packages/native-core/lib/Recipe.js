// The native Recipe: the shared Recipe on the native addon, with paths,
// Buffers and the font folders as its I/O.
const fs = require("fs");
const path = require("path");
const PDFWStreamForBuffer = require("./PDFWStreamForBuffer");
const {
  createRecipe: createSharedRecipe,
} = require("@muhammara/shared/recipe/Recipe.js");

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
 * Create the I/O of the shared Recipe for one loaded addon.
 * @param {Object} muhammara - The public API built by createMuhammara().
 * @returns {Object} The platform the shared Recipe runs on.
 */
function createNativePlatform(muhammara) {
  /**
   * Start a writer whose output collects in memory.
   * @param {Function} create - Creates the writer on the given output stream.
   * @returns {{writer: Object, finish: function(): Uint8Array}} The writer.
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
    };
  }

  return {
    muhammara,
    defaultFontFamily: "helvetica",

    /**
     * Read the native constructor arguments: `"new"` (or `Buffer.from("new")`)
     * for a new PDF, otherwise the path or Buffer of the PDF to edit, then an
     * optional output path and the options.
     * @param {Array} args - The constructor arguments.
     * @returns {Object} The source bytes (null for a new PDF), the output, the
     *   options and the source file name.
     */
    openArguments([src, output, options = {}]) {
      const isBuffer = Buffer.isBuffer(src);
      const isNew = isBuffer
        ? src.equals(Buffer.from(Source.NEW))
        : String(src).toLowerCase() === Source.NEW;
      let source = null;
      if (!isNew) source = isBuffer ? src : fs.readFileSync(src);
      return {
        source,
        // A path source writes its output file, by default the source itself.
        output: isBuffer
          ? { path: output, buffer: true }
          : { path: output || src },
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
      const { path: outputPath, buffer } = recipe.output;
      if (outputPath) {
        fs.writeFileSync(outputPath, bytes);
        return buffer ? outputPath : undefined;
      }
      return asBuffer(bytes);
    },

    /**
     * What the reader and copying APIs accept for a PDF: a stream over bytes,
     * or a path as given.
     * @param {Uint8Array|string|Object} source - Bytes, a path or a stream.
     * @returns {string|Object} The path or stream.
     */
    readerSource(source) {
      return source instanceof Uint8Array
        ? new muhammara.PDFRStreamForBuffer(asBuffer(source))
        : source;
    },

    newWriter(options) {
      return bufferedWriter((stream) =>
        muhammara.createWriter(stream, options),
      );
    },

    modifyWriter(bytes, options) {
      return bufferedWriter((stream) =>
        muhammara.createWriterToModify(
          new muhammara.PDFRStreamForBuffer(asBuffer(bytes)),
          stream,
          options,
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
     * @returns {{name: string, ref: string}[]} Each file's name without its
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
  return createSharedRecipe(createNativePlatform(muhammara), { Source });
}

module.exports = { createRecipe };
