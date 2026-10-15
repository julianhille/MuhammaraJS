// Finds and prunes references to deleted pages in the structures deletePage()
// retains: the catalog, retained pages and every object reachable from them.

var REFERENCED_PAGE_ERROR =
  "deletePage cannot remove a page referenced by retained document structures";

// Holders pruning cannot rewrite, named for the error message.
var UNSUPPORTED_HOLDERS = Object.freeze({
  stream: "a stream dictionary",
  pages: "the page tree",
  pageLabels: "the page labels",
});

/**
 * @private
 * @param {object} value - A PDF object.
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @returns {boolean} Whether the value is a reference to a deleted page.
 */
function isDeletedPageReference(value, deletedPageIDs) {
  var reference = value?.toPDFIndirectObjectReference?.();
  return Boolean(reference && deletedPageIDs.has(reference.getObjectID()));
}

/**
 * @private
 * @param {object} value - A PDF object.
 * @returns {Object|null} The value as an array, or null.
 */
function asArray(value) {
  return (
    value.toPDFArray?.() ||
    (typeof value.toJSArray === "function" ? value : null)
  );
}

/**
 * @private
 * @param {object} value - A PDF object.
 * @returns {Object|null} The value as a dictionary, or null.
 */
function asDictionary(value) {
  return (
    value.toPDFDictionary?.() ||
    (typeof value.toJSObject === "function" ? value : null)
  );
}

/**
 * A pruned value is a reference to a deleted page, or a destination array
 * whose page is a deleted page. Pruning replaces it with null.
 * @private
 * @param {object} value - A PDF object.
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @returns {boolean} Whether pruning drops the whole value.
 */
function isPrunedValue(value, deletedPageIDs) {
  if (isDeletedPageReference(value, deletedPageIDs)) return true;
  var array = value.toPDFIndirectObjectReference?.() ? null : asArray(value);
  if (!array) return false;
  var entries = array.toJSArray();
  return (
    entries.length > 0 && isDeletedPageReference(entries[0], deletedPageIDs)
  );
}

/**
 * Walk the direct and indirect values reachable from retained structures and
 * record which holder directly contains a deleted-page reference. A holder is
 * the catalog entry, retained page or indirect object whose own value holds
 * the reference.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} [value] - The PDF object to scan.
 * @param {object} holder - The holder the value belongs to.
 * @param {object} scan - Shared scan state: deletedPageIDs, skippedObjectIDs,
 *   visited, prune and the holders found.
 * @param {number} [depth=0] - The nesting depth, limited to 1000.
 * @returns {void}
 * @throws {Error} If a retained structure references a deleted page and
 *   pruning is off, or nesting is too deep.
 */
function scanValue(parser, value, holder, scan, depth = 0) {
  if (!value) return;
  if (depth > 1000) {
    throw new Error("deletePage cannot validate deeply nested references");
  }
  var reference = value.toPDFIndirectObjectReference?.();
  if (reference) {
    var objectID = reference.getObjectID();
    if (scan.deletedPageIDs.has(objectID)) {
      if (!scan.prune) throw new Error(REFERENCED_PAGE_ERROR);
      scan.holders.push(holder);
      return;
    }
    if (scan.skippedObjectIDs.has(objectID) || scan.visited.has(objectID)) {
      return;
    }
    scan.visited.add(objectID);
    var object = parser.parseNewObject(objectID);
    var stream = object?.toPDFStream?.();
    scanValue(
      parser,
      stream ? stream.getDictionary() : object,
      stream
        ? { kind: "stream", objectID }
        : { kind: "object", objectID, generation: reference.getVersion() },
      scan,
      depth + 1,
    );
    return;
  }
  var array = asArray(value);
  if (array) {
    array
      .toJSArray()
      .forEach((entry) => scanValue(parser, entry, holder, scan, depth + 1));
    return;
  }
  var dictionary = asDictionary(value);
  if (dictionary) {
    Object.values(dictionary.toJSObject()).forEach((entry) =>
      scanValue(parser, entry, holder, scan, depth + 1),
    );
    return;
  }
  var stream = value.toPDFStream?.();
  if (stream) {
    scanValue(
      parser,
      stream.getDictionary(),
      { kind: "stream" },
      scan,
      depth + 1,
    );
  }
}

