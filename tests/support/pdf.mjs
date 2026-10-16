// Reads produced PDFs through an end's own reader, so a spec asserts on the
// PDF both ends produce, not on how either end got there.

/**
 * Decode a stream object as latin1 text.
 * @param {object} reader - The end's PDF reader.
 * @param {object} stream - A PDF stream object.
 * @returns {string} The decoded stream.
 */
function streamText(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  var text = "";
  while (input.notEnded())
    text += Buffer.from(input.read(65536)).toString("latin1");
  return text;
}

/**
 * Follow an indirect reference.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {object} object - A PDF object or reference.
 * @returns {object} The referenced object.
 */
function resolve(end, reader, object) {
  return object &&
    object.getType() === end.muhammara.ePDFObjectIndirectObjectReference
    ? reader.parseNewObject(object.toPDFIndirectObjectReference().getObjectID())
    : object;
}

/**
 * Open bytes, run a callback with the reader and end it.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {function(object): *} read - Reads what it needs.
 * @param {object} [options] - Reader options, such as a password.
 * @returns {*} The callback's result.
 */
export function withReader(end, bytes, read, options) {
  var reader = end.reader(bytes, options);
  try {
    return read(reader);
  } finally {
    reader.end();
  }
}

/**
 * The number of pages.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {number} The page count.
 */
export function pageCount(end, bytes) {
  return withReader(end, bytes, (reader) => reader.getPagesCount());
}

/**
 * The decoded content streams of a page, joined.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {string} The page content.
 */
export function pageContent(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => contentOf(end, reader, pageIndex));
}

/**
 * The content of a page followed by the content of every form XObject it
 * draws, recursively, so a spec finds an operator wherever an end put it.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {string} The drawn content.
 */
export function drawnContent(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var page = reader.parsePageDictionary(pageIndex);
    var parts = [contentOf(end, reader, pageIndex)];
    var seen = new Set();
    var visit = (resources) => {
      resources = resolve(end, reader, resources);
      if (!resources) return;
      var xobjects = resolve(
        end,
        reader,
        reader.queryDictionaryObject(resources, "XObject"),
      );
      if (!xobjects) return;
      var entries = xobjects.toPDFDictionary().toJSObject();
      for (var name of Object.keys(entries)) {
        var value = entries[name];
        var id =
          value.getType() === end.muhammara.ePDFObjectIndirectObjectReference
            ? value.toPDFIndirectObjectReference().getObjectID()
            : null;
        if (id !== null && seen.has(id)) continue;
        if (id !== null) seen.add(id);
        var stream = resolve(end, reader, value);
        if (!stream || stream.getType() !== end.muhammara.ePDFObjectStream)
          continue;
        var dictionary = stream.toPDFStream().getDictionary();
        var subtype = reader.queryDictionaryObject(dictionary, "Subtype");
        if (!subtype || subtype.value !== "Form") continue;
        parts.push(streamText(reader, stream.toPDFStream()));
        visit(reader.queryDictionaryObject(dictionary, "Resources"));
      }
    };
    visit(reader.queryDictionaryObject(page, "Resources"));
    return parts.join("\n");
  });
}

/**
 * Read the content of one page.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {number} pageIndex - The zero-based page.
 * @returns {string} The content.
 */
function contentOf(end, reader, pageIndex) {
  var page = reader.parsePageDictionary(pageIndex);
  var contents = resolve(
    end,
    reader,
    reader.queryDictionaryObject(page, "Contents"),
  );
  if (!contents) return "";
  var streams =
    contents.getType() === end.muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map((entry) => resolve(end, reader, entry).toPDFStream())
      : [contents.toPDFStream()];
  return streams.map((stream) => streamText(reader, stream)).join("\n");
}

/**
 * The text runs of a page with their text matrix position.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Array<{text: string, x: number, y: number}>} The runs.
 */
export function textRuns(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) =>
    reader.extractPageText(pageIndex).map((run) => ({
      text: run.text,
      x: run.textMatrix[4],
      y: run.textMatrix[5],
    })),
  );
}

/**
 * The annotations of a page as plain values: names without the slash,
 * numbers, strings as text, arrays and dictionaries resolved one level.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {object[]} The annotation dictionaries.
 */
export function annotations(end, bytes, pageIndex = 0) {
  return withReader(end, bytes, (reader) => {
    var page = reader.parsePageDictionary(pageIndex);
    var annots = resolve(
      end,
      reader,
      reader.queryDictionaryObject(page, "Annots"),
    );
    if (!annots) return [];
    return annots
      .toPDFArray()
      .toJSArray()
      .map((entry) => plain(end, reader, resolve(end, reader, entry), 1));
  });
}

/**
 * A PDF object as a plain JavaScript value.
 * @param {object} end - The end.
 * @param {object} reader - The reader.
 * @param {object} object - The object.
 * @param {number} depth - How many references to follow.
 * @returns {*} The value.
 */
function plain(end, reader, object, depth) {
  var M = end.muhammara;
  var type = object.getType();
  if (type === M.ePDFObjectIndirectObjectReference) {
    return depth > 0
      ? plain(end, reader, resolve(end, reader, object), depth - 1)
      : "<ref>";
  }
  if (type === M.ePDFObjectDictionary || type === M.ePDFObjectStream) {
    var dict =
      type === M.ePDFObjectStream
        ? object.toPDFStream().getDictionary()
        : object;
    var values = dict.toPDFDictionary().toJSObject();
    return Object.fromEntries(
      Object.keys(values).map((key) => [
        key,
        key === "P" || key === "Parent"
          ? "<parent>"
          : plain(end, reader, values[key], depth),
      ]),
    );
  }
  if (type === M.ePDFObjectArray) {
    return object
      .toPDFArray()
      .toJSArray()
      .map((item) => plain(end, reader, item, depth));
  }
  if (type === M.ePDFObjectLiteralString || type === M.ePDFObjectHexString) {
    return object.toText ? object.toText() : object.value;
  }
  return object.value;
}

/**
 * The trailer's Info dictionary as plain values.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {object} The Info entries.
 */
export function info(end, bytes) {
  return withReader(end, bytes, (reader) => {
    var value = reader.queryDictionaryObject(reader.getTrailer(), "Info");
    return value ? plain(end, reader, value, 1) : {};
  });
}

/**
 * The page fields both ends' `pageInfo()` return. Wasm returns its page
 * record, which has these and more (media box, layout, size, offsets), as it
 * always has; native returns only these.
 * @param {?object} info - A pageInfo() or getCurrentPageInfo() result.
 * @returns {?object} Its width, height, rotate and pageNumber.
 */
export function pageFields(info) {
  if (!info) return info;
  var { width, height, rotate, pageNumber } = info;
  return { width, height, rotate, pageNumber };
}
