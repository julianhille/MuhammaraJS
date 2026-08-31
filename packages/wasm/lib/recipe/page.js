import { mediumSizes } from "./parameters.js";
import { pageRecord } from "./page-record.js";

export function createPageMethods(
  call,
  { createReader, createWriterToModify, module },
) {
  return {
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

    pageInfo: function (pageNumber) {
      var page = this._pages[pageNumber - 1];
      return page
        ? { ...page, mediaBox: page.mediaBox.slice(), size: page.size.slice() }
        : null;
    },

    getPageInfo: function () {
      return this._sourceMode
        ? this.writer.getDocumentContext().getInfoDictionary()
        : this.info();
    },

    /** Returns Recipe's page geometry for the active page, unlike getPageInfo(). */
    getCurrentPageInfo: function () {
      return this.pageInfo(this._activePageNumber || this._pages.length);
    },

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

    read: function (bytes) {
      // Like Node Recipe.read(externalSource), inspection must not replace output state.
      return this._inspectBytes(bytes).metadata;
    },

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

export function updateMediaBox(recipe, mediaBox) {
  var page = recipe._pages[recipe._pages.length - 1];
  if (!page) return;
  Object.assign(page, pageRecord(page.pageNumber, mediaBox, page.rotate));
  recipe._pageWidth = page.width;
  recipe._pageHeight = page.height;
}
