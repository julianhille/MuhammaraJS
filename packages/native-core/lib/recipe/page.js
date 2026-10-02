const { PAGE_CONTEXT_STATE } = require("./utils");
const { PageLayout, Colorspace } = require("../recipe-constants");
const {
  planDeletedPageReferences,
  pruneDeletedPageReferences,
  setCatalogEntry,
} = require("./page-references");

// PDF dictionary keys and names the page-tree and page-label code reads.
const PdfName = Object.freeze({
  PAGES: "Pages",
  KIDS: "Kids",
  COUNT: "Count",
  PARENT: "Parent",
  PAGE_LABELS: "PageLabels",
  LIMITS: "Limits",
  NUMS: "Nums",
});

/**
 * Build the retained page tree while marking deleted leaf pages.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {number} objectID - The object ID of the Pages node to read.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {Set<number>} modifiedPageIDs - Object IDs of pages edited in this Recipe.
 * @param {Object} pageState - Running state: pageNumber, deletedPageIDs and
 *   retainedPageIDs, updated as leaves are visited.
 * @param {number} [generation=0] - The generation of the node's reference.
 * @param {Set<number>} [visited] - Pages nodes already read, to reject cycles.
 * @param {number} [depth=0] - The nesting depth, limited to 1000.
 * @returns {Object} The node: objectID, generation, values, retained
 *   children, retained page count and whether it changed.
 * @throws {Error} If the page tree is cyclic, too deep or inconsistent, or a
 *   modified page has a nonzero generation.
 */
function readPageTree(
  parser,
  objectID,
  deletedPages,
  modifiedPageIDs,
  pageState,
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
  if (depth === 0 && values.Parent !== undefined) {
    throw new Error("deletePage requires a valid page tree");
  }
  const kids = parser.queryDictionaryObject(dictionary, "Kids")?.toPDFArray();
  if (!kids) {
    throw new Error("deletePage requires a valid page tree");
  }
  const mappedChildren = kids.toJSArray().map((entry) => {
    // Kids must be references to page tree dictionaries with a /Type.
    const reference = entry.toPDFIndirectObjectReference();
    const childID = reference?.getObjectID();
    const childDictionary =
      childID === undefined
        ? null
        : parser.parseNewObject(childID)?.toPDFDictionary();
    if (!childDictionary) {
      throw new Error("deletePage requires a valid page tree");
    }
    const childValues = childDictionary.toJSObject();
    const parentReference = childValues.Parent?.toPDFIndirectObjectReference();
    if (
      !parentReference ||
      parentReference.getObjectID() !== objectID ||
      parentReference.getVersion() !== generation
    ) {
      throw new Error("deletePage requires a valid page tree");
    }
    const type = childValues.Type?.toPDFName()?.value;
    if (type === undefined) {
      throw new Error("deletePage requires a valid page tree");
    }
    if (type === PdfName.PAGES) {
      return readPageTree(
        parser,
        childID,
        deletedPages,
        modifiedPageIDs,
        pageState,
        reference.getVersion(),
        visited,
        depth + 1,
      );
    }
    pageState.pageNumber += 1;
    // Check deletion before the modified-generation restriction: a deleted
    // page is dropped from the Kids array entirely, never rewritten, so its
    // own generation is irrelevant even if it was also edited.
    if (deletedPages.has(pageState.pageNumber)) {
      pageState.deletedPageIDs.add(childID);
      return null;
    }
    if (modifiedPageIDs.has(childID) && reference.getVersion() !== 0) {
      throw new Error(
        "deletePage does not support rewriting nonzero-generation objects",
      );
    }
    pageState.retainedPageIDs.add(childID);
    return {
      objectID: childID,
      generation: reference.getVersion(),
      count: 1,
      values: childValues,
    };
  });

  const children = mappedChildren.filter((child) => child && child.count);
  return {
    objectID,
    generation,
    values,
    children,
    count: mappedChildren.reduce(
      (count, child) => count + (child?.count || 0),
      0,
    ),
    changed: mappedChildren.some((child) => !child || child.changed),
  };
}

/**
 * Write changed page-tree nodes back to the modified PDF with their new
 * Count and Kids.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {Object} copyingContext - Copies the unchanged entries.
 * @param {Object} node - A node built by readPageTree().
 * @returns {void}
 */
