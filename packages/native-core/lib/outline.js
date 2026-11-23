// Bookmarks, the document outline of a PDF (ISO 32000-2, 12.3.3). Mirrored in
// packages/wasm/lib/outline.js; keep both files identical apart from the
// module syntax.

var MAX_DEPTH = 64;
// the largest number a PDF integer holds, so all viewers and both ends agree
var MAX_NUMBER = 2147483647;
var OPTION_KEYS = ["open", "x", "y", "zoom", "children"];

/**
 * @param {*} value - Any value.
 * @returns {boolean} Whether it is a plain object, no array and no null.
 */
function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/**
 * Check a bookmark and the bookmarks nested in it, and fill in its defaults.
 * @param {string} title - The title.
 * @param {number} pageNumber - The one-based number of the page it opens.
 * @param {Object} [options] - The options of `bookmark()`.
 * @param {number} [depth=1] - The nesting level of this bookmark.
 * @returns {{title: string, pageNumber: number, open: boolean, x: (number|undefined), y: (number|undefined), zoom: (number|undefined), children: Object[]}}
 *   The bookmark to write.
 * @throws {TypeError} If the title is empty, contains NUL or is not a string,
 *   the options are no object, an option is unknown or has the wrong type,
 *   `x`, `y` or `zoom` exceeds 2147483647, only one of `x` and `y` is given,
 *   or a child is no object.
 * @throws {RangeError} If the page number is no positive integer, or the
 *   bookmarks nest deeper than 64 levels.
 */
function outlineNode(title, pageNumber, options, depth = 1) {
  if (typeof title !== "string" || title === "") {
    throw new TypeError("A bookmark needs a title");
  }
  if (title.includes("\0")) {
    throw new TypeError("A bookmark title cannot contain NUL");
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new RangeError("pageNumber must identify an existing page");
  }
  if (depth > MAX_DEPTH) {
    throw new RangeError(`Bookmarks can nest at most ${MAX_DEPTH} levels`);
  }
  // null options act like omitted options
  options = options ?? {};
  if (!isObject(options)) {
    throw new TypeError("The options of a bookmark must be an object");
  }
  Object.keys(options).forEach((key) => {
    if (!OPTION_KEYS.includes(key)) {
      throw new TypeError(`Unknown bookmark option ${key}`);
    }
  });
  var { open = false, x, y, zoom, children = [] } = options;
  if (typeof open !== "boolean") {
    throw new TypeError("The open option of a bookmark must be a boolean");
  }
  [x, y].forEach((value) => {
    if (
      value !== undefined &&
      (typeof value !== "number" || !(Math.abs(value) <= MAX_NUMBER))
    ) {
      throw new TypeError(
        `The x and y of a bookmark must be numbers within ${MAX_NUMBER}`,
      );
    }
  });
  if ((x === undefined) !== (y === undefined)) {
    throw new TypeError("A bookmark needs x and y together");
  }
  if (
    zoom !== undefined &&
    (typeof zoom !== "number" || !(zoom > 0 && zoom <= MAX_NUMBER))
  ) {
    throw new TypeError(
      `The zoom of a bookmark must be a positive number up to ${MAX_NUMBER}`,
    );
  }
  if (!Array.isArray(children)) {
    throw new TypeError("The children of a bookmark must be an array");
  }
  return {
    title,
    pageNumber,
    open,
    x,
    y,
    zoom,
    // Array.from reads holes of a sparse array as undefined, so they throw here
    children: Array.from(children, (child) => {
      if (!isObject(child)) {
        throw new TypeError("A child bookmark must be an object");
      }
      var { title, pageNumber, ...rest } = child;
      return outlineNode(title, pageNumber, rest, depth + 1);
    }),
  };
}

/**
 * Write the outline: its root and one item per bookmark, linked as the
 * outline tree wants them.
 * @param {Object} objects - The objects context of the writer.
 * @param {Object[]} nodes - The top level bookmarks, see `outlineNode()`.
 * @param {number} pageCount - The number of pages of the document.
 * @param {function(Object): {id: number, left: (number|undefined), top: (number|undefined)}} locate
 *   - Gives the object ID of the page a bookmark opens, and the position on
 *   it when the bookmark has one.
 * @param {{PDFTextString: Function}} types - The value types of the library.
 * @returns {number} The object ID of the outline root.
 * @throws {RangeError} If a bookmark opens a page the document does not have;
 *   then nothing is written.
 */
function writeOutline(objects, nodes, pageCount, locate, { PDFTextString }) {
  var root = { children: nodes, open: true };
  var ids = new Map();
  // the number of items below a node a viewer shows when it is open
  var counts = new Map();
  /**
   * @param {Object} node - A bookmark or the root.
   * @returns {void}
   */
  var prepare = (node) => {
    if (node.pageNumber > pageCount) {
      throw new RangeError(
        `bookmark targets page ${node.pageNumber}, but the document has ${pageCount} pages`,
      );
    }
    ids.set(node, objects.allocateNewObjectID());
    var visible = 0;
    node.children.forEach((child) => {
      prepare(child);
      visible += 1 + (child.open ? counts.get(child) : 0);
    });
    counts.set(node, visible);
  };
  /**
   * Writes a node, then the nodes below it.
   * @param {Object} node - A bookmark or the root.
   * @param {Object} [parent] - The node it is below; none for the root.
   * @param {Object[]} [siblings] - The nodes below the parent.
   * @param {number} [index] - Its place among them.
   * @returns {void}
   */
  var write = (node, parent, siblings, index) => {
    var { children } = node;
    /**
     * @param {string} key - A key of the dictionary.
     * @param {Object} target - The node it refers to.
     * @returns {void}
     */
    var reference = (key, target) => {
      dictionary.writeKey(key);
      dictionary.writeObjectReferenceValue(ids.get(target));
    };
    objects.startNewIndirectObject(ids.get(node));
    var dictionary = objects.startDictionary();
    if (parent) {
      dictionary.writeKey("Title");
      dictionary.writeLiteralStringValue(
        new PDFTextString(node.title).toBytesArray(),
      );
      reference("Parent", parent);
      if (index > 0) reference("Prev", siblings[index - 1]);
      if (index < siblings.length - 1) reference("Next", siblings[index + 1]);
    } else {
      dictionary.writeKey("Type");
      dictionary.writeNameValue("Outlines");
    }
    if (children.length) {
      reference("First", children[0]);
      reference("Last", children[children.length - 1]);
      dictionary.writeKey("Count");
      dictionary.writeNumberValue(
        node.open ? counts.get(node) : -counts.get(node),
      );
    }
    if (parent) {
      var { id, left, top } = locate(node);
      dictionary.writeKey("Dest");
      objects.startArray();
      objects.writeIndirectObjectReference(id);
      if (left === undefined && node.zoom === undefined) {
        objects.writeName("Fit");
      } else {
        objects.writeName("XYZ");
        [left, top, node.zoom].forEach((value) =>
          value === undefined
            ? objects.writeKeyword("null")
            : objects.writeNumber(value),
        );
      }
      objects.endArray();
      objects.endLine();
    }
    objects.endDictionary(dictionary);
    objects.endIndirectObject();
    children.forEach((child, position) =>
      write(child, node, children, position),
    );
  };
  prepare(root);
  write(root);
  return ids.get(root);
}

module.exports = { outlineNode, writeOutline };
