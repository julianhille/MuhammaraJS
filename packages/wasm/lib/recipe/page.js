import { standardInfoKeys } from "../recipe-info.js";
import { mediumSizes } from "./parameters.js";
import { pageRecord } from "./page-record.js";
import { PAGE_CONTEXT_STATE } from "./context-state.js";
import {
  planDeletedPageReferences,
  pruneDeletedPageReferences,
  setCatalogEntry,
} from "./page-references.js";

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
  var kids = parser.queryDictionaryObject(dictionary, "Kids")?.toPDFArray();
  if (!kids) {
    throw new Error("deletePage requires a valid page tree");
  }
  var mappedChildren = kids.toJSArray().map((entry) => {
    // Kids must be references to page tree dictionaries with a /Type.
    var reference = entry.toPDFIndirectObjectReference();
    var childID = reference?.getObjectID();
    var childDictionary =
      childID === undefined
        ? null
        : parser.parseNewObject(childID)?.toPDFDictionary();
    if (!childDictionary) {
      throw new Error("deletePage requires a valid page tree");
    }
    var childValues = childDictionary.toJSObject();
    var parentReference = childValues.Parent?.toPDFIndirectObjectReference();
    if (
      !parentReference ||
      parentReference.getObjectID() !== objectID ||
      parentReference.getVersion() !== generation
    ) {
      throw new Error("deletePage requires a valid page tree");
    }
    var type = childValues.Type?.toPDFName()?.value;
    if (type === undefined) {
      throw new Error("deletePage requires a valid page tree");
    }
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
 * Rejects page-tree objects that cannot be rewritten safely. The catalog is
 * never rewritten in place, so its generation does not matter.
 * @private
 * @param {object} tree - Page-tree root.
 * @param {object|null} pageLabels - Prepared page labels.
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

/**
 * Resolves an indirect chain used by a page-label number tree.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {PDFObject} value - Direct value or reference.
 * @returns {PDFObject} The resolved value.
 * @throws {Error} If the chain is cyclic or too long.
 */
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

/**
 * Reads a page-label dictionary into a serializable value.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {PDFObject} value - Page-label dictionary.
 * @returns {{style: (string|undefined), prefix: (object|undefined), start: (number|undefined)}} The label.
 * @throws {Error} If `value` is not a dictionary.
 */
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
 * Writes indirect objects for normalized page-label values.
 * @private
 * @param {ObjectsContext} objectsContext - Objects context.
 * @param {object[]} entries - Normalized entries.
 * @returns {Array<{pageIndex: number, objectID: number}>} The written objects.
 */
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

/**
 * Writes the number-tree dictionary for page labels.
 * @private
 * @param {ObjectsContext} objectsContext - Objects context.
 * @param {DocumentCopyingContext} copyingContext - Copies unchanged values.
 * @param {DictionaryContext} dictionary - Open dictionary.
 * @param {object} values - Existing entries.
 * @param {Array<{pageIndex: number, objectID: number}>} entries - Written label objects.
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

/**
 * Reindexes page labels after removing source pages.
 * @private
 * @param {PDFReader} parser - Source parser.
 * @param {PDFDictionary} catalogDictionary - Catalog.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {number} sourcePageCount - Pages in the source.
 * @returns {object|null} Reindexed labels, or null without labels.
 * @throws {Error} If the labels are malformed.
 */
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
    reference,
    values,
    entries: normalized,
  };
}

/**
 * Writes updated page labels and attaches them to the catalog.
 * @private
 * @param {PDFModifier} writer - Modifier.
 * @param {DocumentCopyingContext} copyingContext - Copies unchanged values.
 * @param {object|null} pageLabels - Prepared labels.
 * @returns {void}
 */
function writePageLabels(writer, copyingContext, pageLabels) {
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

  setCatalogEntry(writer, "PageLabels", labelsObjectID);
}