function writePageTree(writer, copyingContext, node) {
  node.children
    .filter((child) => child.children && child.changed)
    .forEach((child) => writePageTree(writer, copyingContext, child));
  if (!node.changed) return;

  const objectsContext = writer.getObjectsContext();
  objectsContext.startModifiedIndirectObject(node.objectID);
  const dictionary = objectsContext.startDictionary();
  Object.keys(node.values).forEach((key) => {
    if (key === PdfName.COUNT || key === PdfName.KIDS) return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(node.values[key]);
  });
  dictionary.writeKey(PdfName.COUNT);
  objectsContext.writeNumber(node.count);
  dictionary.writeKey(PdfName.KIDS);
  objectsContext.startArray();
  node.children.forEach((child) => {
    objectsContext.writeIndirectObjectReference(
      child.objectID,
      child.generation || 0,
    );
  });
  objectsContext.endArray().endDictionary(dictionary).endIndirectObject();
}

/**
 * Visits every retained node in a page tree - Pages nodes and leaf pages
 * alike - depth-first. Shared by every deletePage() pass that needs to walk
 * the tree readPageTree() already built, instead of re-parsing or re-walking
 * it independently.
 * @private
 * @param {Object} tree - The root node built by readPageTree().
 * @param {function(Object): void} visit - Called with every node.
 * @returns {void}
 */
function walkPageTree(tree, visit) {
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    visit(node);
    if (node.children) pending.push(...node.children);
  }
}

/**
 * Reject page-tree and page-label objects that cannot be rewritten safely:
 * changed objects must have generation 0. The catalog is never rewritten in
 * place, so its generation does not matter.
 * @private
 * @param {Object} tree - The root node built by readPageTree().
 * @param {Object|null} pageLabels - The result of preparePageLabels().
 * @returns {void}
 * @throws {Error} If a changed object has a nonzero generation.
 */
function assertSupportedModifiedGenerations(tree, pageLabels) {
  walkPageTree(tree, (node) => {
    if (!node.children) return;
    if (node.changed && node.generation !== 0) {
      throw new Error(
        "deletePage does not support rewriting nonzero-generation objects",
      );
    }
  });
  if (pageLabels?.reference && pageLabels.reference.getVersion() !== 0) {
    throw new Error(
      "deletePage does not support rewriting nonzero-generation objects",
    );
  }
}

/**
 * Collect the entries of a page-label number tree.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} dictionary - The number-tree node.
 * @param {Object[]} entries - Receives {index, value} for every label.
 * @param {Set<number>} [visited] - Nodes already read, to reject cycles.
 * @param {number} [objectID=0] - The object ID of this node, if indirect.
 * @param {number} [depth=0] - The nesting depth, limited to 1000.
 * @returns {Object} The entries of this node's dictionary.
 * @throws {Error} If the tree is cyclic, too deep or has invalid entries.
 */
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
    const numbersArray = resolvePageLabelObject(
      parser,
      values.Nums,
    ).toPDFArray();
    const numbers = numbersArray.toJSArray();
    for (let index = 0; index < numbers.length; index += 2) {
      entries.push({
        index: resolvePageLabelObject(parser, numbers[index]).toNumber(),
        value: readPageLabel(
          parser,
          resolvePageLabelObject(parser, numbers[index + 1]),
        ),
      });
    }
  }
  if (values.Kids) {
    parser
      .queryDictionaryObject(dictionary, PdfName.KIDS)
      .toPDFArray()
      .toJSArray()
      .forEach((entry) => {
        const objectID = entry.toPDFIndirectObjectReference().getObjectID();
        collectPageLabels(
          parser,
          resolvePageLabelObject(parser, entry).toPDFDictionary(),
          entries,
          visited,
          objectID,
          depth + 1,
        );
      });
  }
  return values;
}

/**
 * Follow a chain of indirect references to the object it ends at.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} value - The PDF object or reference.
 * @returns {Object} The resolved object.
 * @throws {Error} If the chain is cyclic or longer than 1000 references.
 */
