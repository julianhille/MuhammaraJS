import { constants } from "../constants.js";

/** Creates Recipe methods for composing registered PDF files. */
export function createCompositionMethods({
  module,
  pdfs,
  withString,
  call,
  inspectPdf,
}) {
  return {
    /**
     * Appends selected pages from a registered PDF.
     * Page numbers and inclusive range endpoints are one-based. Omit `pages`
     * to append every page; out-of-bounds endpoints are clamped to the source.
     * Appended pages immediately become part of the output and page metadata.
     *
     * @name appendPage
     * @function
     * @memberof Recipe#
     * @param {string} name Registered PDF name.
     * @param {RecipePageSelection} [pages=[]] A one-based page number or an
     * array of page numbers and inclusive ranges. Ranges must be nested, so
     * `[1, 3]` selects pages 1 and 3 while `[[1, 3]]` selects pages 1 through 3.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If no PDF is registered under `name` or appending fails.
     * @throws {RangeError} If a selection is not an integer range in ascending
     * order after endpoint clamping.
     */
    appendPage: function (name, pages = []) {
      var path = pdfs.get(name);
      if (!path) throw new Error(`Unknown PDF: ${name}`);
      var source = inspectPdf(name);
      if (!Array.isArray(pages)) pages = [pages];
      var ranges = pages.map((page) => {
        var range = Array.isArray(page) ? page : [page, page];
        range = range.map((number) =>
          Math.min(source.pages, Math.max(1, Number(number))),
        );
        if (!range.every(Number.isInteger) || range[1] < range[0])
          throw new RangeError(
            "Page ranges use one-based inclusive page numbers",
          );
        return [range[0] - 1, range[1] - 1];
      });
      if (this._sourceMode) {
        var copiedPages = [];
        (ranges.length ? ranges : [[0, source.pages - 1]]).forEach(
          ([start, end]) => {
            for (var index = start; index <= end; index += 1)
              copiedPages.push(source[index + 1]);
          },
        );
        this.writer.appendPDFPagesFromPDF(
          module.FS.readFile(path),
          ranges.length
            ? { type: constants.eRangeTypeSpecific, specificRanges: ranges }
            : {},
        );
        copiedPages.forEach((page) => {
          var pageNumber = this._pages.length + 1;
          this._pages.push({
            ...page,
            pageNumber,
            mediaBox: page.mediaBox.slice(),
            size: page.size.slice(),
          });
          this.metadata.pages = pageNumber;
          this.metadata[pageNumber] = this._pages[pageNumber - 1];
        });
        return this;
      }
      return withString(path, (pathPointer) => {
        if (pages.length === 0) {
          call("_muhammara_wasm_recipe_append_pdf", this._recipe, pathPointer);
        } else {
          pages.forEach((page) => {
            var range = Array.isArray(page) ? page : [page, page];
            range = range.map((number) =>
              Math.min(source.pages, Math.max(1, Number(number))),
            );
            if (!range.every(Number.isInteger) || range[1] < range[0])
              throw new RangeError(
                "Page ranges use one-based inclusive page numbers",
              );
            call(
              "_muhammara_wasm_recipe_append_pdf_range",
              this._recipe,
              pathPointer,
              range[0] - 1,
              range[1] - 1,
            );
          });
        }
        return this;
      });
    },

    /**
     * Draws a page from a registered PDF over the active page.
     * Coordinates use Recipe's top-left origin. The overlay is written into the
     * active page content.
     *
     * @name overlay
     * @function
     * @memberof Recipe#
     * @param {string} name Registered PDF name.
     * @param {number|RecipeOverlayOptions} [x=0] Left coordinate in Recipe
     * coordinates, or options for the two-argument form.
     * @param {number|RecipeOverlayOptions} [y=0] Top coordinate in Recipe
     * coordinates, or options when `x` is supplied.
     * @param {RecipeOverlayOptions} [options={}] Source page, scale, aspect
     * ratio, and page-fitting options. Source page numbers are one-based.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If no PDF is registered under `name` or drawing fails.
     */
    overlay: function (name, x = 0, y = 0, options = {}) {
      if (typeof x === "object") {
        options = x;
        x = 0;
        y = 0;
      } else if (typeof y === "object") {
        options = y;
        y = 0;
      }
      var path = pdfs.get(name);
      if (!path) throw new Error(`Unknown PDF: ${name}`);
      var page = options.page || 1;
      var source = inspectPdf(name);
      if (!Number.isInteger(page) || page < 1 || page > source.pages) page = 1;
      var dimensions = source[page];
      var scale = options.scale || 1;
      var width = dimensions.width * scale;
      var height = dimensions.height * scale;
      if (options.fitWidth) {
        width = this._pageWidth;
        height =
          options.keepAspectRatio === false
            ? height
            : (width * dimensions.height) / dimensions.width;
      }
      if (options.fitHeight) {
        height = this._pageHeight;
        width =
          options.keepAspectRatio === false
            ? width
            : (height * dimensions.width) / dimensions.height;
      }
      var point = this._calibrateCoordinate
        ? this._calibrateCoordinate(x, y, 0, -height)
        : { nx: x, ny: this._pageHeight - y - height };
      if (this._sourceMode) {
        this._pageContext.drawImage(
          point.nx,
          point.ny,
          module.FS.readFile(path),
          {
            transformation: {
              width,
              height,
              proportional: options.keepAspectRatio !== false,
              fit: "always",
            },
          },
        );
        return this;
      }
      return withString(path, (pathPointer) => {
        call(
          "_muhammara_wasm_recipe_image_page",
          this._recipe,
          pathPointer,
          point.nx,
          point.ny,
          width,
          height,
          page - 1,
        );
        return this;
      });
    },

    /**
     * Schedules a page from a registered PDF for insertion in the output.
     * `afterPageNumber` is zero to insert before the first page, or a one-based
     * output page number. `sourcePageNumber` is one-based. The insertion is
     * deferred until `endPDF()` rebuilds the output.
     *
     * @name insertPage
     * @function
     * @memberof Recipe#
     * @param {number} afterPageNumber Output position after which to insert.
     * @param {string} name Registered source PDF name.
     * @param {number} sourcePageNumber One-based source page number.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If `afterPageNumber` is not a non-negative integer.
     * @throws {TypeError} If the PDF is not registered or the source page is
     * not a positive integer.
     */
    insertPage: function (afterPageNumber, name, sourcePageNumber) {
      if (!Number.isInteger(afterPageNumber) || afterPageNumber < 0)
        throw new Error("The afterPageNumber is inValid.");
      if (
        !pdfs.has(name) ||
        !Number.isInteger(sourcePageNumber) ||
        sourcePageNumber < 1
      )
        throw new TypeError(
          "insertPage requires a registered PDF and one-based source page",
        );
      (this._insertions ||= new Map()).set(afterPageNumber, [
        ...((this._insertions && this._insertions.get(afterPageNumber)) || []),
        { name, sourcePageNumber },
      ]);
      return this;
    },
  };
}

