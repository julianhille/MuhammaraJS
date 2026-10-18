import { standardInfoKeys } from "../recipe-info.js";
// PdfA joins the constants here: pdfa.js needs recipe-constants itself
import { PdfA, pdfaOptions } from "../pdfa.js";
import * as recipeConstants from "../recipe-constants.js";
import { AnnotSubtype, PageLayout } from "../recipe-constants.js";

import * as m_annotation from "./annotation.js";
import * as m_appendPage from "./appendPage.js";
import * as m_colors from "./colors.js";
import * as m_coordinate from "./coordinate.js";
import * as m_encrypt from "./encrypt.js";
import * as m_font from "./font.js";
import * as m_form from "./form.js";
import * as m_graphics_state from "./graphics-state.js";
import * as m_htmlToTextObjects from "./htmlToTextObjects.js";
import * as m_image from "./image.js";
import * as m_info from "./info.js";
import * as m_insertPage from "./insertPage.js";
import * as m_overlay from "./overlay.js";
import * as m_page from "./page.js";
import * as m_parameters from "./parameters.js";
import * as m_replaceText from "./replaceText.js";
import * as m_shapes from "./shapes.js";
import * as m_split from "./split.js";
import * as m_table from "./table.js";
import * as m_text_helper from "./text.helper.js";
import * as m_text from "./text.js";
import * as m_vector_line from "./vector-line.js";
import * as m_vector_polygon from "./vector-polygon.js";
import * as m_vector_helper from "./vector.helper.js";
import * as m_vector from "./vector.js";

/**
 * @name Recipe
 * @desc Create a new PDF, or open an existing one for editing.
 * @namespace
 * @constructor
 * @param {string|Buffer} src - `Recipe.Source.NEW` ("new", or `Buffer.from("new")`) for a new PDF,
 *   otherwise the path or Buffer of the PDF to edit.
 * @param {string} [output] - The output path. For a path source it defaults to
 *   the source path; for a Buffer source the result is only returned by
 *   `endPDF()` unless an output path is given.
 * @param {Object} [options] - The options for pdfDoc
 * @param {Object} [options.pdfa] - Write a new PDF as PDF/A, with the PDF
 *   version of the level, XMP metadata and an output intent.
 * @param {Recipe.PdfA} options.pdfa.level - The PDF/A level.
 * @param {Uint8Array|string} options.pdfa.iccProfile - The ICC profile of the
 *   output intent, or its path: an RGB, CMYK or gray profile, whose color
 *   space the document's colors must use.
 * @param {string} [options.pdfa.outputCondition="Custom"] - The output
 *   condition identifier, such as `sRGB IEC61966-2.1`.
 * @param {boolean} [options.xmp] - Write XMP metadata that mirrors the Info values of the PDF, in place of the packet of a source PDF that is edited.
 * @param {number} [options.version] - The PDF version of a new PDF: 1.0 through
 *   1.7 or 2.0, or 10 through 17 or 20. Other values fall back to 1.7.
 * @param {boolean} [options.compress=true] - Flate-compress the streams.
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
 * @throws {TypeError} If `pdfa` has an unknown level, an unusable profile or
 *   an `outputCondition` that is no string.
 * @throws {Error} If `pdfa` is given for a source PDF, with another
 *   `version`, or with encryption.
 */
