var muhammara = require("@muhammara/native");

/**
 * Gets a dictionary entry only when it exists.
 *
 * @param {object} reader A PDF reader.
 * @param {object} dictionary A PDF dictionary.
 * @param {string} key Dictionary key.
 * @returns {object | undefined} The resolved entry when present.
 */
function entry(reader, dictionary, key) {
  return dictionary.exists(key)
    ? reader.queryDictionaryObject(dictionary, key)
    : undefined;
}

/**
 * Gets the one-based page number from a direct bookmark destination.
 *
 * @param {object} reader A PDF reader.
 * @param {object} item A bookmark dictionary.
 * @param {Record<number, number>} pageNumbers Page numbers keyed by object ID.
 * @returns {number | null} The destination page number, when available.
 */
function destinationPage(reader, item, pageNumbers) {
  var destination = entry(reader, item, "Dest");
  var array = destination && destination.toPDFArray();
  var page = array && array.queryObject(0).toPDFIndirectObjectReference();

  return page ? pageNumbers[page.getObjectID()] || null : null;
}

/**
 * Reads one level of a PDF outline tree.
 *
 * @param {object} reader A PDF reader.
 * @param {object | undefined} item First outline item at this level.
 * @param {Record<number, number>} pageNumbers Page numbers keyed by object ID.
 * @returns {Array<{title: string, page: number | null, children: object[]}>} Outline items.
 */
function readItems(reader, item, pageNumbers) {
  var items = [];

  while (item) {
    var title = entry(reader, item, "Title");
    var first = entry(reader, item, "First");

    items.push({
      title: title ? title.toText() : "",
      page: destinationPage(reader, item, pageNumbers),
      children: first
        ? readItems(reader, first.toPDFDictionary(), pageNumbers)
        : [],
    });

    var next = entry(reader, item, "Next");
    item = next ? next.toPDFDictionary() : undefined;
  }

  return items;
}

/**
 * Reads a PDF's direct-destination outline tree.
 *
 * @param {string} inputPath Source PDF path.
 * @returns {Array<{title: string, page: number | null, children: object[]}>} Bookmark tree.
 */
function readBookmarks(inputPath) {
  var reader = muhammara.createReader(inputPath);

  try {
    var pageNumbers = {};
    for (var index = 0; index < reader.getPagesCount(); ++index) {
      pageNumbers[reader.getPageObjectID(index)] = index + 1;
    }

    var catalog = entry(reader, reader.getTrailer(), "Root").toPDFDictionary();
    var outlines = entry(reader, catalog, "Outlines");
    var first = outlines && entry(reader, outlines.toPDFDictionary(), "First");

    return first ? readItems(reader, first.toPDFDictionary(), pageNumbers) : [];
  } finally {
    reader.end();
  }
}

module.exports = readBookmarks;
