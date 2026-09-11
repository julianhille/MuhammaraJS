import { mediumSizes } from "./parameters.js";
import { pageRecord } from "./page-record.js";

/** Creates Recipe page creation, inspection, and editing methods. */
export function createPageMethods(
  call,
  { createReader, createWriterToModify, module },
) {
  return {
    /**
     * Creates and activates a page, using dimensions in PDF points.
     * Named sizes are case-insensitive and fall back to the configured default;
     * a rotation not divisible by 180 swaps the named size's width and height.
     * The new page uses Recipe's top-left coordinate system, with x increasing
     * rightward and y increasing downward, and resets the cursor to `(0, 0)`.
     *
     * @name createPage
     * @function
     * @memberof Recipe#
     * @param {number|string} [width] - Page width, or a named page size.
     * @param {number} [height] - Page height, or rotation for a named size.
     * @param {RecipeMargins} [margins] - Margins for the new page.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the PDF has already been ended.
     */
    createPage: function (width, height, margins) {
      if (this._endedBytes)
        throw new Error("Cannot create a page after endPDF");
      if (typeof width === "string") {
        var rotation = height;
        var size =
          mediumSizes[width.toLowerCase().replace("-size", "")] ||
          this.default.pageSize;
        [width, height] = size;
        if (Number.isFinite(rotation) && rotation % 180 !== 0)
          [width, height] = [height, width];
        margins = arguments[2];
      } else if (width === undefined && height === undefined) {
        [width, height] = this.default.pageSize;
      } else {
        width = width === undefined ? this.default.pageSize[0] : width;
        height = height === undefined ? this.default.pageSize[1] : height;
      }
      if (this._sourceMode) {
        this._page = this.writer.createPage(0, 0, width, height);
        this._pageContext = this.writer.startPageContentContext(this._page);
      } else {
        call("_muhammara_wasm_recipe_add_page", this._recipe, width, height);
      }
      var page = pageRecord(this._pages.length + 1, [0, 0, width, height]);
      this._pages.push(page);
      if (this.metadata) {
        this.metadata.pages = this._pages.length;
        this.metadata[page.pageNumber] = {
          ...page,
          mediaBox: page.mediaBox.slice(),
          size: page.size.slice(),
        };
      }
      this._activePageNumber = page.pageNumber;
      this._pageWidth = width;
      this._pageHeight = height;
      this.margins(margins || this.default.pageMargin);
      // Node Recipe initializes pages as if moveTo(0, 0) was called. Implicit
      // text and layout still use their margin fallbacks when the cursor is zero.
      this._cursor = { x: 0, y: 0 };
      return this;
    },

    /**
     * Finishes the active new or edited page and flushes its annotations.
     * Calling this method without an active page has no effect. The active page
     * dimensions are cleared, so page drawing must resume on another active page.
     *
     * @name endPage
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The Recipe instance.
     */
    endPage: function () {
      if (this._editingPage) {
        this._flushAnnotations();
        if (this._pageContext) {
          this._page.endContext();
          this._page.writePage();
        }
        this._pageContext = null;
        this._page = null;
        this._editingPage = false;
        this._pageHeight = 0;
        this._pageWidth = 0;
        return this;
      }
      if (this._sourceMode) {
        if (!this._pageContext) return this;
        this._flushAnnotations();
        this.writer.writePage(this._page);
        this._pageContext = null;
        this._page = null;
        this._pageHeight = 0;
        this._pageWidth = 0;
        return this;
      }
      if (!this._recipe || !this._pageHeight) return this;
      this._flushAnnotations();
      call("_muhammara_wasm_recipe_end_page", this._recipe);
      this._pageHeight = 0;
      this._pageWidth = 0;
      return this;
    },

    /**
     * Gets or updates the margins used by implicit positioning and layout.
     * Margins are measured inward in PDF points from the page edges in Recipe's
     * top-left coordinate system. Omitted values retain their current settings.
     *
     * @name margins
     * @function
     * @memberof Recipe#
     * @param {number|RecipeMargins} [left] - Left margin, or margins to update.
     * @param {number} [right] - Right margin.
     * @param {number} [top] - Top margin.
     * @param {number} [bottom] - Bottom margin.
     * @returns {Recipe|Required<RecipeMargins>} The Recipe instance when a margin changes; otherwise a copy of the current margins.
     */
    margins: function (left, right, top, bottom) {
      if (left && typeof left === "object")
        ({ left, right, top, bottom } = left);
      var changed = false;
      ["left", "right", "top", "bottom"].forEach((key, index) => {
        var value = [left, right, top, bottom][index];
        if (value !== undefined) {
          this._margin[key] = value;
          changed = true;
        }
      });
      return changed ? this : { ...this._margin };
    },

    /**
     * Returns geometry for a one-based page number without changing active state.
     * Width and height follow Recipe's rotated, top-left coordinate space;
     * `mediaBox` remains the page's native PDF rectangle.
     *
     * @name pageInfo
     * @function
     * @memberof Recipe#
     * @param {number} pageNumber - One-based page number.
     * @returns {RecipePageInfo|null} A defensive copy of the page geometry, or null when the page does not exist.
     */
    pageInfo: function (pageNumber) {
      var page = this._pages[pageNumber - 1];
      return page
        ? { ...page, mediaBox: page.mediaBox.slice(), size: page.size.slice() }
        : null;
    },

    /**
     * Returns the document information dictionary without changing page state.
     * This method reports PDF metadata, not Recipe-coordinate page geometry;
     * use {@link Recipe#pageInfo} or {@link Recipe#getCurrentPageInfo} for geometry.
     *
     * @name getPageInfo
     * @function
     * @memberof Recipe#
     * @returns {Record<string, unknown>|InfoDictionary} The current document information dictionary.
     */
    getPageInfo: function () {
      return this._sourceMode
        ? this.writer.getDocumentContext().getInfoDictionary()
        : this.info();
    },

    /**
     * Returns geometry for the active or most recently known Recipe page.
     * Width and height follow Recipe's rotated, top-left coordinate space;
     * `mediaBox` remains the page's native PDF rectangle. No state is changed.
     *
     * @name getCurrentPageInfo
     * @function
     * @memberof Recipe#
     * @returns {RecipePageInfo|null} A defensive copy of the page geometry, or null when no page is known.
     */
    getCurrentPageInfo: function () {
      return this.pageInfo(this._activePageNumber || this._pages.length);
    },

    /**
     * Inspects source bytes and closes the temporary reader.
     * @private
     */
    _inspectBytes: function (bytes) {
      var reader = createReader(bytes);
      var pages = [];
      var sourceInfo = {};
      try {
        for (var index = 0; index < reader.getPagesCount(); index += 1) {
          var info = reader.getPageInfo(index);
          pages.push(pageRecord(index + 1, info.mediaBox, info.rotate));
        }
        var info = reader
          .queryDictionaryObject(reader.getTrailer(), "Info")
          ?.toPDFDictionary()
          ?.toJSObject();
        if (info) {
          Object.entries(info).forEach(([key, value]) => {
            var text = value.toPDFLiteralString?.()?.toText?.();
            if (!text) return;
            sourceInfo[
              {
                CreationDate: "creationDate",
                ModDate: "modDate",
                Creator: "creator",
                Producer: "producer",
              }[key] || key.toLowerCase()
            ] = text;
          });
        }
      } finally {
        reader.end();
      }
      var metadata = { pages: pages.length };
      pages.forEach((page) => {
        metadata[page.pageNumber] = {
          ...page,
          mediaBox: page.mediaBox.slice(),
          size: page.size.slice(),
        };
      });
      return { pages, metadata, sourceInfo };
    },

    /**
     * Inspects a PDF without replacing or otherwise changing this Recipe's output state.
     * Reported page width and height use Recipe's rotated, top-left coordinate
     * space, while each `mediaBox` is the native PDF rectangle.
     *
     * @name read
     * @function
     * @memberof Recipe#
     * @param {ByteSource} bytes - PDF bytes to inspect synchronously.
     * @returns {RecipeMetadata} Page count and one-based page geometry records.
     * @throws {Error} If the bytes cannot be opened as a PDF.
     */
    read: function (bytes) {
      // Like Node Recipe.read(externalSource), inspection must not replace output state.
      return this._inspectBytes(bytes).metadata;
    },

    /**
     * Opens bytes as this Recipe's modification source and replaces output state.
     * @private
     */
    _openSource: function (bytes) {
      var { pages, metadata, sourceInfo } = this._inspectBytes(bytes);
      if (this._recipe) {
        module._muhammara_wasm_recipe_destroy(this._recipe);
        this._recipe = 0;
      }
      this.writer = createWriterToModify(bytes, {
        version: this._version,
        compress: this.options.compress !== false,
      });
      this._sourceMode = true;
      this._isNewPDF = false;
      this._pages = pages;
      this._sourceBytes = bytes;
      this._sourceInfo = sourceInfo;
      this._info = { ...sourceInfo };
      this.metadata = metadata;
      return metadata;
    },

    /**
     * Starts a prepend-safe content context for an existing one-based page.
     * Drawing uses Recipe's top-left coordinates, including the page's rotation;
     * the cursor moves to the configured left and top margins. The edit remains
     * active until {@link Recipe#endPage} is called.
     *
     * @name editPage
     * @function
     * @memberof Recipe#
     * @param {number} pageNumber - One-based page number to edit.
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the Recipe was not constructed from PDF bytes or another page is active.
     * @throws {RangeError} If `pageNumber` does not identify an existing page.
     */
    editPage: function (pageNumber) {
      if (!this._sourceMode) {
        throw new Error(
          "editPage requires a Recipe constructed from PDF bytes",
        );
      }
      if (this._editingPage || this._pageHeight) {
        throw new Error("Finish the current page before editing another page");
      }
      if (
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > this._pages.length
      ) {
        throw new RangeError("pageNumber must identify an existing page");
      }
      var page = this.pageInfo(pageNumber);
      this._page = this.writer.createPageModifier(pageNumber - 1, true);
      this._pageContext = this._page.startContext().getContext();
      this._editingPage = true;
      this._activePageNumber = pageNumber;
      this._pageWidth = page.width;
      this._pageHeight = page.height;
      this._cursor = { x: this._margin.left, y: this._margin.top };
      this._resumePageRotation();
      return this;
    },

    /**
     * Writes and pauses the active edited-page content context.
     * Page editing remains active, and a later resume restores the page's
     * rotated, top-left Recipe coordinate transform.
     *
     * @name pauseContext
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active edited-page content context.
     */
    pauseContext: function () {
      if (!this._editingPage || !this._pageContext) {
        throw new Error("No active page content context to pause");
      }
      this._page.endContext();
      this._page.writePage();
      this._page = null;
      this._pageContext = null;
      return this;
    },

    /**
     * Resumes a paused edited-page content context.
     * The page rotation transform is reapplied so subsequent drawing continues
     * in Recipe's top-left coordinate system.
     *
     * @name resumeContext
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If no edited page is paused, or its context is already active.
     */
    resumeContext: function () {
      if (!this._editingPage || this._pageContext) {
        throw new Error("No paused page content context to resume");
      }
      this._page = this.writer.createPageModifier(
        this._activePageNumber - 1,
        true,
      );
      this._pageContext = this._page.startContext().getContext();
      this._resumePageRotation();
      return this;
    },

    /**
     * Restores the active page's Recipe coordinate transform after resuming.
     * @private
     */
    _resumePageRotation: function () {
      var page = this.getCurrentPageInfo();
      if (!page || !page.rotate) return this;
      if (page.rotate === 90 || page.rotate === -270) {
        this._pageContext.cm(
          0,
          1,
          -1,
          0,
          page.height - page.offsetX,
          page.offsetY,
        );
      } else if (page.rotate === 180 || page.rotate === -180) {
        this._pageContext.cm(-1, 0, 0, -1, page.width, page.height);
      } else if (page.rotate === 270 || page.rotate === -90) {
        this._pageContext.cm(
          0,
          -1,
          1,
          0,
          page.offsetX,
          page.width - page.offsetY,
        );
      }
      return this;
    },
  };
}

/** Updates the active Recipe page metadata after changing its media box. */
export function updateMediaBox(recipe, mediaBox) {
  var page = recipe._pages[recipe._pages.length - 1];
  if (!page) return;
  Object.assign(page, pageRecord(page.pageNumber, mediaBox, page.rotate));
  recipe._pageWidth = page.width;
  recipe._pageHeight = page.height;
}
