const muhammara = require("../muhammara");

function readPageTree(
  parser,
  objectID,
  deletedPageIDs,
  generation = 0,
  visited = new Set(),
  depth = 0,
) {
  if (depth > 1000 || visited.has(objectID)) {
    throw new Error("deletePage requires a valid acyclic page tree");
  }
  visited.add(objectID);
  const dictionary = parser.parseNewObject(objectID).toPDFDictionary();
  const values = dictionary.toJSObject();
  const kids = parser.queryDictionaryObject(dictionary, "Kids").toPDFArray();
  const children = kids.toJSArray().map((entry) => {
    const reference = entry.toPDFIndirectObjectReference();
    const childID = reference.getObjectID();
    const childDictionary = parser.parseNewObject(childID).toPDFDictionary();
    const type = childDictionary.toJSObject().Type.toPDFName().value;
    if (type === "Pages") {
      return readPageTree(
        parser,
        childID,
        deletedPageIDs,
        reference.getVersion(),
        visited,
        depth + 1,
      );
    }
    return deletedPageIDs.has(childID)
      ? null
      : {
          objectID: childID,
          generation: reference.getVersion(),
          count: 1,
        };
  });

  return {
    objectID,
    generation,
    values,
    children: children.filter((child) => child && child.count),
    count: children.reduce((count, child) => count + (child?.count || 0), 0),
  };
}

function writePageTree(writer, copyingContext, node) {
  node.children
    .filter((child) => child.children)
    .forEach((child) => writePageTree(writer, copyingContext, child));

  const objectsContext = writer.getObjectsContext();
  objectsContext.startModifiedIndirectObject(node.objectID);
  const dictionary = objectsContext.startDictionary();
  Object.keys(node.values).forEach((key) => {
    if (key === "Count" || key === "Kids") return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(node.values[key]);
  });
  dictionary.writeKey("Count");
  objectsContext.writeNumber(node.count);
  dictionary.writeKey("Kids");
  objectsContext.startArray();
  node.children.forEach((child) => {
    objectsContext.writeIndirectObjectReference(
      child.objectID,
      child.generation || 0,
    );
  });
  objectsContext.endArray().endDictionary(dictionary).endIndirectObject();
}

function collectPageLabels(
  parser,
  dictionary,
  entries,
  visited = new Set(),
  objectID = 0,
  depth = 0,
) {
  if (depth > 1000 || (objectID && visited.has(objectID))) {
    throw new Error("deletePage requires valid acyclic PageLabels");
  }
  if (objectID) visited.add(objectID);
  const values = dictionary.toJSObject();
  if (values.Nums) {
    const numbersArray = parser
      .queryDictionaryObject(dictionary, "Nums")
      .toPDFArray();
    const numbers = numbersArray.toJSArray();
    for (let index = 0; index < numbers.length; index += 2) {
      entries.push({
        index: numbers[index].toNumber(),
        value: readPageLabel(parser.queryArrayObject(numbersArray, index + 1)),
      });
    }
  }
  if (values.Kids) {
    parser
      .queryDictionaryObject(dictionary, "Kids")
      .toPDFArray()
      .toJSArray()
      .forEach((entry) => {
        const objectID = entry.toPDFIndirectObjectReference().getObjectID();
        collectPageLabels(
          parser,
          parser.parseNewObject(objectID).toPDFDictionary(),
          entries,
          visited,
          objectID,
          depth + 1,
        );
      });
  }
  return values;
}

function readPageLabel(value) {
  const dictionary = value?.toPDFDictionary();
  if (!dictionary) {
    throw new Error("deletePage requires valid PageLabels entries");
  }
  const values = dictionary.toJSObject();
  const prefixHex = values.P?.toPDFHexString();
  const prefixLiteral = values.P?.toPDFLiteralString();
  return {
    style: values.S?.toPDFName()?.value,
    prefix:
      values.P === undefined
        ? undefined
        : {
            bytes: (prefixHex || prefixLiteral).toBytesArray(),
            isHex: Boolean(prefixHex),
          },
    start: values.St?.toNumber(),
  };
}