/**
 * Find the retained structures that reference deleted pages. Without
 * pruning, the first reference throws. With pruning, the result lists the
 * objects and catalog entries to rewrite.
 * @private
 * @param {object} parser - The source PDF parser.
 * @param {object} deletion - The deletion: catalog entries, rootID, the page
 *   tree built by readPageTree(), prepared pageLabels, deletedPageIDs,
 *   modifiedPageIDs and sourcePageCount.
 * @param {boolean} prune - Whether to plan pruning instead of throwing.
 * @returns {{objects: Map<number, number>, catalogKeys: string[]}} The
 *   object IDs to rewrite with their generations, and the catalog keys to
 *   replace.
 * @throws {Error} If a reference cannot be pruned, or pruning is off and a
 *   retained structure references a deleted page.
 */
export function planDeletedPageReferences(parser, deletion, prune) {
  var scan = {
    deletedPageIDs: deletion.deletedPageIDs,
    skippedObjectIDs: new Set([deletion.rootID]),
    visited: new Set(),
    prune,
    holders: [],
  };
  var pagesNodeIDs = new Set();
  var pending = [deletion.tree];
  while (pending.length) {
    var node = pending.pop();
    if (node.children) {
      pagesNodeIDs.add(node.objectID);
      pending.push(...node.children);
    }
  }
  pagesNodeIDs.forEach((objectID) => scan.skippedObjectIDs.add(objectID));
  for (var pageIndex = 0; pageIndex < deletion.sourcePageCount; pageIndex++) {
    scan.skippedObjectIDs.add(parser.getPageObjectID(pageIndex));
  }

  Object.entries(deletion.catalog)
    .filter(([key]) => !["PageLabels", "Pages"].includes(key))
    .forEach(([key, value]) =>
      scanValue(parser, value, { kind: "catalog", key }, scan),
    );
  if (deletion.pageLabels) {
    Object.entries(deletion.pageLabels.values)
      .filter(([key]) => !["Kids", "Limits", "Nums"].includes(key))
      .forEach(([, value]) =>
        scanValue(parser, value, { kind: "pageLabels" }, scan),
      );
  }
  var retained = [deletion.tree];
  while (retained.length) {
    var node = retained.pop();
    var isLeaf = !node.children;
    var skipKeys = isLeaf ? ["Parent"] : ["Count", "Kids", "Parent"];
    var holder = isLeaf
      ? { kind: "page", objectID: node.objectID, generation: node.generation }
      : { kind: "pages" };
    Object.entries(node.values)
      .filter(([key]) => !skipKeys.includes(key))
      .forEach(([, value]) => scanValue(parser, value, holder, scan));
    if (node.children) retained.push(...node.children);
  }

  var objects = new Map();
  var catalogKeys = [];
  scan.holders.forEach((holder) => {
    if (holder.kind === "catalog") {
      if (!catalogKeys.includes(holder.key)) catalogKeys.push(holder.key);
      return;
    }
    if (
      holder.kind === "page" &&
      deletion.modifiedPageIDs.has(holder.objectID)
    ) {
      throw new Error(
        "deletePage cannot prune references held by a page edited in this Recipe",
      );
    }
    if (holder.kind !== "object" && holder.kind !== "page") {
      throw new Error(
        `deletePage cannot prune references held by ${UNSUPPORTED_HOLDERS[holder.kind]}`,
      );
    }
    if (holder.generation !== 0) {
      throw new Error(
        "deletePage does not support rewriting nonzero-generation objects",
      );
    }
    objects.set(holder.objectID, holder.generation);
  });
  return { objects, catalogKeys };
}

/**
 * @private
 * @param {object} value - A direct PDF object.
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @returns {boolean} Whether the value directly contains a pruned value.
 */
function containsPrunedValue(value, deletedPageIDs) {
  if (isPrunedValue(value, deletedPageIDs)) return true;
  if (value.toPDFIndirectObjectReference?.()) return false;
  var array = asArray(value);
  if (array) {
    return array
      .toJSArray()
      .some((entry) => containsPrunedValue(entry, deletedPageIDs));
  }
  var dictionary = asDictionary(value);
  if (dictionary) {
    return Object.values(dictionary.toJSObject()).some((entry) =>
      containsPrunedValue(entry, deletedPageIDs),
    );
  }
  return false;
}

/**
 * Plan how to write a direct value with every pruned value removed:
 * dictionary entries are dropped and array elements become null. A changed
 * dictionary nested inside the value is written right away as its own
 * indirect object and referenced from the plan, so writing the value never
 * nests dictionaries, which the Wasm objects context does not support.
 * @private
 * @param {object} objectsContext - The writer's objects context.
 * @param {object} copyingContext - Copies unchanged values.
 * @param {object} value - A direct PDF object that is not itself pruned.
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @param {boolean} [nested=false] - Whether the value is inside another.
 * @returns {object} The write plan: copy, null, ref, array or dict.
 */
