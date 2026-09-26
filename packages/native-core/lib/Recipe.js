const muhammara = require("./muhammara");
const path = require("path");
const fs = require("fs");
const streams = require("memory-streams");
var { standardInfoKeys } = require("./recipe-info");

/**
 * @name Recipe
 * @desc Create a new PDF, or open an existing one for editing.
 * @namespace
 * @constructor
 * @param {string|Buffer} src - `"new"` (or `Buffer.from("new")`) for a new PDF,
 *   otherwise the path or Buffer of the PDF to edit.
 * @param {string} [output] - The output path. For a path source it defaults to
 *   the source path; for a Buffer source the result is only returned by
 *   `endPDF()` unless an output path is given.
 * @param {Object} [options] - The options for pdfDoc
 * @param {number} [options.version] - The PDF version of a new PDF: 1.0 through
 *   1.7 or 2.0. Other values fall back to 1.7.
 * @param {string} [options.author] - The author
 * @param {string} [options.title] - The title
 * @param {string} [options.subject] - The subject
 * @param {string[]} [options.keywords] - The array of keywords
 * @param {Recipe.Colorspace} [options.colorspace] - The default colorspace, one
 *   of the `Recipe.Colorspace` values.
 * @param {string} [options.password] - Owner password; also opens a protected source.
 * @param {string} [options.userPassword] - The 'view' password; also enables encryption.
 * @param {string} [options.ownerPassword] - The 'edit' password.
 * @param {number} [options.userProtectionFlag] - Encryption permission flags, see `permission()`.
 * @param {string|string[]} [options.fontSrcPath] - Directory location(s) of additional fonts.
 * @throws {Error} If an existing source PDF cannot be read or opened for editing.
 */
class Recipe {
  constructor(src, output, options = {}) {
    this.src = src;
    // detect the src is Buffer or not
    this.isBufferSrc = this.src instanceof Buffer;
    this.isNewPDF =
      (!this.isBufferSrc && src.toLowerCase() === "new") ||
      (this.isBufferSrc && this.src.equals(Buffer.from("new")));
    this.encryptOptions = this._getEncryptOptions(options, this.isNewPDF);
    this.options = Object.assign({}, options, this.encryptOptions);
    this.current = {};
    this.current.defaultFontSize = 14;

    if (this.isBufferSrc) {
      this.outStream = new streams.WritableStream();
      this.output = output;
    } else {
      this.output = output || src;
      if (this.src) {
        this.filename = path.basename(this.src);
      }
    }
    this.muhammara = muhammara;
    this.logFile = "muhammara-error.log";

    this.textMarkupAnnotations = [
      "Highlight",
      "Underline",
      "StrikeOut",
      "Squiggly",
    ];

    this.annotationsToWrite = [];
    this.annotations = [];
    this.vectorsToWrite = [];

    this.xObjects = [];

    this.needToEncrypt = false;

    this.needToInsertPages = false;

    this._setParameters(options);

    this._loadFonts(path.join(__dirname, "../fonts"));

    if (options.fontSrcPath) {
      this._loadFonts(options.fontSrcPath);
    }
    this._createWriter();
  }

  /**
   * Create the writer for a new PDF, or open the source PDF for editing, and
   * apply the info options.
   * @private
   * @returns {void}
   * @throws {Error} If the source PDF cannot be read or opened for editing.
   */
  _createWriter() {
    if (this.isNewPDF) {
      if (!this.isBufferSrc) {
        this.writer = muhammara.createWriter(
          this.output,
          Object.assign({}, this.encryptOptions, {
            version: this._getVersion(this.options.version),
          }),
        );
      } else {
        this.writer = muhammara.createWriter(
          new muhammara.PDFStreamForResponse(this.outStream),
          Object.assign({}, this.encryptOptions, {
            version: this._getVersion(this.options.version),
            log: this.logFile,
          }),
        );
      }
    } else {
      this.read();
      try {
        if (this.isBufferSrc) {
          this.writer = muhammara.createWriterToModify(
            new muhammara.PDFRStreamForBuffer(this.src),
            new muhammara.PDFStreamForResponse(this.outStream),
            Object.assign({}, this.encryptOptions, {
              log: this.logFile,
            }),
          );
        } else {
          this.writer = muhammara.createWriterToModify(
            this.src,
            Object.assign({}, this.encryptOptions, {
              modifiedFilePath: this.output,
              log: this.logFile,
            }),
          );
        }
      } catch (err) {
        throw new Error(err);
      }
    }

    var info = {};
    standardInfoKeys.forEach((key) => {
      if (this.options[key] !== undefined) info[key] = this.options[key];
    });
    this.info(info);
  }

  /**
   * Map a Recipe version option to a writer PDF version constant.
   * @private
   * @param {number} [version] - 1.0 through 1.7 or 2.0; other values use 1.7.
   * @returns {number} The matching `ePDFVersion*` constant.
   */
  _getVersion(version) {
    const supportedVersions = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.0];
    if (!supportedVersions.includes(version)) {
      version = 1.7;
    }
    version = muhammara[`ePDFVersion${version * 10}`];