/** Creates Recipe's endPDF implementation, including deferred page insertions. */
export function createEndPDF({
  endPDF,
  state,
  registerPdf,
  unregisterPdf,
  inspectPdf,
  createRecipe,
  recrypt,
}) {
  /**
   * Finishes the Recipe and returns its PDF bytes.
   * Deferred page insertions rebuild the document and configured encryption is
   * applied. Repeated calls return cached finished bytes.
   *
   * @name endPDF
   * @function
   * @memberof Recipe#
   * @param {function(Uint8Array): void} [callback] Callback invoked with the
   * same finished bytes that are returned.
   * @returns {Uint8Array} Finished PDF bytes.
   * @throws {TypeError} If `callback` is supplied but is not a function.
   * @throws {Error} If a page is still active or a PDF operation fails.
   */
  return function (callback) {
    if (callback !== undefined && typeof callback !== "function") {
      throw new TypeError("endPDF callback must be a function");
    }
    var bytes = endPDF(this);
    if (!this._insertions || this._rebuiltBytes) {
      bytes = this._rebuiltBytes || bytes;
      if (this.encryption_ && Object.keys(this.encryption_).length) {
        if (!this._encryptedBytes)
          this._encryptedBytes = recrypt(bytes, this.encryption_);
        bytes = this._encryptedBytes;
      }
      if (callback) callback(bytes);
      return bytes;
    }
    var sourceName = `insert-${state.nextPdf++}`;
    registerPdf(sourceName, bytes);
    try {
      var rebuilt = createRecipe({
        version: this.options.version,
        compress: this.options.compress,
      });
      var pages = inspectPdf(sourceName).pages;
      for (var page = 0; page <= pages; page += 1) {
        var inserts = this._insertions.get(page) || [];
        inserts.forEach(({ name, sourcePageNumber }) =>
          rebuilt.appendPage(name, sourcePageNumber),
        );
        if (page < pages) rebuilt.appendPage(sourceName, page + 1);
      }
      this._rebuiltBytes = rebuilt.endPDF();
    } finally {
      unregisterPdf(sourceName);
    }
    this._outputPages =
      pages +
      Array.from(this._insertions.values()).reduce(
        (count, inserts) => count + inserts.length,
        0,
      );
    if (this.encryption_ && Object.keys(this.encryption_).length) {
      this._encryptedBytes = recrypt(this._rebuiltBytes, this.encryption_);
    }
    bytes = this._encryptedBytes || this._rebuiltBytes;
    if (callback) callback(bytes);
    return bytes;
  };
}

