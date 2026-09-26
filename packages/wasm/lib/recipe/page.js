import { standardInfoKeys } from "../recipe-info.js";
import { mediumSizes } from "./parameters.js";
import { pageRecord } from "./page-record.js";
import { PAGE_CONTEXT_STATE } from "./context-state.js";

/**
 * Builds the retained page tree while marking deleted leaf pages.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {number} objectID - Pages or Page object ID.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {Set<number>} modifiedPageIDs - Object IDs of pages already rewritten.
 * @param {{pageNumber: number}} pageState - Running page counter.
 * @param {number} [generation=0] - Object generation.
 * @param {Set<number>} [visited] - Visited object IDs.
 * @param {number} [depth=0] - Recursion depth.
 * @returns {object|null} The node, or null for a deleted page.
 * @throws {Error} If the tree is cyclic, too deep, or malformed.
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
  var dictionary = parser.parseNewObject(objectID).toPDFDictionary();
  var values = dictionary.toJSObject();
  if (depth === 0 && values.Parent !== undefined) {
    throw new Error("deletePage requires a valid page tree");
  }
  var kids = parser.queryDictionaryObject(dictionary, "Kids").toPDFArray();
  var mappedChildren = kids.toJSArray().map((entry) => {
    var reference = entry.toPDFIndirectObjectReference();
    var childID = reference.getObjectID();
    var childDictionary = parser.parseNewObject(childID).toPDFDictionary();
    var childValues = childDictionary.toJSObject();
    var parentReference = childValues.Parent?.toPDFIndirectObjectReference();
    if (
      !parentReference ||
      parentReference.getObjectID() !== objectID ||
      parentReference.getVersion() !== generation
    ) {
      throw new Error("deletePage requires a valid page tree");
    }
    var type = childValues.Type.toPDFName().value;
    if (type === "Pages") {
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

  var children = mappedChildren.filter((child) => child && child.count);
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
 * Writes changed page-tree nodes back to the modified PDF.
 * @private
 * @param {PDFModifier} writer - Modifier.
 * @param {DocumentCopyingContext} copyingContext - Copies unchanged values.
 * @param {object} node - Page-tree node.
 * @returns {void}
 */