function resolvePageLabelObject(parser, value) {
  const visited = new Set();
  let resolved = value;
  while (resolved?.toPDFIndirectObjectReference?.()) {
    const objectID = resolved.toPDFIndirectObjectReference().getObjectID();
    if (visited.size > 1000 || visited.has(objectID)) {
      throw new Error("deletePage requires valid acyclic PageLabels");
    }
    visited.add(objectID);
    resolved = parser.parseNewObject(objectID);
  }
  return resolved;
}

/**
 * Read a page-label dictionary into a plain value.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} value - The page-label dictionary.
 * @returns {{style: (string|undefined), prefix: (Object|undefined),
 *   start: (number|undefined)}} The label style name, prefix bytes with their
 *   string kind, and start number.
 * @throws {Error} If the value is not a dictionary.
 */
function readPageLabel(parser, value) {
  const dictionary = value?.toPDFDictionary();
  if (!dictionary) {
    throw new Error("deletePage requires valid PageLabels entries");
  }
  const values = dictionary.toJSObject();
  const style = values.S ? resolvePageLabelObject(parser, values.S) : null;
  const prefix = values.P ? resolvePageLabelObject(parser, values.P) : null;
  const start = values.St ? resolvePageLabelObject(parser, values.St) : null;
  const prefixHex = prefix?.toPDFHexString();
  const prefixLiteral = prefix?.toPDFLiteralString();
  if (values.P !== undefined && !prefixHex && !prefixLiteral) {
    throw new Error("deletePage requires valid PageLabels entries");
  }
  return {
    style: style?.toPDFName()?.value,
    prefix:
      values.P === undefined
        ? undefined
        : {
            bytes: (prefixHex || prefixLiteral).toBytesArray(),
            isHex: Boolean(prefixHex),
          },
    start: start?.toNumber(),
  };
}

/**
 * Write one indirect page-label dictionary per entry.
 * @private
 * @param {Object} objectsContext - The writer objects context.
 * @param {Object[]} entries - The normalized {index, value} entries.
 * @returns {Object[]} The {index, objectID} of every written label.
 */
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

/**
 * Write a flat page-label number tree: the copied extra entries and a Nums
 * array referencing the written labels.
 * @private
 * @param {Object} objectsContext - The writer objects context.
 * @param {Object} copyingContext - Copies the extra entries.
 * @param {Object} dictionary - The dictionary context to write into.
 * @param {Object} values - The source number-tree entries.
 * @param {Object[]} entries - The {index, objectID} of every label.
 * @returns {void}
 */
function writePageLabelsDictionary(
  objectsContext,
  copyingContext,
  dictionary,
  values,
  entries,
) {
  Object.keys(values).forEach((key) => {
    if (key === PdfName.KIDS || key === PdfName.LIMITS || key === PdfName.NUMS)
      return;
    dictionary.writeKey(key);
    copyingContext.copyDirectObjectAsIs(values[key]);
  });
  dictionary.writeKey(PdfName.NUMS);
  objectsContext.startArray();
  entries.forEach((entry) => {
    objectsContext.writeNumber(entry.index);
    objectsContext.writeIndirectObjectReference(entry.objectID);
  });
  objectsContext.endArray();
}

/**
 * Reindex the page labels for the pages that remain after deletion, keeping
 * each label's numbering continuous.
 * @private
 * @param {Object} parser - The source PDF parser.
 * @param {Object} catalogDictionary - The catalog dictionary.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {number} sourcePageCount - The source page count.
 * @returns {Object|null} The PageLabels reference, the number tree values
 *   and the normalized entries; null without page labels.
 * @throws {Error} If PageLabels is not a valid number tree.
 */