function writePageLabelObjects(objectsContext, entries) {
  return entries.map((entry) => {
    const objectID = objectsContext.startNewIndirectObject();
    const dictionary = objectsContext.startDictionary();
    if (entry.value.style !== undefined) {
      dictionary.writeKey("S");
      objectsContext.writeName(entry.value.style);
    }
    if (entry.value.prefix !== undefined) {
      dictionary.writeKey("P");
      objectsContext[
        entry.value.prefix.isHex ? "writeHexString" : "writeLiteralString"
      ](entry.value.prefix.bytes);
    }
    if (entry.value.start !== undefined) {
      dictionary.writeKey("St");
      objectsContext.writeNumber(entry.value.start);
    }
    objectsContext.endDictionary(dictionary).endIndirectObject();
    return { index: entry.index, objectID };
  });
}

function writePageLabelsDictionary(
  objectsContext,
  copyingContext,
  dictionary,
  values,
  entries,
) {
  Object.keys(values).forEach((key) => {
    if (key === "Kids" || key === "Limits" || key === "Nums") return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(values[key]);
  });
  dictionary.writeKey("Nums");
  objectsContext.startArray();
  entries.forEach((entry) => {
    objectsContext.writeNumber(entry.index);
    objectsContext.writeIndirectObjectReference(entry.objectID);
  });
  objectsContext.endArray();
}

function preparePageLabels(
  parser,
  catalogDictionary,
  deletedPages,
  retainedPageCount,
) {
  const catalogValues = catalogDictionary.toJSObject();
  if (!catalogValues.PageLabels || catalogValues.PageLabels.toPDFNull()) {
    return null;
  }

  const labelsDictionary = parser
    .queryDictionaryObject(catalogDictionary, "PageLabels")
    .toPDFDictionary();
  if (!labelsDictionary) {
    throw new Error("deletePage requires PageLabels to be a number tree");
  }
  const entries = [];
  const reference = catalogValues.PageLabels.toPDFIndirectObjectReference();
  const values = collectPageLabels(
    parser,
    labelsDictionary,
    entries,
    new Set(),
    reference?.getObjectID(),
  );
  const mappedEntries = new Map();
  entries
    .sort((left, right) => left.index - right.index)
    .forEach((entry) => {
      const deletedBefore = Array.from(deletedPages).filter(
        (pageNumber) => pageNumber - 1 < entry.index,
      ).length;
      const index = entry.index - deletedBefore;
      if (index < retainedPageCount) mappedEntries.set(index, entry.value);
    });
  const normalized = Array.from(mappedEntries, ([index, value]) => ({
    index,
    value,
  }));
  return {
    catalogValues,
    reference,
    values,
    entries: normalized,
  };
}

function writePageLabels(writer, copyingContext, rootID, pageLabels) {
  if (!pageLabels) return;

  const objectsContext = writer.getObjectsContext();
  const entries = writePageLabelObjects(objectsContext, pageLabels.entries);
  if (pageLabels.reference) {
    objectsContext.startModifiedIndirectObject(
      pageLabels.reference.getObjectID(),
    );
    const dictionary = objectsContext.startDictionary();
    writePageLabelsDictionary(
      objectsContext,
      copyingContext,
      dictionary,
      pageLabels.values,
      entries,
    );
    objectsContext.endDictionary(dictionary).endIndirectObject();
    return;
  }

  const labelsObjectID = objectsContext.startNewIndirectObject();
  const labelsDictionary = objectsContext.startDictionary();
  writePageLabelsDictionary(
    objectsContext,
    copyingContext,
    labelsDictionary,
    pageLabels.values,
    entries,
  );
  objectsContext.endDictionary(labelsDictionary).endIndirectObject();

  if (writer._setPageLabelsObject) {
    writer._setPageLabelsObject(labelsObjectID);
    return;
  }

  objectsContext.startModifiedIndirectObject(rootID);
  const dictionary = objectsContext.startDictionary();
  Object.keys(pageLabels.catalogValues).forEach((key) => {
    if (key === "PageLabels") return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(pageLabels.catalogValues[key]);
  });
  dictionary.writeKey("PageLabels");
  objectsContext.writeIndirectObjectReference(labelsObjectID);
  objectsContext.endDictionary(dictionary).endIndirectObject();
}