/** Creates a function that splits a registered PDF into one-page outputs. */
export function createSplitPdf({
  module,
  pdfs,
  withString,
  call,
  createRecipe,
}) {
  /**
   * Splits a registered PDF into one-page PDF byte arrays.
   * Output names and source page traversal use one-based page numbers.
   * This does not modify an existing Recipe; each result is separately built
   * and finished.
   *
   * @name splitPdf
   * @function
   * @memberof Recipe
   * @param {string} name Registered PDF name.
   * @param {string} [prefix="page"] Prefix used for each output filename.
   * @returns {RecipeSplitResult[]} One result per source page, in page order.
   * @throws {Error} If no PDF is registered under `name`, the PDF cannot be
   * parsed, or an output PDF cannot be created.
   */
  return function splitPdf(name, prefix = "page") {
    var path = pdfs.get(name);
    if (!path) throw new Error(`Unknown PDF: ${name}`);
    var reader = withString(path, (pathPointer) =>
      module._muhammara_wasm_reader_create(pathPointer),
    );
    if (!reader) throw new Error("Unable to parse PDF");
    var pages;
    try {
      pages = module._muhammara_wasm_reader_get_pages_count(reader);
    } finally {
      module._muhammara_wasm_reader_destroy(reader);
    }
    var output = [];
    for (var index = 0; index < pages; index += 1) {
      var recipe = createRecipe();
      withString(path, (pathPointer) => {
        call(
          "_muhammara_wasm_recipe_append_pdf_range",
          recipe._recipe,
          pathPointer,
          index,
          index,
        );
      });
      output.push({
        name: `${prefix}-${index + 1}.pdf`,
        bytes: recipe.endPDF(),
      });
    }
    return output;
  };
}

/** Creates a function that reports basic structure for the finished PDF. */
export function createStructure() {
  /**
   * Reports basic structure for the finished PDF.
   * Calling this method finishes the Recipe via `endPDF()`.
   *
   * @name structure
   * @function
   * @memberof Recipe#
   * @param {RecipeStructureFormat} [format="string"] Output format.
   * @returns {string|RecipeStructure} A text summary, or structured page,
   * encryption, and indirect-object counts for JSON output.
   * @throws {Error} If the Recipe cannot be finished.
   */
  return function (format = "string") {
    var bytes = this.endPDF();
    var text = new TextDecoder().decode(bytes);
    var objects = (text.match(/\n\d+ \d+ obj\b/g) || []).length;
    if (format === "json" || format?.json) {
      return {
        pages: this._outputPages || this._pages.length,
        encrypted: /\/Encrypt\b/.test(text),
        objects,
      };
    }
    return `Info\nRoot\nSize: ${objects}\nPages: ${this._outputPages || this._pages.length}`;
  };
}