function preparePageLabels(
  parser,
  catalogDictionary,
  deletedPages,
  sourcePageCount,
) {
  const catalogValues = catalogDictionary.toJSObject();
  if (!catalogValues.PageLabels) {
    return null;
  }
  const pageLabelsValue = resolvePageLabelObject(
    parser,
    catalogValues.PageLabels,
  );
  if (pageLabelsValue.toPDFNull()) return null;
  const labelsDictionary = pageLabelsValue.toPDFDictionary();
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
  const deletedIndices = new Set(
    Array.from(deletedPages, (pageNumber) => pageNumber - 1),
  );
  const outputIndices = new Map();
  let outputIndex = 0;
  for (let index = 0; index < sourcePageCount; index += 1) {
    if (deletedIndices.has(index)) continue;
    outputIndices.set(index, outputIndex);
    outputIndex += 1;
  }
  const sortedEntries = entries.sort((left, right) => left.index - right.index);
  const normalized = [];
  sortedEntries.forEach((entry, entryIndex) => {
    const rangeEnd = Math.min(
      sortedEntries[entryIndex + 1]?.index ?? sourcePageCount,
      sourcePageCount,
    );
    let startsRun = true;
    for (let index = entry.index; index < rangeEnd; index += 1) {
      if (deletedIndices.has(index)) {
        startsRun = true;
        continue;
      }
      if (startsRun) {
        const offset = index - entry.index;
        normalized.push({
          index: outputIndices.get(index),
          value:
            offset && entry.value.style !== undefined
              ? {
                  ...entry.value,
                  start: (entry.value.start ?? 1) + offset,
                }
              : entry.value,
        });
        startsRun = false;
      }
    }
  });
  return {
    reference,
    values,
    entries: normalized,
  };
}

/**
 * Write the updated page labels and attach them to the catalog.
 * @private
 * @param {Object} writer - The PDF writer.
 * @param {Object} copyingContext - Copies unchanged entries.
 * @param {Object|null} pageLabels - The result of preparePageLabels().
 * @returns {void}
 */
function writePageLabels(writer, copyingContext, pageLabels) {
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

  setCatalogEntry(writer, PdfName.PAGE_LABELS, labelsObjectID);
}

/**
 * Create a new page, specifying either actual width and height, or the name
 * of a supported page size (eg. 'letter', 'letter-size')
 * '-size' will be removed from string but is discouraged to use.
 * @name createPage
 * @function
 * @memberof Recipe#
 * @param {number|Recipe.PageSize} [pageWidth] - The page width, or a `Recipe.PageSize` name.
 * Known named medium sizes: executive, folio, legal, letter, ledger, tabloid, a0-a10, b0-b10, c0-c10, ra0-ra4, sra0-sra4.
 * Unknown names use the default letter size.
 * @param {number} [pageHeight] - The page height, or rotation (90) when page size name given.
 * @param {object} [margins] - page margin definitions.
 * @param {number} [margins.left] - Left margin.
 * @param {number} [margins.right] - Right margin.
 * @param {number} [margins.top] - Top margin.
 * @param {number} [margins.bottom] - Bottom margin.
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If pages were deleted with deletePage() on this Recipe.
 * @throws {Error} If another page is still active; call endPage() first.
 */