/**
 * Create a new page, specifying either actual width and height, or the name
 * of a supported page size (eg. 'letter', 'letter-size')
 * '-size' will be removed from string but is discouraged to use.
 * @name createPage
 * @function
 * @memberof Recipe#
 * @param {number|string} [pageWidth] - The page width, or name of medium size.
 * Known named medium sizes: executive, folio, legal, letter, ledger, tabloid, a0-a10, b0-b10, c0-c10, ra0-ra4, sra0-ara4
 * @param {number} [pageHeight] - The page height, or rotation (90) when page size name given.
 * @param {object} [margins] - page margin definitions.
 * @param {number} [margins.left] - Left margin.
 * @param {number} [margins.right] - Right margin.
 * @param {number} [margins.top] - Top margin.
 * @param {number} [margins.bottom] - Bottom margin.
 * @returns {Recipe} The recipe instance.
 */
exports.createPage = function createPage(pageWidth, pageHeight, margins) {
  if (this.deletedPages?.size) {
    throw new Error("createPage cannot be combined with deletePage");
  }
  if (!pageWidth && !pageHeight) {
    [pageWidth, pageHeight] = this.default.pageSize;
  } else if (
    pageWidth &&
    !isNaN(pageWidth) &&
    pageHeight &&
    !isNaN(pageHeight)
  ) {
    pageWidth = pageWidth || this.default.pageSize[0];
    pageHeight = pageHeight || this.default.pageSize[1];
  } else if (typeof pageWidth === "string") {
    const rotate = pageHeight;
    const pageType = pageWidth.toLowerCase().replace("-size", "");
    const pageSize = this.default.mediumSizes[pageType];

    if (pageSize) {
      [pageWidth, pageHeight] = pageSize;
    } else {
      [pageWidth, pageHeight] = this.default.pageSize;
    }

    if (rotate && !isNaN(rotate)) {
      if (rotate % 180 != 0) {
        // swap width and height
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }
    }
  }
  // from 0
  this.metadata.pageCount += 1;
  const pageNumber = this.metadata.pageCount;
  const dimensions = [0, 0, pageWidth, pageHeight];
  const layout = pageWidth > pageHeight ? "landscape" : "portrait";
  this.metadata[pageNumber] = {
    pageNumber,
    mediaBox: dimensions,
    layout,
    rotate: 0,
    width: pageWidth,
    height: pageHeight,
  };

  const page = this.writer.createPage();
  page.mediaBox = [0, 0, pageWidth, pageHeight];

  this.page = page;
  this.pageNumber = pageNumber;
  this.pageContext = this.writer.startPageContentContext(this.page);
  this.editingPage = false;
  this.contextState = "active-new";
  if (!this.isNewPDF) this.pagesCreated = true;

  if (margins) {
    this.margins(margins);
  }

  this.moveTo(0, 0);
  return this;
};

/**
 * Set the rotation of the current page.
 * @name rotate
 * @function
 * @memberof Recipe#
 * @param {number} rotation - The page rotation in degrees.
 * @returns {Recipe} The recipe instance.
 */
exports.rotate = function rotate(rotation) {
  this.page.rotate = rotation;
  this.metadata[this.pageNumber].rotate = rotation;
  return this;
};