function writePageTree(writer, copyingContext, node) {
  node.children
    .filter((child) => child.children && child.changed)
    .forEach((child) => writePageTree(writer, copyingContext, child));
  if (!node.changed) return;

  var objectsContext = writer.getObjectsContext();
  objectsContext.startModifiedIndirectObject(node.objectID);
  var dictionary = objectsContext.startDictionary();
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

/**
 * Visits every retained node in a page tree - Pages nodes and leaf pages
 * alike - depth-first. Shared by every deletePage() pass that needs to walk
 * the tree readPageTree() already built, instead of re-parsing or re-walking
 * it independently.
 * @param {object} tree - Page-tree root.
 * @param {function(object): void} visit - Called for each node.
 * @returns {void}
 */
function walkPageTree(tree, visit) {
  var pending = [tree];
  while (pending.length) {
    var node = pending.pop();
    visit(node);
    if (node.children) pending.push(...node.children);
  }
}

/**
 * Adds retained Pages-node object IDs to a set.
 * @private
 * @param {object} tree - Page-tree root.
 * @param {Set<number>} objectIDs - Receives the IDs.
 * @returns {void}
 */
function collectPageTreeObjectIDs(tree, objectIDs) {
  walkPageTree(tree, (node) => {
    if (node.children) objectIDs.add(node.objectID);
  });
}

/**
 * Rejects page-tree objects that cannot be rewritten safely.
 * @private
 * @param {object} tree - Page-tree root.
 * @param {object|null} pageLabels - Prepared page labels.
 * @param {PDFIndirectObjectReference} root - Catalog reference.
 * @param {PDFModifier} writer - Modifier.
 * @returns {void}
 * @throws {Error} If a changed object has a nonzero generation.
 */
function assertSupportedModifiedGenerations(tree, pageLabels, root, writer) {
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
  // A writer with _setPageLabelsObject() (wasm) always attaches a new
  // PageLabels entry through that dedicated hook and never rewrites the
  // catalog object in place, so the catalog's own generation never matters
  // there. Without it (native-core), writePageLabels() falls back to
  // rewriting the catalog via startModifiedIndirectObject(rootID), which
  // only supports generation 0.
  if (pageLabels && !pageLabels.reference && !writer._setPageLabelsObject) {
    if (root.getVersion() !== 0) {
      throw new Error(
        "deletePage does not support rewriting nonzero-generation objects",
      );
    }
  }
}

/**
 * Rejects retained structures that reference a deleted page.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {PDFObject} value - Value to scan.
 * @param {Set<number>} deletedPageIDs - Object IDs of deleted pages.
 * @param {Set<number>} skippedObjectIDs - Objects that are rewritten anyway.
 * @param {Set<number>} [visited] - Visited object IDs.
 * @param {number} [depth=0] - Recursion depth.
 * @returns {void}
 * @throws {Error} If a deleted page is referenced or nesting is too deep.
 */
function assertNoDeletedPageReferences(
  parser,
  value,
  deletedPageIDs,
  skippedObjectIDs,
  visited = new Set(),
  depth = 0,
) {
  if (!value) return;
  if (depth > 1000) {
    throw new Error("deletePage cannot validate deeply nested references");
  }
  var reference = value.toPDFIndirectObjectReference?.();
  if (reference) {
    var objectID = reference.getObjectID();
    if (deletedPageIDs.has(objectID)) {
      throw new Error(
        "deletePage cannot remove a page referenced by retained document structures",
      );
    }
    if (skippedObjectIDs.has(objectID) || visited.has(objectID)) return;
    visited.add(objectID);
    assertNoDeletedPageReferences(
      parser,
      parser.parseNewObject(objectID),
      deletedPageIDs,
      skippedObjectIDs,
      visited,
      depth + 1,
    );
    return;
  }
  var array =
    value.toPDFArray?.() ||
    (typeof value.toJSArray === "function" ? value : null);
  if (array) {
    array
      .toJSArray()
      .forEach((entry) =>
        assertNoDeletedPageReferences(
          parser,
          entry,
          deletedPageIDs,
          skippedObjectIDs,
          visited,
          depth + 1,
        ),
      );
    return;
  }
  var dictionary =
    value.toPDFDictionary?.() ||
    (typeof value.toJSObject === "function" ? value : null);
  if (dictionary) {
    Object.values(dictionary.toJSObject()).forEach((entry) =>
      assertNoDeletedPageReferences(
        parser,
        entry,
        deletedPageIDs,
        skippedObjectIDs,
        visited,
        depth + 1,
      ),
    );
    return;
  }
  var stream = value.toPDFStream?.();
  if (stream) {
    assertNoDeletedPageReferences(
      parser,
      stream.getDictionary(),
      deletedPageIDs,
      skippedObjectIDs,
      visited,
      depth + 1,
    );
  }
}

/**
 * Checks retained document structures for deleted-page references.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {object} catalog - Catalog entries.
 * @param {number} rootID - Catalog object ID.
 * @param {object} tree - Page-tree root.
 * @param {object|null} pageLabels - Prepared page labels.
 * @param {Set<number>} deletedPageIDs - Object IDs of deleted pages.
 * @param {number} sourcePageCount - Pages in the source.
 * @returns {void}
 * @throws {Error} If a retained structure references a deleted page.
 */
function validateDeletedPageReferences(
  parser,
  catalog,
  rootID,
  tree,
  pageLabels,
  deletedPageIDs,
  sourcePageCount,
) {
  var skippedObjectIDs = new Set([rootID]);
  collectPageTreeObjectIDs(tree, skippedObjectIDs);
  for (var pageIndex = 0; pageIndex < sourcePageCount; pageIndex += 1) {
    skippedObjectIDs.add(parser.getPageObjectID(pageIndex));
  }
  var visited = new Set();
  Object.entries(catalog)
    .filter(([key]) => !["PageLabels", "Pages"].includes(key))
    .forEach(([, value]) =>
      assertNoDeletedPageReferences(
        parser,
        value,
        deletedPageIDs,
        skippedObjectIDs,
        visited,
      ),
    );
  if (pageLabels) {
    Object.entries(pageLabels.values)
      .filter(([key]) => !["Kids", "Limits", "Nums"].includes(key))
      .forEach(([, value]) =>
        assertNoDeletedPageReferences(
          parser,
          value,
          deletedPageIDs,
          skippedObjectIDs,
          visited,
        ),
      );
  }
  // Walks the same tree readPageTree() already parsed - each retained leaf
  // carries the page dictionary values readPageTree() read, so there is no
  // need to re-parse every retained page's dictionary here.
  walkPageTree(tree, (node) => {
    var isLeaf = !node.children;
    var skipKeys = isLeaf ? ["Parent"] : ["Count", "Kids", "Parent"];
    Object.entries(node.values)
      .filter(([key]) => !skipKeys.includes(key))
      .forEach(([, value]) =>
        assertNoDeletedPageReferences(
          parser,
          value,
          deletedPageIDs,
          skippedObjectIDs,
          visited,
        ),
      );
  });
}

/**
 * Collects page-label number-tree entries.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {PDFDictionary} dictionary - Number-tree node.
 * @param {object[]} entries - Receives `{pageIndex, value}` entries.
 * @param {Set<number>} [visited] - Visited object IDs.
 * @param {number} [objectID=0] - Node object ID.
 * @param {number} [depth=0] - Recursion depth.
 * @returns {void}
 * @throws {Error} If the tree is cyclic, too deep, or malformed.
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
  var values = dictionary.toJSObject();
  if (values.Nums) {
    var numbersArray = resolvePageLabelObject(parser, values.Nums).toPDFArray();
    var numbers = numbersArray.toJSArray();
    for (var index = 0; index < numbers.length; index += 2) {
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
      .queryDictionaryObject(dictionary, "Kids")
      .toPDFArray()
      .toJSArray()
      .forEach((entry) => {
        var objectID = entry.toPDFIndirectObjectReference().getObjectID();
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

/** Resolves an indirect chain used by a page-label number tree. @private */
function resolvePageLabelObject(parser, value) {
  var visited = new Set();
  var resolved = value;
  while (resolved?.toPDFIndirectObjectReference?.()) {
    var objectID = resolved.toPDFIndirectObjectReference().getObjectID();
    if (visited.size > 1000 || visited.has(objectID)) {
      throw new Error("deletePage requires valid acyclic PageLabels");
    }
    visited.add(objectID);
    resolved = parser.parseNewObject(objectID);
  }
  return resolved;
}

/** Reads a page-label dictionary into a serializable value. @private */
function readPageLabel(parser, value) {
  var dictionary = value?.toPDFDictionary();
  if (!dictionary) {
    throw new Error("deletePage requires valid PageLabels entries");
  }
  var values = dictionary.toJSObject();
  var style = values.S ? resolvePageLabelObject(parser, values.S) : null;
  var prefix = values.P ? resolvePageLabelObject(parser, values.P) : null;
  var start = values.St ? resolvePageLabelObject(parser, values.St) : null;
  var prefixHex = prefix?.toPDFHexString();
  var prefixLiteral = prefix?.toPDFLiteralString();
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

/** Writes indirect objects for normalized page-label values. @private */
function writePageLabelObjects(objectsContext, entries) {
  return entries.map((entry) => {
    var objectID = objectsContext.startNewIndirectObject();
    var dictionary = objectsContext.startDictionary();
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

/** Writes the number-tree dictionary for page labels. @private */
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

/** Reindexes page labels after removing source pages. @private */
function preparePageLabels(
  parser,
  catalogDictionary,
  deletedPages,
  sourcePageCount,
) {
  var catalogValues = catalogDictionary.toJSObject();
  if (!catalogValues.PageLabels) {
    return null;
  }
  var pageLabelsValue = resolvePageLabelObject(
    parser,
    catalogValues.PageLabels,
  );
  if (pageLabelsValue.toPDFNull()) return null;
  var labelsDictionary = pageLabelsValue.toPDFDictionary();
  if (!labelsDictionary) {
    throw new Error("deletePage requires PageLabels to be a number tree");
  }
  var entries = [];
  var reference = catalogValues.PageLabels.toPDFIndirectObjectReference();
  var values = collectPageLabels(
    parser,
    labelsDictionary,
    entries,
    new Set(),
    reference?.getObjectID(),
  );
  var deletedIndices = new Set(
    Array.from(deletedPages, (pageNumber) => pageNumber - 1),
  );
  var outputIndices = new Map();
  var outputIndex = 0;
  for (var index = 0; index < sourcePageCount; index += 1) {
    if (deletedIndices.has(index)) continue;
    outputIndices.set(index, outputIndex);
    outputIndex += 1;
  }
  var sortedEntries = entries.sort((left, right) => left.index - right.index);
  var normalized = [];
  sortedEntries.forEach((entry, entryIndex) => {
    var rangeEnd = Math.min(
      sortedEntries[entryIndex + 1]?.index ?? sourcePageCount,
      sourcePageCount,
    );
    var startsRun = true;
    for (var index = entry.index; index < rangeEnd; index += 1) {
      if (deletedIndices.has(index)) {
        startsRun = true;
        continue;
      }
      if (startsRun) {
        var offset = index - entry.index;
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
    catalogValues,
    reference,
    values,
    entries: normalized,
  };
}

/** Writes updated page labels and attaches them to the catalog. @private */
function writePageLabels(writer, copyingContext, rootID, pageLabels) {
  if (!pageLabels) return;

  var objectsContext = writer.getObjectsContext();
  var entries = writePageLabelObjects(objectsContext, pageLabels.entries);
  if (pageLabels.reference) {
    objectsContext.startModifiedIndirectObject(
      pageLabels.reference.getObjectID(),
    );
    var labelsDictionary = objectsContext.startDictionary();
    writePageLabelsDictionary(
      objectsContext,
      copyingContext,
      labelsDictionary,
      pageLabels.values,
      entries,
    );
    objectsContext.endDictionary(labelsDictionary).endIndirectObject();
    return;
  }

  var labelsObjectID = objectsContext.startNewIndirectObject();
  var labelsDictionary = objectsContext.startDictionary();
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
  var dictionary = objectsContext.startDictionary();
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
 * Reports whether a page is still open, for new pages and edited pages alike.
 * Document-level operations close the active page before they run, so the
 * writer never has to finalize around an open content stream.
 */
export function hasActivePage(recipe) {
  return recipe._contextState !== PAGE_CONTEXT_STATE.IDLE;
}

/**
 * Finishes an open page on behalf of a document-level operation, so a caller
 * that forgot {@link Recipe#endPage} keeps that page instead of losing it to a
 * writer that cannot finalize around an open content stream.
 */
export function endActivePage(recipe) {
  if (hasActivePage(recipe)) recipe.endPage();
  return recipe;
}

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
      if (this._deletedPages?.size) {
        throw new Error("createPage cannot be combined with deletePage");
      }
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
        this._pagesCreated = true;
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
      this._contextState = PAGE_CONTEXT_STATE.ACTIVE_NEW;
      this.margins(margins || this.default.pageMargin);
      // Node Recipe ends createPage with moveTo(0, 0). Implicit text and
      // layout still use their margin fallbacks when the text cursor is zero.
      this._cursor = { x: 0, y: 0 };
      this._textCursor = { x: 0, y: 0 };
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
      // Validate before closing a content context or consuming the queue, so
      // invalid options leave the page in the same state on every attempt.
      if (this._pageHeight) this._flushAnnotations(true);
      // Annotations and links are indirect objects, so every branch closes
      // the page's open content stream before writing them; writing them
      // into an open stream corrupts its compressed data.
      if (this._editingPage) {
        if (this._contextState === PAGE_CONTEXT_STATE.ACTIVE_EDIT) {
          this._page.endContext();
        }
        this._flushAnnotations();
        this._page.writePage();
        this._pageContext = null;
        this._page = null;
        this._editingPage = false;
        this._pageHeight = 0;
        this._pageWidth = 0;
        this._contextState = PAGE_CONTEXT_STATE.IDLE;
        return this;
      }
      if (this._sourceMode) {
        if (!this._pageContext) return this;
        if (
          (this._annotations.length || this._links.length) &&
          this._contextState === PAGE_CONTEXT_STATE.ACTIVE_NEW
        )
          this.writer.pausePageContentContext(this._pageContext);
        this._flushAnnotations();
        this.writer.writePage(this._page);
        this._pageContext = null;
        this._page = null;
        this._pageHeight = 0;
        this._pageWidth = 0;
        this._contextState = PAGE_CONTEXT_STATE.IDLE;
        return this;
      }
      if (!this._recipe || !this._pageHeight) return this;
      if (
        (this._annotations.length || this._links.length) &&
        this._contextState === PAGE_CONTEXT_STATE.ACTIVE_NEW
      )
        call("_muhammara_wasm_recipe_pause_page", this._recipe);
      this._flushAnnotations();
      call("_muhammara_wasm_recipe_end_page", this._recipe);
      this._pageHeight = 0;
      this._pageWidth = 0;
      this._contextState = PAGE_CONTEXT_STATE.IDLE;
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
            if (key === "Trapped") {
              if (typeof value.value === "string") {
                sourceInfo.trapped = value.value;
              }
              return;
            }
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
      var info = this.writer.getDocumentContext().getInfoDictionary();
      standardInfoKeys.forEach((key) => {
        if (sourceInfo[key]) info[key] = sourceInfo[key];
      });
      this._sourceMode = true;
      this._isNewPDF = false;
      this._pages = pages;
      this._sourceBytes = bytes;
      this._sourceInfo = sourceInfo;
      this._sourcePageCount = pages.length;
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
      this._contextState = PAGE_CONTEXT_STATE.ACTIVE_EDIT;
      this._modifiedSourcePages.add(pageNumber);
      this._activePageNumber = pageNumber;
      this._pageWidth = page.width;
      this._pageHeight = page.height;
      this._textCursor = { x: this._margin.left, y: this._margin.top };
      this._resumePageRotation();
      return this;
    },

    /**
     * Deletes one or more pages from an existing PDF.
     * Page numbers are one-based and refer to the original source document.
     *
     * @name deletePage
     * @function
     * @memberof Recipe#
     * @param {number|number[]} pageNumbers - Page number or page numbers to delete.
     * @returns {Recipe} The Recipe instance.
     * @throws {RangeError} If a page number does not identify an original page.
     * @throws {Error} If the Recipe has no existing source, has ended or was
     * disposed, would delete every page, combines deletion with page
     * composition. Page-tree, retained-reference, and object-generation
     * validation is deferred to endPDF(), which throws those errors during
     * finalization.
     */
    deletePage: function (pageNumbers) {
      if (this._disposed) {
        throw new Error("Cannot delete a page after disposal");
      }
      if (this._endedBytes || this._rebuiltBytes || this._endError) {
        throw new Error("Cannot delete a page after endPDF");
      }
      if (!this._sourceMode) {
        throw new Error("deletePage requires an existing PDF");
      }
      if (this._insertions) {
        throw new Error("deletePage cannot be combined with insertPage");
      }
      if (this._pagesAppended) {
        throw new Error("deletePage cannot be combined with appendPage");
      }
      if (this._pagesCreated) {
        throw new Error("deletePage cannot be combined with createPage");
      }
      pageNumbers = Array.isArray(pageNumbers) ? pageNumbers : [pageNumbers];
      var deletedPages = new Set(this._deletedPages || []);
      pageNumbers.forEach((pageNumber) => {
        if (
          !Number.isInteger(pageNumber) ||
          pageNumber < 1 ||
          pageNumber > this._sourcePageCount
        ) {
          throw new RangeError("pageNumber must identify an existing page");
        }
        deletedPages.add(pageNumber);
      });
      if (deletedPages.size >= this._sourcePageCount) {
        throw new Error("At least one page must remain in the PDF");
      }
      this._deletedPages = deletedPages;
      return this;
    },

    /** Applies queued page deletions during finalization. @private */
    _deletePages: function () {
      if (!this._deletedPages?.size) return this;

      var copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
      try {
        var parser = copyingContext.getSourceDocumentParser();
        var trailer = parser.getTrailer().toJSObject();
        var rootReference = trailer.Root.toPDFIndirectObjectReference();
        var rootID = rootReference.getObjectID();
        var catalogDictionary = parser.parseNewObject(rootID).toPDFDictionary();
        var catalog = catalogDictionary.toJSObject();
        var pagesReference = catalog.Pages.toPDFIndirectObjectReference();
        var pageLabels = preparePageLabels(
          parser,
          catalogDictionary,
          this._deletedPages,
          this._sourcePageCount,
        );
        var modifiedPageIDs = new Set(
          Array.from(this._modifiedSourcePages, (pageNumber) =>
            parser.getPageObjectID(pageNumber - 1),
          ),
        );
        var pageState = {
          pageNumber: 0,
          deletedPageIDs: new Set(),
          retainedPageIDs: new Set(),
        };
        var tree = readPageTree(
          parser,
          pagesReference.getObjectID(),
          this._deletedPages,
          modifiedPageIDs,
          pageState,
          pagesReference.getVersion(),
        );
        pageState.retainedPageIDs.forEach((objectID) =>
          pageState.deletedPageIDs.delete(objectID),
        );
        assertSupportedModifiedGenerations(
          tree,
          pageLabels,
          rootReference,
          this.writer,
        );
        validateDeletedPageReferences(
          parser,
          catalog,
          rootID,
          tree,
          pageLabels,
          pageState.deletedPageIDs,
          this._sourcePageCount,
        );
        writePageTree(this.writer, copyingContext, tree);
        writePageLabels(this.writer, copyingContext, rootID, pageLabels);
      } finally {
        copyingContext.end();
      }

      this._pages = this._pages
        .filter((page) => !this._deletedPages.has(page.pageNumber))
        .map((page, index) => ({ ...page, pageNumber: index + 1 }));
      Object.keys(this.metadata)
        .filter((key) => /^\d+$/.test(key))
        .forEach((key) => delete this.metadata[key]);
      this.metadata.pages = this._pages.length;
      this._pages.forEach((page) => {
        this.metadata[page.pageNumber] = {
          ...page,
          mediaBox: page.mediaBox.slice(),
          size: page.size.slice(),
        };
      });
      this._activePageNumber = 0;
      this._deletedPages = null;
      return this;
    },

    /**
     * Pauses the active created-page or edited-page content context. Page
     * editing remains active, and a later resume restores the page's rotated,
     * top-left Recipe coordinate transform.
     *
     * @name pauseContext
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no active page content context.
     */
    pauseContext: function () {
      if (this._contextState === PAGE_CONTEXT_STATE.ACTIVE_EDIT) {
        this._page.endContext();
        this._pageContext = null;
        this._contextState = PAGE_CONTEXT_STATE.PAUSED_EDIT;
      } else if (this._contextState === PAGE_CONTEXT_STATE.ACTIVE_NEW) {
        if (this._sourceMode) {
          this.writer.pausePageContentContext(this._pageContext);
        } else {
          call("_muhammara_wasm_recipe_pause_page", this._recipe);
        }
        this._contextState = PAGE_CONTEXT_STATE.PAUSED_NEW;
      } else {
        throw new Error("No active page content context to pause");
      }
      return this;
    },

    /**
     * Resumes a paused created-page or edited-page content context. The page
     * rotation transform is reapplied so subsequent drawing continues in
     * Recipe's top-left coordinate system.
     *
     * @name resumeContext
     * @function
     * @memberof Recipe#
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If there is no paused page content context.
     */
    resumeContext: function () {
      if (this._contextState === PAGE_CONTEXT_STATE.PAUSED_EDIT) {
        this._pageContext = this._page.startContext().getContext();
        this._resumePageRotation();
        this._contextState = PAGE_CONTEXT_STATE.ACTIVE_EDIT;
      } else if (this._contextState === PAGE_CONTEXT_STATE.PAUSED_NEW) {
        this._contextState = PAGE_CONTEXT_STATE.ACTIVE_NEW;
      } else {
        throw new Error("No paused page content context to resume");
      }
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