    return version;
  }

  /**
   * The current drawing position in Recipe coordinates, where y grows downward
   * from the top edge of the page.
   * @returns {{x: number, y: number}} The current position.
   */
  get position() {
    const { ox, oy } = this._reverseCoordinate(
      this._position.x,
      this._position.y,
    );
    return {
      x: ox,
      y: oy,
    };
  }

  /**
   * Read PDF metadata: the page count and, keyed by one-based page number,
   * each page's media box, rotation, layout and size.
   * @param {string|Buffer} [inSrc] - A PDF path or Buffer to read instead of
   *   the recipe source. Reading another PDF does not change the recipe state.
   * @returns {Object} The PDF metadata.
   * @throws {Error} If the PDF cannot be read or has no pages.
   */
  read(inSrc) {
    const isForExternal = inSrc ? true : false;
    let pdfReader = null;
    let isAdopted = false;
    try {
      let src = isForExternal ? inSrc : this.src;
      if (src instanceof Buffer) {
        src = new muhammara.PDFRStreamForBuffer(src);
      }
      pdfReader = muhammara.createReader(src, this.encryptOptions);
      const pages = pdfReader.getPagesCount();
      if (pages == 0) {
        // broken or modify password protected
        throw "HummusJS: Unable to read/edit PDF file (pages=0)";
      }
      const metadata = {
        pages,
      };
      for (var i = 0; i < pages; i++) {
        const info = pdfReader.parsePage(i);
        const dimensions = info.getMediaBox();
        const rotate = info.getRotate();

        let layout, width, height, pageSize;
        let side1 = Math.abs(dimensions[2] - dimensions[0]);
        let side2 = Math.abs(dimensions[3] - dimensions[1]);
        if (side1 > side2 && rotate % 180 === 0) {
          layout = "landscape";
        } else if (side1 < side2 && rotate % 180 !== 0) {
          layout = "landscape";
        } else {
          layout = "portrait";
        }

        if (layout === "landscape") {
          width = side1 > side2 ? side1 : side2;
          height = side1 > side2 ? side2 : side1;
        } else {
          width = side1 > side2 ? side2 : side1;
          height = side1 > side2 ? side1 : side2;
        }

        pageSize = [width, height].sort((a, b) => {
          return a > b ? 1 : -1;
        });

        const page = {
          pageNumber: i + 1,
          mediaBox: dimensions,
          layout,
          rotate,
          width,
          height,
          size: pageSize,
          // usually 0
          offsetX: dimensions[0],
          offsetY: dimensions[1],
        };
        metadata[page.pageNumber] = page;
      }
      if (!isForExternal) {
        this._releaseReader();
        this.pdfReader = pdfReader;
        this.metadata = metadata;
        this.sourcePageCount = pages;
        isAdopted = true;
      }
      return metadata;
    } catch (err) {
      throw new Error(err);
    } finally {
      // Only the recipe source reader outlives read(); anything else would keep
      // the file open until the process exits.
      if (pdfReader && !isAdopted) {
        pdfReader.end();
      }
    }
  }

  /**
   * Release the source reader and the file handle it holds.
   * @private
   * @returns {void}
   */
  _releaseReader() {
    const pdfReader = this.pdfReader;
    if (!pdfReader) {
      return;
    }
    this.pdfReader = null;
    pdfReader.end();
  }

  /**
   * Get the source reader, which endPDF() releases.
   * @private
   * @returns {Object} The source PDF reader.
   * @throws {Error} If the reader was already released by endPDF().
   */
  _getReader() {
    if (!this.pdfReader) {
      throw new Error(
        "The source PDF reader has been released by endPDF(). Read the source before ending the document.",
      );
    }
    return this.pdfReader;
  }

  /**
   * End the pdfDoc. Finalization happens once; later calls do not rewrite the
   * PDF and invoke the callback with the completed output when applicable.
   * An active page is finished first, so a forgotten endPage() does not cost
   * that page. A failed finalization retires the Recipe and later calls
   * rethrow the original error.
   * @function
   * @memberof Recipe
   * @param {function((Buffer|string)=): *} [callback] - Called when the PDF is
   *   finished: with the output Buffer for a Buffer source without an output
   *   path, with the output path for a Buffer source with one, and without an
   *   argument for a path source.
   * @returns {*} The callback result, or undefined without a callback.
   * @throws {Error} If pages are being deleted while a page is still open.
   * @throws {Error} If finalization fails; later calls rethrow the same error.
   */
  endPDF(callback) {
    if (this.endError) {
      throw this.endError;
    }
    if (this.ended) {
      if (!callback) return;
      if (!this.isBufferSrc) return callback();
      return callback(this.output || this.outStream.toBuffer());
    }
    var deletingPages = Boolean(this.deletedPages?.size);
    var deletionState = deletingPages
      ? {
          metadata: this.metadata,
          metadataValues: { ...this.metadata },
          annotations: this.annotations,
          annotationsToWrite: this.annotationsToWrite,
          deletedPages: this.deletedPages,
        }
      : null;
    if (deletingPages && this.page) {
      throw new Error("Finish the current page before endPDF");
    }
    // The writer cannot finalize around an open content stream: it drops the
    // page and emits a catalog with no page tree. Finish the page for the
    // caller instead, before finalization retires the Recipe.
    if (this.page) this.endPage();
    try {
      this._deletePages();
      this._writeInfo();
      this.writer.end();
      // This is a temporary work around for copying context will overwrite the current one
      // write annotations at the end.
      if (
        (this.annotations && this.annotations.length > 0) ||
        (this.annotationsToWrite && this.annotationsToWrite.length > 0)
      ) {
        if (this.isBufferSrc) {
          const oldStream = this.outStream;
          this.outStream = new streams.WritableStream();

          this.writer = muhammara.createWriterToModify(
            new muhammara.PDFRStreamForBuffer(oldStream.toBuffer()),
            new muhammara.PDFStreamForResponse(this.outStream),
            Object.assign({}, this.encryptOptions, {
              log: this.logFile,
            }),
          );
        } else {
          this.writer = muhammara.createWriterToModify(
            this.output,
            Object.assign({}, this.encryptOptions, {
              modifiedFilePath: this.output,
              log: this.logFile,
            }),
          );
        }

        this._writeAnnotations();
        this._writeInfo();
        this.writer.end();
      }

      // Every step above may still read the source; _insertPages() and _encrypt()
      // below rename the output, which is the source itself when no separate
      // output was given, and Windows refuses that while the reader holds it.
      this._releaseReader();

      if (this.needToInsertPages) {
        if (this.isBufferSrc) {
          // eslint-disable-next-line no-console
          console.log(
            "Feature: Inserting Pages is not supported in Buffer Mode yet.",
          );
        } else {
          this._insertPages();
        }
      }
      if (this.needToEncrypt) {
        if (this.isBufferSrc) {
          // eslint-disable-next-line no-console
          console.log(
            "Feature: Encryption is not supported in Buffer Mode yet.",
          );
        } else {
          this._encrypt();
        }
      }

      if (this.isBufferSrc && this.output) {
        fs.writeFileSync(this.output, this.outStream.toBuffer());
      }

      this.ended = true;
    } catch (error) {
      if (deletingPages) {
        Object.keys(deletionState.metadata).forEach(
          (key) => delete deletionState.metadata[key],
        );
        Object.assign(deletionState.metadata, deletionState.metadataValues);
        this.metadata = deletionState.metadata;
        this.annotations = deletionState.annotations;
        this.annotationsToWrite = deletionState.annotationsToWrite;
        this.deletedPages = deletionState.deletedPages;
      }
      this.endError = error;
      this.ended = true;
      try {
        this.writer._abort();
      } catch (_) {
        // Preserve the finalization error if native cleanup also fails.
      }
      try {
        this._releaseReader();
      } catch (_) {
        // Preserve the finalization error if releasing its separate reader fails.
      }
      throw error;
    }

    if (callback) {
      if (this.isBufferSrc) {
        if (this.output) {
          return callback(this.output);
        } else {
          return callback(this.outStream.toBuffer());
        }
      } else {
        return callback();
      }
    }
  }

  /**
   * Register a callback procedure with MuhammaraJS.
   * @function
   * @memberof Recipe
   * @param {string|Function} key Name assigned to the callback. When a named function is
   * registered, and its given name is what is to be used to access it, the key is unnecessary.
   * @param {Function} [callback] Callback procedure that can be accessed through MuhammaraJS.
   *   It is added to the shared Recipe prototype, so every Recipe instance gets it.
   * @throws {string} If the callback function is unnamed when no key is provided.
   * @throws {string} If the key conflicts with an existing Recipe prototype member.
   * @throws {string} If the callback is not a function.
   * @returns {Recipe} The recipe instance.
   */
  register(key, callback) {
    // Assume simply registering a function which will have an embedded name
    if (typeof key !== "string") {
      if (!key.name) {
        throw "Cannot register unnamed callback function. Provide 'name' as first argument, then callback function.";
      }
      callback = key;
      key = key.name;
    }

    if (this.__proto__[key]) {
      throw `Found conflict in Recipe prototypes. ${key} already exists.`;
    }

    if (typeof callback !== "function") {
      throw `${key} expecting callback to be of type function.`;
    }

    this.__proto__[key] = callback;
    return this;
  }
}

function loadPrototypes() {
  const ignores = ["utils.js", "xObjectForm.js"];
  fs.readdirSync(path.join(__dirname, "recipe"))
    .filter((file) => {
      return file[0] != "." && !ignores.includes(file);
    })
    .forEach((file) => {
      const module = require(path.join(__dirname, "recipe", file));
      for (let key in module) {
        if (Recipe.prototype[key]) {
          throw `Found conflict prototypes=${key} in ${file}.`;
        }
        Recipe.prototype[key] = module[key];
      }
    });
}

loadPrototypes();

/**
 * Colorspaces accepted by the `colorspace` options of Recipe.
 * @readonly
 * @enum {string}
 */
Recipe.Colorspace = Object.freeze({
  RGB: "rgb",
  CMYK: "cmyk",
  GRAY: "gray",
  SEPARATION: "separation",
});

module.exports = Recipe;