/**
 * Set a page box on the active new page.
 * @name setPageBox
 * @function
 * @memberof Recipe#
 * @param {number} box - An `ePDFPageBox*` constant.
 * @param {number} left - The PDF left coordinate.
 * @param {number} bottom - The PDF bottom coordinate.
 * @param {number} right - The PDF right coordinate.
 * @param {number} top - The PDF top coordinate.
 * @returns {Recipe} The recipe instance.
 * @throws {RangeError} If the page box constant is unknown.
 */
exports.setPageBox = function setPageBox(box, left, bottom, right, top) {
  const boxes = {
    [muhammara.ePDFPageBoxMediaBox]: "mediaBox",
    [muhammara.ePDFPageBoxCropBox]: "cropBox",
    [muhammara.ePDFPageBoxBleedBox]: "bleedBox",
    [muhammara.ePDFPageBoxTrimBox]: "trimBox",
    [muhammara.ePDFPageBoxArtBox]: "artBox",
  };
  if (!(box in boxes)) {
    throw new RangeError(`Unknown page box: ${box}`);
  }

  const pageBox = [left, bottom, right, top];
  this.page[boxes[box]] = pageBox;
  if (box === muhammara.ePDFPageBoxMediaBox) {
    const page = this.metadata[this.pageNumber];
    const width = right - left;
    const height = top - bottom;
    Object.assign(page, {
      mediaBox: pageBox,
      width,
      height,
      layout: width > height ? "landscape" : "portrait",
    });
  }
  return this;
};

/**
 * Finish a page
 * @name endPage
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 */
exports.endPage = function endPage() {
  if (!this.page) {
    return this;
  }

  if (this.page.endContext) {
    if (this.contextState === "active-edit") this.page.endContext();
    this.page.writePage();
  } else {
    this.writer.writePage(this.page);
  }
  this.page = null;
  this.pageContext = null;
  this.pageNumber = 0;
  this.editingPage = false;
  this.contextState = "idle";

  return this;
};

/**
 * Start editing a page
 * @name editPage
 * @function
 * @memberof Recipe#
 * @param {number} pageNumber - The page number to be edited.
 * @returns {Recipe} The recipe instance.
 */
exports.editPage = function editPage(pageNumber) {
  const pdfWriter = this.writer;
  const pageIndex = pageNumber - 1;
  const pageModifier = new muhammara.PDFPageModifier(
    pdfWriter,
    pageIndex,
    true,
  );
  this.page = pageModifier;
  this.pageNumber = pageNumber;
  this.pageContext = pageModifier.startContext().getContext();
  this.editingPage = true;
  this.contextState = "active-edit";

  this._resumePageRotation(pageNumber);

  if (this.debug) {
    const context = this.pageContext;
    const { width, height, mediaBox } = this.metadata[pageNumber];
    const startX = mediaBox[0];
    const startY = mediaBox[1];
    const textOptions = {
      font: this.writer.getFontForFile(this.fonts["helvetica-bold"]),
      size: 50,
      colorspace: "gray",
      color: 0x00,
    };
    context.writeText(
      `[${startX}, ${startY}] is HERE`,
      startX,
      startY,
      textOptions,
    );
    context.writeText(
      `[${startX}, width/2] is HERE`,
      startX,
      width / 2,
      textOptions,
    );
    context.writeText(
      `[${startX}, height/2] is HERE`,
      startX,
      height / 2,
      textOptions,
    );
    context.writeText(
      `[width/2, ${startY}] is HERE`,
      width / 2,
      startY,
      textOptions,
    );
    context.writeText(
      `[height/2, ${startY}] is HERE`,
      height / 2,
      startY,
      textOptions,
    );
  }
  return this;
};

/**
 * Delete one or more pages from an existing PDF.
 * Page numbers are one-based and refer to the original source document.
 * @name deletePage
 * @function
 * @memberof Recipe#
 * @param {number|number[]} pageNumbers - Page number or page numbers to delete.
 * @returns {Recipe} The recipe instance.
 */