class Recipe {
  constructor(...args) {
    // The platform turns its own arguments (a path, Buffer or bytes, an output
    // target, the options) into the source bytes, or null for a new PDF.
    const {
      source,
      output,
      options = {},
      name,
    } = this.platform.openArguments(args);
    this._source = source;
    this.filename = name;
    this.isNewPDF = source === null;
    this._target = output;
    this.encryptOptions = this._getEncryptOptions(options, this.isNewPDF);
    this.options = Object.assign({}, options, this.encryptOptions);
    this.current = {};
    this.current.defaultFontSize = 14;
    // Each Recipe registers colors in its own copy of the defaults; the
    // prototype keeps the defaults unchanged.
    this.knownColors = Object.fromEntries(
      Object.entries(this.knownColors).map(([space, colors]) => [
        space,
        { ...colors },
      ]),
    );

    this.textMarkupAnnotations = [
      AnnotSubtype.HIGHLIGHT,
      AnnotSubtype.UNDERLINE,
      AnnotSubtype.STRIKE_OUT,
      AnnotSubtype.SQUIGGLY,
    ];

    this.annotationsToWrite = [];
    this.annotations = [];
    this.vectorsToWrite = [];

    this.xObjects = [];

    this.needToEncrypt = false;

    this.needToInsertPages = false;

    this._setParameters(options);

    this.platform.loadFonts(this, options);
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
    const iccProfile = this.options.pdfa?.iccProfile;
    // 10 through 17 and 20 name 1.0 through 2.0, also for the PDF/A check.
    const options = [10, 11, 12, 13, 14, 15, 16, 17, 20].includes(
      this.options.version,
    )
      ? { ...this.options, version: this.options.version / 10 }
      : this.options;
    this.pdfa_ = pdfaOptions(
      options,
      iccProfile === undefined
        ? undefined
        : this.platform.readBytes(iccProfile),
      this.isNewPDF,
      Object.keys(this.encryptOptions || {}).length > 0,
    );
    var version = this._getVersion(
      this.pdfa_ ? this.pdfa_.version : options.version,
    );
    if (this.isNewPDF) {
      this._output = this.platform.newWriter(
        Object.assign(
          {},
          this.encryptOptions,
          { version },
          this._compression(),
        ),
      );
      this.writer = this._output.writer;
    } else {
      this.read();
      try {
        this._output = this.platform.modifyWriter(
          this._source,
          Object.assign(this._openOptions(), this._compression()),
          this,
        );
      } catch (err) {
        throw new Error(err);
      }
      this.writer = this._output.writer;
      // the fields and custom entries of the source, once, so that low-level
      // changes to the Info dictionary stick
      const source = this._readInfo();
      const infoDictionary = this.writer
        .getDocumentContext()
        .getInfoDictionary();
      standardInfoKeys.forEach((key) => {
        if (source[key]) infoDictionary[key] = source[key];
      });
      Object.entries(this.sourceCustomInfo_).forEach(([key, value]) =>
        infoDictionary.addAdditionalInfoEntry(key, value),
      );
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
    // 10 through 17 and 20 name the same versions as 1.0 through 2.0.
    if ([10, 11, 12, 13, 14, 15, 16, 17, 20].includes(version)) version /= 10;
    const supportedVersions = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.0];
    if (!supportedVersions.includes(version)) {
      version = 1.7;
    }
    version = this.muhammara[`ePDFVersion${version * 10}`];

    return version;
  }

  /**
   * The options a writer needs to open the source: its password only. The
   * encryption options apply to the finished output.
   * @private
   * @returns {Object} The options: `password` when the Recipe has one.
   */
  _openOptions() {
    const { password } = this.encryptOptions;
    return password === undefined ? {} : { password };
  }

  /**
   * The writer's stream compression option, when the Recipe was given one.
   * @private
   * @returns {Object} The option to pass to the writer: `compress` when given.
   * @throws {TypeError} If `compress` is given and is not a boolean.
   */
  _compression() {
    const { compress } = this.options;
    if (compress === undefined) return {};
    if (typeof compress !== "boolean") {
      throw new TypeError("compress must be a boolean");
    }
    return { compress };
  }