exports.createPage = function createPage(pageWidth, pageHeight, margins) {
  if (this.deletedPages?.size) {
    throw new Error("createPage cannot be combined with deletePage");
  }
  // Opening a second page over an active one leaves the first page
  // unfinished: the writer then crashes or silently drops it at endPDF().
  if (this.page) {
    throw new Error("Finish the current page before creating another page");
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
  this.metadata.pageCount =
    (this.metadata.pageCount ?? this.metadata.pages ?? 0) + 1;
  const pageNumber = this.metadata.pageCount;
  const dimensions = [0, 0, pageWidth, pageHeight];
  const layout =
    pageWidth > pageHeight ? PageLayout.LANDSCAPE : PageLayout.PORTRAIT;
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
  this.contextState = PAGE_CONTEXT_STATE.ACTIVE_NEW;
  if (!this.isNewPDF) this.pagesCreated = true;

  if (margins) {
    this.margins(margins);
  }

  this.moveTo(0, 0);
  resetTextBox(this, 0, 0);
  return this;
};

/**
 * Forget the previous page's text box, so text() without coordinates starts
 * at the margins of the new active page instead of the last text position,
 * and movedown() starts from the given cursor.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {number} x - The text cursor x on the new active page.
 * @param {number} y - The text cursor y on the new active page.
 * @returns {void}
 */
function resetTextBox(recipe, x, y) {
  recipe.x = x;
  recipe.y = y;
  recipe.box = undefined;
  recipe._textOptions = undefined;
  recipe._previousTextObjects = [];
  recipe._firstLineHeight = 0;
}

/**
 * Map the PageBox names, which setPageBox() also accepts, to the addon's
 * ePDFPageBox constants.
 * @private
 * @param {Object} muhammara - The addon API the Recipe was created for.
 * @returns {Object<string, number>} The page box constants by name.
 */
function pageBoxConstants(muhammara) {
  return {
    [muhammara.PageBox.MEDIA]: muhammara.ePDFPageBoxMediaBox,
    [muhammara.PageBox.CROP]: muhammara.ePDFPageBoxCropBox,
    [muhammara.PageBox.BLEED]: muhammara.ePDFPageBoxBleedBox,
    [muhammara.PageBox.TRIM]: muhammara.ePDFPageBoxTrimBox,
    [muhammara.PageBox.ART]: muhammara.ePDFPageBoxArtBox,
  };
}

/**
 * Validate a page rotation. PDF allows only multiples of 90 degrees.
 * @private
 * @param {*} page - The active page, if any.
 * @param {*} rotation - The requested rotation.
 * @throws {TypeError} If no page is active or `rotation` is not a number.
 * @throws {RangeError} If `rotation` is not a multiple of 90.
 */
function checkRotation(page, rotation) {
  if (!page) {
    throw new TypeError("rotate requires an active page");
  }
  if (typeof rotation !== "number") {
    throw new TypeError("Rotation is not set to a number");
  }
  if (!Number.isInteger(rotation / 90)) {
    throw new RangeError("Rotation must be a multiple of 90 degrees");
  }
}

/**
 * Set the rotation of the current page.
 * @name rotate
 * @function
 * @memberof Recipe#
 * @param {number} rotation - The page rotation in degrees, a multiple of 90.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If no page is active or `rotation` is not a number.
 * @throws {RangeError} If `rotation` is not a multiple of 90.
 * @throws {Error} If the active page was opened with `editPage()`.
 */
exports.rotate = function rotate(rotation) {
  // A page modifier keeps the source page's /Rotate, so the rotation would
  // only change Recipe's coordinate bookkeeping.
  if (this.editingPage) {
    throw new Error(
      "rotate() is only available on pages created with createPage()",
    );
  }
  checkRotation(this.page, rotation);
  this.page.rotate = rotation;
  this.metadata[this.pageNumber].rotate = rotation;
  return this;
};

/**
 * Set a page box on the active new page.
 * @name setPageBox
 * @function
 * @memberof Recipe#
 * @param {number|string} box - An `ePDFPageBox*` constant or a `PageBox` name.
 * @param {number} left - The PDF left coordinate.
 * @param {number} bottom - The PDF bottom coordinate.
 * @param {number} right - The PDF right coordinate.
 * @param {number} top - The PDF top coordinate.
 * @returns {Recipe} The recipe instance.
 * @throws {RangeError} If the page box constant is unknown.
 * @throws {TypeError} If no page is active.
 */
exports.setPageBox = function setPageBox(box, left, bottom, right, top) {
  const muhammara = this.muhammara;
  box = pageBoxConstants(muhammara)[box] ?? box;
  if ([left, bottom, right, top].some((value) => typeof value === "bigint")) {
    throw new TypeError("setPageBox coordinates must be numbers");
  }
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
      layout: width > height ? PageLayout.LANDSCAPE : PageLayout.PORTRAIT,
    });
  }
  return this;
};

/**
 * Finish a page. Without an active page this does nothing.
 * @name endPage
 * @function
 * @memberof Recipe#
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the page cannot be written.
 */
exports.endPage = function endPage() {
  if (!this.page) {
    return this;
  }
  // A flow still waiting for its end is drawn on the page it started on.
  this._flushTextFlow();

  if (this.page.endContext) {
    if (this.contextState === PAGE_CONTEXT_STATE.ACTIVE_EDIT)
      this.page.endContext();
    this.page.writePage();
  } else {
    this.writer.writePage(this.page);
  }
  this.page = null;
  this.pageContext = null;
  this.pageNumber = 0;
  this.editingPage = false;
  this.contextState = PAGE_CONTEXT_STATE.IDLE;

  return this;
};