function planPrunedValue(
  objectsContext,
  copyingContext,
  value,
  deletedPageIDs,
  nested = false,
) {
  if (isPrunedValue(value, deletedPageIDs)) return { kind: "null" };
  if (!containsPrunedValue(value, deletedPageIDs)) {
    return { kind: "copy", value };
  }
  var array = asArray(value);
  if (array) {
    return {
      kind: "array",
      items: array
        .toJSArray()
        .map((entry) =>
          planPrunedValue(
            objectsContext,
            copyingContext,
            entry,
            deletedPageIDs,
            true,
          ),
        ),
    };
  }
  var entries = Object.entries(asDictionary(value).toJSObject())
    .filter(([, entry]) => !isPrunedValue(entry, deletedPageIDs))
    .map(([key, entry]) => [
      key,
      planPrunedValue(
        objectsContext,
        copyingContext,
        entry,
        deletedPageIDs,
        true,
      ),
    ]);
  var plan = { kind: "dict", entries };
  if (!nested) return plan;
  var objectID = objectsContext.startNewIndirectObject();
  writePrunedPlan(objectsContext, copyingContext, plan);
  objectsContext.endIndirectObject();
  return { kind: "ref", objectID };
}

/**
 * Write a plan built by planPrunedValue().
 * @private
 * @param {object} objectsContext - The writer's objects context.
 * @param {object} copyingContext - Copies unchanged values.
 * @param {object} plan - The write plan.
 * @returns {void}
 */
function writePrunedPlan(objectsContext, copyingContext, plan) {
  if (plan.kind === "copy") {
    copyingContext.copyDirectObjectAsIs(plan.value);
  } else if (plan.kind === "null") {
    objectsContext.writeKeyword("null");
  } else if (plan.kind === "ref") {
    objectsContext.writeIndirectObjectReference(plan.objectID);
  } else if (plan.kind === "array") {
    objectsContext.startArray();
    plan.items.forEach((item) =>
      writePrunedPlan(objectsContext, copyingContext, item),
    );
    objectsContext.endArray();
  } else {
    var dictionary = objectsContext.startDictionary();
    plan.entries.forEach(([key, item]) => {
      dictionary.writeKey(key);
      writePrunedPlan(objectsContext, copyingContext, item);
    });
    objectsContext.endDictionary(dictionary);
  }
}

/**
 * Replaces a catalog entry when the modifier writes the catalog.
 * @private
 * @param {object} writer - The PDF modifier.
 * @param {string} key - The catalog key.
 * @param {number} objectID - The new value's object ID, or 0 for null.
 * @returns {void}
 */
export function setCatalogEntry(writer, key, objectID) {
  writer._setCatalogEntry(key, objectID);
}

/**
 * Rewrite the planned objects and catalog entries without their references
 * to deleted pages.
 * @private
 * @param {object} writer - The PDF writer.
 * @param {object} copyingContext - Copies unchanged values.
 * @param {object} catalog - The catalog entries.
 * @param {{objects: Map<number, number>, catalogKeys: string[]}} plan - The
 *   result of planDeletedPageReferences().
 * @param {Set<number>} deletedPageIDs - Object IDs of the deleted pages.
 * @returns {void}
 */
export function pruneDeletedPageReferences(
  writer,
  copyingContext,
  catalog,
  plan,
  deletedPageIDs,
) {
  var objectsContext = writer.getObjectsContext();
  var parser = copyingContext.getSourceDocumentParser();
  plan.objects.forEach((generation, objectID) => {
    var plan = planPrunedValue(
      objectsContext,
      copyingContext,
      parser.parseNewObject(objectID),
      deletedPageIDs,
    );
    objectsContext.startModifiedIndirectObject(objectID);
    writePrunedPlan(objectsContext, copyingContext, plan);
    objectsContext.endIndirectObject();
  });
  plan.catalogKeys.forEach((key) => {
    var value = catalog[key];
    if (isPrunedValue(value, deletedPageIDs)) {
      setCatalogEntry(writer, key, 0);
      return;
    }
    var plan = planPrunedValue(
      objectsContext,
      copyingContext,
      value,
      deletedPageIDs,
    );
    var objectID = objectsContext.startNewIndirectObject();
    writePrunedPlan(objectsContext, copyingContext, plan);
    objectsContext.endIndirectObject();
    setCatalogEntry(writer, key, objectID);
  });
}