exports.deletePage = function deletePage(pageNumbers) {
  if (this.ended) {
    throw new Error("Cannot delete a page after endPDF");
  }
  if (this.isNewPDF) {
    throw new Error("deletePage requires an existing PDF");
  }
  if (this.needToInsertPages) {
    throw new Error("deletePage cannot be combined with insertPage");
  }
  if (this.pagesAppended) {
    throw new Error("deletePage cannot be combined with appendPage");
  }
  if (this.pagesCreated) {
    throw new Error("deletePage cannot be combined with createPage");
  }
  pageNumbers = Array.isArray(pageNumbers) ? pageNumbers : [pageNumbers];
  const deletedPages = new Set(this.deletedPages || []);
  pageNumbers.forEach((pageNumber) => {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > this.sourcePageCount
    ) {
      throw new RangeError("pageNumber must identify an existing page");
    }
    deletedPages.add(pageNumber);
  });
  if (deletedPages.size >= this.sourcePageCount) {
    throw new Error("At least one page must remain in the PDF");
  }
  this.deletedPages = deletedPages;
  return this;
};

exports._deletePages = function _deletePages() {
  if (!this.deletedPages?.size) return this;

  const copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
  try {
    const parser = copyingContext.getSourceDocumentParser();
    const deletedPageIDs = new Set(
      Array.from(this.deletedPages, (pageNumber) =>
        parser.getPageObjectID(pageNumber - 1),
      ),
    );
    const trailer = parser.getTrailer().toJSObject();
    const rootID = trailer.Root.toPDFIndirectObjectReference().getObjectID();
    const catalogDictionary = parser.parseNewObject(rootID).toPDFDictionary();
    const catalog = catalogDictionary.toJSObject();
    const pagesReference = catalog.Pages.toPDFIndirectObjectReference();
    const pageLabels = preparePageLabels(
      parser,
      catalogDictionary,
      this.deletedPages,
      this.sourcePageCount - this.deletedPages.size,
    );
    const tree = readPageTree(
      parser,
      pagesReference.getObjectID(),
      deletedPageIDs,
      pagesReference.getVersion(),
    );
    writePageTree(this.writer, copyingContext, tree);
    writePageLabels(this.writer, copyingContext, rootID, pageLabels);
  } finally {
    copyingContext.end();
  }

  const retained = Object.keys(this.metadata)
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
    .filter((pageNumber) => !this.deletedPages.has(pageNumber))
    .map((pageNumber) => this.metadata[pageNumber]);
  Object.keys(this.metadata)
    .filter((key) => /^\d+$/.test(key))
    .forEach((key) => delete this.metadata[key]);
  const pageNumberMap = new Map();
  retained.forEach((page, index) => {
    pageNumberMap.set(page.pageNumber, index + 1);
    this.metadata[index + 1] = { ...page, pageNumber: index + 1 };
  });
  this.annotationsToWrite = this.annotationsToWrite
    .filter((annotation) => pageNumberMap.has(annotation.pageNumber))
    .map((annotation) => ({
      ...annotation,
      pageNumber: pageNumberMap.get(annotation.pageNumber),
    }));
  const annotations = [];
  pageNumberMap.forEach((newPageNumber, oldPageNumber) => {
    if (this.annotations[oldPageNumber - 1]) {
      annotations[newPageNumber - 1] = this.annotations[oldPageNumber - 1];
    }
  });
  this.annotations = annotations;
  this.metadata.pages = retained.length;
  this.metadata.pageCount = retained.length;
  this.deletedPages = null;
  return this;
};