/**
 * Start editing a page
 * @name editPage
 * @function
 * @memberof Recipe#
 * @param {number} pageNumber - The one-based page number to be edited.
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the Recipe was not constructed from an existing PDF.
 * @throws {Error} If the page does not exist in the source PDF.
 * @throws {Error} If another page is still active; call endPage() first.
 */
exports.editPage = function editPage(pageNumber) {
  if (this.isNewPDF) {
    throw new Error(
      "editPage requires a Recipe constructed from an existing PDF",
    );
  }
  // As in createPage, an active page left unfinished crashes the writer or is
  // silently dropped at endPDF().
  if (this.page) {
    throw new Error("Finish the current page before editing another page");
  }
  const pdfWriter = this.writer;
  const pageIndex = pageNumber - 1;
  const pageModifier = new this.muhammara.PDFPageModifier(
    pdfWriter,
    pageIndex,
    true,
  );
  this.page = pageModifier;
  this.pageNumber = pageNumber;
  this.pageContext = pageModifier.startContext().getContext();
  this.editingPage = true;
  this.contextState = PAGE_CONTEXT_STATE.ACTIVE_EDIT;
  this.modifiedSourcePages.add(pageNumber);
  resetTextBox(this, this._margin.left, this._margin.top);

  this._resumePageRotation(pageNumber);

  if (this.debug) {
    const context = this.pageContext;
    const { width, height, mediaBox } = this.metadata[pageNumber];
    const startX = mediaBox[0];
    const startY = mediaBox[1];
    const textOptions = {
      font: this.writer.getFontForFile(this.fonts.helvetica.b),
      size: 50,
      colorspace: Colorspace.GRAY,
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
 * Read the page tree and check that the queued deletions can be applied:
 * the page tree and page labels can be rewritten, and every retained
 * reference to a deleted page can be pruned or there is none.
 * @private
 * @param {Object} recipe - The Recipe.
 * @param {Object} copyingContext - A copying context for the modified file.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {boolean} prune - Whether to prune references to deleted pages.
 * @returns {Object} The page tree, page labels, catalog entries, deleted
 *   page object IDs and the pruning plan.
 * @throws {Error} If the deletion cannot be applied.
 */
function planPageDeletion(recipe, copyingContext, deletedPages, prune) {
  const parser = copyingContext.getSourceDocumentParser();
  const trailer = parser.getTrailer().toJSObject();
  const rootID = trailer.Root.toPDFIndirectObjectReference().getObjectID();
  const catalogDictionary = parser.parseNewObject(rootID).toPDFDictionary();
  const catalog = catalogDictionary.toJSObject();
  const pagesReference = catalog.Pages.toPDFIndirectObjectReference();
  const pageLabels = preparePageLabels(
    parser,
    catalogDictionary,
    deletedPages,
    recipe.sourcePageCount,
  );
  const modifiedPageIDs = new Set(
    Array.from(recipe.modifiedSourcePages, (pageNumber) =>
      parser.getPageObjectID(pageNumber - 1),
    ),
  );
  const pageState = {
    pageNumber: 0,
    deletedPageIDs: new Set(),
    retainedPageIDs: new Set(),
  };
  const tree = readPageTree(
    parser,
    pagesReference.getObjectID(),
    deletedPages,
    modifiedPageIDs,
    pageState,
    pagesReference.getVersion(),
  );
  pageState.retainedPageIDs.forEach((objectID) =>
    pageState.deletedPageIDs.delete(objectID),
  );
  assertSupportedModifiedGenerations(tree, pageLabels);
  const plan = planDeletedPageReferences(
    parser,
    {
      catalog,
      rootID,
      tree,
      pageLabels,
      deletedPageIDs: pageState.deletedPageIDs,
      modifiedPageIDs,
      sourcePageCount: recipe.sourcePageCount,
    },
    prune,
  );
  return {
    catalog,
    tree,
    pageLabels,
    deletedPageIDs: pageState.deletedPageIDs,
    plan,
  };
}

/**
 * Delete one or more pages from an existing PDF.
 * Page numbers are one-based and refer to the original source document.
 *
 * By default a page that retained structures still reference - outline
 * items, link annotations and named destinations, form widgets, tagged-PDF
 * structure elements or the open action - cannot be deleted. With
 * `pruneReferences`, those references are removed instead: a destination
 * that targets a deleted page becomes null (so outline items keep their
 * title and children, and links do nothing), and every other direct
 * reference to a deleted page is dropped. Pruning applies to every queued
 * deletion once any deletePage() call enables it.
 * @name deletePage
 * @function
 * @memberof Recipe#
 * @param {number|number[]} pageNumbers - Page number or page numbers to delete.
 * @param {Object} [options] - Deletion options.
 * @param {boolean} [options.pruneReferences=false] - Remove references to the
 *   deleted pages from retained structures instead of refusing the deletion.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If options is not an object or pruneReferences is not
 * a boolean.
 * @throws {RangeError} If a page number does not identify an original page.
 * @throws {Error} If the Recipe has no existing source, has ended, would delete
 * every page, combines deletion with page composition, or the page tree,
 * page labels or retained references cannot be rewritten. A failed call
 * leaves the queued deletions unchanged.
 */
exports.deletePage = function deletePage(pageNumbers, options) {
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
  if (
    options !== undefined &&
    (options === null || typeof options !== "object" || Array.isArray(options))
  ) {
    throw new TypeError("deletePage expects an options object");
  }
  const pruneReferences = options?.pruneReferences;
  if (pruneReferences !== undefined && typeof pruneReferences !== "boolean") {
    throw new TypeError("deletePage pruneReferences must be a boolean");
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
  const prune = Boolean(this.pruneReferences || pruneReferences);
  const copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
  try {
    planPageDeletion(this, copyingContext, deletedPages, prune);
  } finally {
    copyingContext.end();
  }
  this.deletedPages = deletedPages;
  this.pruneReferences = prune;
  return this;
};

/**
 * Apply the queued page deletions during finalization: rewrite the page tree
 * and page labels, prune references to deleted pages when enabled, and
 * renumber metadata and pending annotations.
 * @private
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the page tree, page labels or retained references
 *   cannot be rewritten safely, for example after editing a page that holds
 *   a pruned reference.
 */
exports._deletePages = function _deletePages() {
  if (!this.deletedPages?.size) return this;

  const copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
  try {
    const deletion = planPageDeletion(
      this,
      copyingContext,
      this.deletedPages,
      Boolean(this.pruneReferences),
    );
    writePageTree(this.writer, copyingContext, deletion.tree);
    writePageLabels(this.writer, copyingContext, deletion.pageLabels);
    pruneDeletedPageReferences(
      this.writer,
      copyingContext,
      deletion.catalog,
      deletion.plan,
      deletion.deletedPageIDs,
    );
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

/**
 * Apply the page rotation to an edited page's content context, so Recipe
 * coordinates stay upright on rotated source pages.
 * @private
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @param {Object} [context] - The content context; defaults to the page context.
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If the page is unknown.
 */
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
 * @param {number} pageNumber - The one-based page number.
 * @returns {RecipePageInfo} The page information.
 * @throws {TypeError} If the page is unknown.
 */
exports.pageInfo = function pageInfo(pageNumber) {
  const pageInfo = this.metadata[pageNumber];
  if (!pageInfo) {
    throw new TypeError(`Unknown page number: ${pageNumber}`);
  }
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
  if (this.contextState === PAGE_CONTEXT_STATE.ACTIVE_EDIT) {
    this.page.endContext();
    this.pageContext = null;
    this.contextState = PAGE_CONTEXT_STATE.PAUSED_EDIT;
  } else if (this.contextState === PAGE_CONTEXT_STATE.ACTIVE_NEW) {
    this.writer.pausePageContentContext(this.pageContext);
    this.contextState = PAGE_CONTEXT_STATE.PAUSED_NEW;
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
  if (this.contextState === PAGE_CONTEXT_STATE.PAUSED_EDIT) {
    this.pageContext = this.page.startContext().getContext();
    this._resumePageRotation();
    this.contextState = PAGE_CONTEXT_STATE.ACTIVE_EDIT;
  } else if (this.contextState === PAGE_CONTEXT_STATE.PAUSED_NEW) {
    this.contextState = PAGE_CONTEXT_STATE.ACTIVE_NEW;
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