/**
 * Reads the page tree and checks that the queued deletions can be applied:
 * the page tree and page labels can be rewritten, and every retained
 * reference to a deleted page can be pruned or there is none.
 * @private
 * @param {Recipe} recipe - Recipe instance.
 * @param {DocumentCopyingContext} copyingContext - Copying context for the
 *   modified file.
 * @param {Set<number>} deletedPages - One-based page numbers to delete.
 * @param {boolean} prune - Whether to prune references to deleted pages.
 * @returns {object} The page tree, page labels, catalog entries, deleted
 *   page object IDs and the pruning plan.
 * @throws {Error} If the deletion cannot be applied.
 */
function planPageDeletion(recipe, copyingContext, deletedPages, prune) {
  var parser = copyingContext.getSourceDocumentParser();
  var trailer = parser.getTrailer().toJSObject();
  var rootID = trailer.Root.toPDFIndirectObjectReference().getObjectID();
  var catalogDictionary = parser.parseNewObject(rootID).toPDFDictionary();
  var catalog = catalogDictionary.toJSObject();
  var pagesReference = catalog.Pages.toPDFIndirectObjectReference();
  var pageLabels = preparePageLabels(
    parser,
    catalogDictionary,
    deletedPages,
    recipe._sourcePageCount,
  );
  var modifiedPageIDs = new Set(
    Array.from(recipe._modifiedSourcePages, (pageNumber) =>
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
    deletedPages,
    modifiedPageIDs,
    pageState,
    pagesReference.getVersion(),
  );
  pageState.retainedPageIDs.forEach((objectID) =>
    pageState.deletedPageIDs.delete(objectID),
  );
  assertSupportedModifiedGenerations(tree, pageLabels);
  var plan = planDeletedPageReferences(
    parser,
    {
      catalog,
      rootID,
      tree,
      pageLabels,
      deletedPageIDs: pageState.deletedPageIDs,
      modifiedPageIDs,
      sourcePageCount: recipe._sourcePageCount,
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
 * Forgets the previous page's text box, so text() without coordinates starts
 * at the margins of the new active page and movedown() does not return to the
 * previous page's text box origin.
 * @private
 * @param {Recipe} recipe - Recipe instance.
 * @returns {void}
 */
function resetTextBox(recipe) {
  recipe._textBoxOrigin = null;
  recipe._textOptions = null;
}

/**
 * Reports whether a page is still open, for new pages and edited pages alike.
 * Document-level operations close the active page before they run, so the
 * writer never has to finalize around an open content stream.
 * @param {Recipe} recipe - Recipe instance.
 * @returns {boolean} Whether a page is open.
 */
export function hasActivePage(recipe) {
  return recipe._contextState !== PAGE_CONTEXT_STATE.IDLE;
}

/**
 * Finishes an open page on behalf of a document-level operation, so a caller
 * that forgot {@link Recipe#endPage} keeps that page instead of losing it to a
 * writer that cannot finalize around an open content stream.
 * @param {Recipe} recipe - Recipe instance.
 * @returns {Recipe} The Recipe instance.
 * @throws {Error} If the page cannot be ended.
 */
export function endActivePage(recipe) {
  if (hasActivePage(recipe)) recipe.endPage();
  return recipe;
}

/**
 * Creates Recipe page creation, inspection, and editing methods.
 * @param {Function} call - Calls a Recipe export and throws on failure.
 * @param {{createReader: Function, createWriterToModify: Function, module: object}} dependencies - Low-level factories and module.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
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
     * @throws {Error} If another page is still active; call `endPage()` first.
     */
    createPage: function (width, height, margins) {
      if (this._endedBytes)
        throw new Error("Cannot create a page after endPDF");
      if (this._deletedPages?.size) {
        throw new Error("createPage cannot be combined with deletePage");
      }
      if (this._editingPage || this._pageHeight) {
        throw new Error("Finish the current page before creating another page");
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
      resetTextBox(this);
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
     * @param {Uint8Array} bytes - PDF bytes.
     * @returns {{pages: object[], metadata: object, sourceInfo: object}} Page records, metadata, and Info values.
     * @throws {Error} If the bytes cannot be parsed.
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
     * @param {Uint8Array} bytes - PDF bytes.
     * @returns {void}
     * @throws {Error} If the bytes cannot be parsed or opened.
     */
    _openSource: function (bytes) {
      var { pages, metadata, sourceInfo } = this._inspectBytes(bytes);
      if (this._recipe) {
        module._muhammara_wasm_recipe_destroy(this._recipe);
        this._recipe = 0;
        this._releaseImageCopies();
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
      resetTextBox(this);
      this._resumePageRotation();
      return this;
    },

    /**
     * Deletes one or more pages from an existing PDF.
     * Page numbers are one-based and refer to the original source document.
     *
     * By default a page that retained structures still reference - outline
     * items, link annotations and named destinations, form widgets,
     * tagged-PDF structure elements or the open action - cannot be deleted.
     * With `pruneReferences`, those references are removed instead: a
     * destination that targets a deleted page becomes null (so outline items
     * keep their title and children, and links do nothing), and every other
     * direct reference to a deleted page is dropped. Pruning applies to every
     * queued deletion once any deletePage() call enables it.
     *
     * @name deletePage
     * @function
     * @memberof Recipe#
     * @param {number|number[]} pageNumbers - Page number or page numbers to delete.
     * @param {object} [options] - Deletion options.
     * @param {boolean} [options.pruneReferences=false] - Remove references to
     *   the deleted pages from retained structures instead of refusing the
     *   deletion.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If options is not an object or pruneReferences is
     * not a boolean.
     * @throws {RangeError} If a page number does not identify an original page.
     * @throws {Error} If the Recipe has no existing source, has ended or was
     * disposed, would delete every page, combines deletion with page
     * composition, or the page tree, page labels or retained references
     * cannot be rewritten. A failed call leaves the queued deletions
     * unchanged.
     */
    deletePage: function (pageNumbers, options) {
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
      if (
        options !== undefined &&
        (options === null ||
          typeof options !== "object" ||
          Array.isArray(options))
      ) {
        throw new TypeError("deletePage expects an options object");
      }
      var pruneReferences = options?.pruneReferences;
      if (
        pruneReferences !== undefined &&
        typeof pruneReferences !== "boolean"
      ) {
        throw new TypeError("deletePage pruneReferences must be a boolean");
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
      var prune = Boolean(this._pruneReferences || pruneReferences);
      var copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
      try {
        planPageDeletion(this, copyingContext, deletedPages, prune);
      } finally {
        copyingContext.end();
      }
      this._deletedPages = deletedPages;
      this._pruneReferences = prune;
      return this;
    },

    /**
     * Applies queued page deletions during finalization, pruning references
     * to deleted pages when enabled.
     * @private
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If the page tree, page labels or retained references
     *   cannot be rewritten safely, for example after editing a page that
     *   holds a pruned reference.
     */
    _deletePages: function () {
      if (!this._deletedPages?.size) return this;

      var copyingContext = this.writer.createPDFCopyingContextForModifiedFile();
      try {
        var deletion = planPageDeletion(
          this,
          copyingContext,
          this._deletedPages,
          Boolean(this._pruneReferences),
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
     * @returns {Recipe} The Recipe instance.
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

/**
 * Updates the active Recipe page metadata after changing its media box.
 * @param {Recipe} recipe - Recipe instance.
 * @param {PDFRectangle} mediaBox - New media box.
 * @returns {void}
 */
export function updateMediaBox(recipe, mediaBox) {
  var page = recipe._pages[recipe._pages.length - 1];
  if (!page) return;
  Object.assign(page, pageRecord(page.pageNumber, mediaBox, page.rotate));
  recipe._pageWidth = page.width;
  recipe._pageHeight = page.height;
}