exports._resumePageRotation = function _resumePageRotation(
  pageNumber,
  context,
) {
  pageNumber = pageNumber || this.pageNumber;
  const {
    // layout,
    rotate,
    width,
    height,
    mediaBox,
  } = this.metadata[pageNumber];
  context = context || this.pageContext;
  const startX = mediaBox[0];
  const startY = mediaBox[1];
  this.page.mediaBox = [startX, startY, width, height];

  switch (rotate) {
    case 90:
    case -270:
      context.cm(0, 1, -1, 0, height - startX, startY);
      break;
    case 180:
    case -180:
      context.cm(-1, 0, 0, -1, width, height);
      break;
    case 270:
    case -90:
      context.cm(0, -1, 1, 0, startX, width - startY);
      break;

    default:
  }
  return this;
};

/**
 * Get page information
 * @name pageInfo
 * @function
 * @memberof Recipe#
 * @param {number} pageNumber - The page number.
 * @returns {RecipePageInfo} The page information.
 */
exports.pageInfo = function pageInfo(pageNumber) {
  const pageInfo = this.metadata[pageNumber];
  return {
    width: pageInfo.width,
    height: pageInfo.height,
    rotate: pageInfo.rotate,
    pageNumber,
  };
};

/**
 * Get information about the current page.
 * @name getCurrentPageInfo
 * @function
 * @memberof Recipe#
 * @returns {RecipePageInfo|null} The current page information, or null when no page has been created or edited.
 */
exports.getCurrentPageInfo = function getCurrentPageInfo() {
  const pageNumber =
    this.pageNumber || this.metadata?.pageCount || this.metadata?.pages;
  return pageNumber ? this.pageInfo(pageNumber) : null;
};

/**
 * Pause the current page content context.
 * @name pauseContext
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If there is no active page content context.
 */
exports.pauseContext = function pauseContext() {
  if (this.contextState === "active-edit") {
    this.page.endContext();
    this.pageContext = null;
    this.contextState = "paused-edit";
  } else if (this.contextState === "active-new") {
    this.writer.pausePageContentContext(this.pageContext);
    this.contextState = "paused-new";
  } else {
    throw new Error("No active page content context to pause");
  }
  return this;
};

/**
 * Resume the current page content context after it has been paused.
 * @name resumeContext
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If there is no paused page content context.
 */
exports.resumeContext = function resumeContext() {
  if (this.contextState === "paused-edit") {
    this.pageContext = this.page.startContext().getContext();
    this._resumePageRotation();
    this.contextState = "active-edit";
  } else if (this.contextState === "paused-new") {
    this.contextState = "active-new";
  } else {
    throw new Error("No paused page content context to resume");
  }
  return this;
};

/**
 * Get the document information dictionary.
 * @name getPageInfo
 * @function
 * @memberof Recipe#
 * @returns {Object} The document information dictionary.
 */
exports.getPageInfo = function getPageInfo() {
  const info = this.writer.getDocumentContext().getInfoDictionary();
  return info;
};

/**
 * Set/Get current page margins.
 * @name margins
 * @function
 * @memberof Recipe#
 * @param {number|object} [left] - Left margin width or an object holding margin properties to be set.
 * Valid margin property names are: left, right, top, bottom.
 * @param {number} [right] - Right margin width.
 * @param {number} [top] - Top margin height.
 * @param {number} [bottom] - Bottom margin height.
 * @returns {object} When parameters are given, the value returned is the recipe handle. When no
 * parameters given, the return value is the current page margin object.
 */
exports.margins = function margins(left, right, top, bottom) {
  let marginSet = false;

  if (typeof left === "object") {
    const margins = left;
    left = margins.left;
    right = margins.right;
    top = margins.top;
    bottom = margins.bottom;
  }

  if (left !== undefined) {
    this._margin.left = left;
    marginSet = true;
  }

  if (right !== undefined) {
    this._margin.right = right;
    marginSet = true;
  }

  if (top !== undefined) {
    this._margin.top = top;
    marginSet = true;
  }

  if (bottom !== undefined) {
    this._margin.bottom = bottom;
    marginSet = true;
  }

  // When no parameters given, send back current margins.
  if (!marginSet) {
    return this._margin;
  }

  return this;
};