  /**
   * The current drawing position in Recipe coordinates, where y grows downward
   * from the top edge of the page. Without an active page it is the last
   * position of the previous page, or the origin before the first page.
   * @returns {{x: number, y: number}} The current position.
   */
  get position() {
    if (!this.pageNumber) return { ...(this._endedPosition ?? { x: 0, y: 0 }) };
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
   * The page count and the geometry of each page, keyed by one-based page
   * number, as `read()` returns them for the source.
   * @returns {Object} The metadata.
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * @name read
   * @function
   * @memberof Recipe#
   * @desc Read PDF metadata: the page count and, keyed by one-based page number,
   * each page's media box, rotation, layout and size.
   * @param {string|Uint8Array|ArrayBuffer} [inSrc] - A PDF to read instead of
   *   the recipe source: a path or bytes on native, bytes or a registered name
   *   on Wasm. Reading another PDF does not change the recipe state.
   * @returns {Object} The PDF metadata.
   * @throws {TypeError} If `inSrc` is not a path or bytes, on native.
   * @throws {Error} If the PDF cannot be read or has no pages.
   */
  read(inSrc) {
    const isForExternal = inSrc ? true : false;
    const src = this.platform.readerSource(
      isForExternal ? inSrc : this._source,
    );
    let pdfReader = null;
    let isAdopted = false;
    try {
      pdfReader = this.muhammara.createReader(src, this.encryptOptions);
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
          layout = PageLayout.LANDSCAPE;
        } else if (side1 < side2 && rotate % 180 !== 0) {
          layout = PageLayout.LANDSCAPE;
        } else {
          layout = PageLayout.PORTRAIT;
        }

        if (layout === PageLayout.LANDSCAPE) {
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
        this.sourceEncrypted_ = pdfReader.isEncrypted();
        this.pdfReader = pdfReader;
        this._metadata = metadata;
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
   * @name endPDF
   * @function
   * @memberof Recipe#
   * @desc End the pdfDoc. Finalization happens once; later calls do not rewrite the
   * PDF and invoke the callback with the completed output when applicable.
   * An active page is finished first, so a forgotten endPage() does not cost
   * that page. A failed finalization retires the Recipe and later calls
   * rethrow the original error.
   * @param {function(*): *} [callback] - Called when the PDF is finished, with
   *   what the platform hands over: the PDF bytes (a Uint8Array on Wasm; on
   *   native the Buffer for a Buffer source, its output path when it has one,
   *   and nothing for a path source).
   * @returns {*} Without a callback, what the callback would receive. With
   *   one, the callback's result on native, and the PDF bytes on Wasm.
   * @throws {Error} If pages are being deleted while a page is still open.
   * @throws {Error} If a PDF/A-4f document has no attached file.
   * @throws {Error} If finalization fails; later calls rethrow the same error.
   */
  endPDF(callback) {
    if (this.endError) {
      throw this.endError;
    }
    if (this.ended) {
      return this._endPDFResult(callback);
    }
    var deletingPages = Boolean(this.deletedPages?.size);
    var deletionState = deletingPages
      ? {
          metadata: this._metadata,
          metadataValues: { ...this._metadata },
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
      this._writeFormFills();
      // the annotation pass writes a new Info dictionary: carry the fields
      // and custom entries over
      const info = this.writer.getDocumentContext().getInfoDictionary();
      const fields = [...standardInfoKeys, "creator", "producer"].map((key) => [
        key,
        info[key],
      ]);
      const customInfo = info.getAdditionalInfoEntries();
      let bytes = this._output.finish();
      // Annotations are written in a second pass over the finished output,
      // because a copying context would overwrite the current one.
      if (
        (this.annotations && this.annotations.length > 0) ||
        (this.annotationsToWrite && this.annotationsToWrite.length > 0)
      ) {
        // the first pass ends with %%EOF, and the objects the second
        // appends must start on their own line (PDF/A)
        const firstPass = new Uint8Array(bytes.length + 2);
        firstPass.set(bytes);
        firstPass.set([13, 10], bytes.length);
        this._output = this.platform.modifyWriter(
          firstPass,
          Object.assign(this._openOptions(), this._compression()),
          this,
        );
        this.writer = this._output.writer;

        const infoDictionary = this.writer
          .getDocumentContext()
          .getInfoDictionary();
        fields.forEach(([key, value]) => {
          if (value) infoDictionary[key] = value;
        });
        Object.entries(customInfo).forEach(([key, value]) =>
          infoDictionary.addAdditionalInfoEntry(key, value),
        );
        this._writeAnnotations();
        this._writeInfo();
        bytes = this._output.finish();
      }

      this._releaseReader();

      if (this.needToInsertPages) {
        bytes = this._insertPages(bytes, fields, customInfo);
      }
      // An unencrypted source given passwords is encrypted as a new PDF is;
      // an encrypted source keeps its own encryption.
      if (
        !this.isNewPDF &&
        !this.sourceEncrypted_ &&
        this.encryptOptions.userPassword !== undefined
      ) {
        const { password, ...encryption } = this.encryptOptions;
        bytes = this.platform.recrypt(bytes, encryption);
      }
      if (this.needToEncrypt) {
        bytes = this._encrypt(bytes);
      }

      this.bytes_ = bytes;
      this.result_ = this.platform.deliver(this, bytes);
      this.ended = true;
    } catch (error) {
      if (deletingPages) {
        Object.keys(deletionState.metadata).forEach(
          (key) => delete deletionState.metadata[key],
        );
        Object.assign(deletionState.metadata, deletionState.metadataValues);
        this._metadata = deletionState.metadata;
        this.annotations = deletionState.annotations;
        this.annotationsToWrite = deletionState.annotationsToWrite;
        this.deletedPages = deletionState.deletedPages;
      }
      this.endError = error;
      this.ended = true;
      try {
        this.writer._abort?.();
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

    return this._endPDFResult(callback);
  }

  /**
   * What endPDF() returns: the callback's result, or the finished result when
   * there is no callback or the platform returns that (Wasm's typed bytes).
   * @private
   * @param {function(*): *} [callback] - The endPDF() callback.
   * @returns {*} The result.
   */
  _endPDFResult(callback) {
    if (!callback) return this.result_;
    const out = callback(this.result_);
    return this.platform.endPDFReturnsResult ? this.result_ : out;
  }

  /**
   * Register a callback procedure with MuhammaraJS.
   * @name register
   * @function
   * @memberof Recipe#
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

// Every module whose exports become Recipe methods. utils.js, xObjectForm.js
// and page-references.js hold private helpers for the modules that use them.
const recipeModules = {
  "annotation.js": m_annotation,
  "appendPage.js": m_appendPage,
  "colors.js": m_colors,
  "coordinate.js": m_coordinate,
  "encrypt.js": m_encrypt,
  "font.js": m_font,
  "form.js": m_form,
  "graphics-state.js": m_graphics_state,
  "htmlToTextObjects.js": m_htmlToTextObjects,
  "image.js": m_image,
  "info.js": m_info,
  "insertPage.js": m_insertPage,
  "overlay.js": m_overlay,
  "page.js": m_page,
  "parameters.js": m_parameters,
  "replaceText.js": m_replaceText,
  "shapes.js": m_shapes,
  "split.js": m_split,
  "table.js": m_table,
  "text.helper.js": m_text_helper,
  "text.js": m_text,
  "vector-line.js": m_vector_line,
  "vector-polygon.js": m_vector_polygon,
  "vector.helper.js": m_vector_helper,
  "vector.js": m_vector,
};

// Helpers the modules share with each other, not Recipe members.
// The text layout classes Column, Line and Word are internal too.
const privateExports = new Set([
  "linkPdf",
  "HtmlTag",
  "Column",
  "Line",
  "Word",
]);

/**
 * Install every method exported by the Recipe modules on the Recipe prototype.
 * @returns {void}
 * @throws {string} If two recipe modules export the same member.
 * @private
 */
function loadPrototypes() {
  for (const [file, module] of Object.entries(recipeModules)) {
    for (let key in module) {
      // Interop keys a CommonJS build of these modules adds are no members.
      if (privateExports.has(key) || key === "default" || key === "__esModule")
        continue;
      if (Recipe.prototype[key]) {
        throw `Found conflict prototypes=${key} in ${file}.`;
      }
      Recipe.prototype[key] = module[key];
    }
  }
}

loadPrototypes();

// Named values for string options, for example Recipe.AnnotSubtype.HIGHLIGHT.
// A CommonJS build adds a `default` interop key to the namespace; it is no
// constant.
const { default: _interop, ...constants } = recipeConstants;
Object.assign(Recipe, constants, { PdfA });

const SharedRecipe = Recipe;

/**
 * Create the Recipe class for one platform. Every call returns a new
 * subclass, so each package keeps its own low-level API, its own I/O and its
 * own `register()`ed callbacks; the Recipe methods reach them through
 * `this.platform` and `this.muhammara`.
 * @param {Object} platform - The platform: its low-level API as `muhammara`
 *   and its I/O hooks; packages/native-core/lib/Recipe.js documents each.
 * @param {Object} [platformConstants] - Platform constants added to the class.
 * @returns {Function} The Recipe class bound to that platform.
 * @private
 */
function createRecipe(platform, platformConstants = {}) {
  class Recipe extends SharedRecipe {}
  Recipe.prototype.platform = platform;
  Recipe.prototype.muhammara = platform.muhammara;
  // The shared constants are inherited statics.
  Object.assign(Recipe, platformConstants);
  return Recipe;
}

export { createRecipe, SharedRecipe as RecipeBase };
