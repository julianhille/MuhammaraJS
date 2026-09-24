import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

/**
 * Creates a minimal PDF with an image XObject and one direct-destination outline.
 *
 * @returns {Uint8Array} PDF bytes.
 */
function outlinedPdf() {
  var objects = [
    "<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im1 4 0 R >> >> >>",
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\nx\nendstream",
    "<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>",
    "<< /Title (Chapter 1) /Parent 5 0 R /Dest [3 0 R /Fit] >>",
  ];
  var encoder = new TextEncoder();
  var output = "%PDF-1.4\n";
  var offsets = [0];

  objects.forEach(function (object, index) {
    offsets.push(encoder.encode(output).byteLength);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  var xrefPosition = encoder.encode(output).byteLength;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(function (offset) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`;

  return encoder.encode(output);
}

/**
 * Resolves an indirect object reference when one is supplied.
 *
 * @param {object} reader A PDF reader.
 * @param {object} object A direct object or indirect reference.
 * @returns {object} The direct object.
 */
function dereference(reader, object) {
  var reference = object.toPDFIndirectObjectReference();
  return reference ? reader.parseNewObject(reference.getObjectID()) : object;
}

/**
 * Lists the XObjects referenced by one zero-based page.
 *
 * @param {object} muhammara Loaded Wasm API.
 * @param {Uint8Array} bytes Source PDF bytes.
 * @param {number} pageIndex Zero-based page index.
 * @returns {Array<{name: string, objectId: number | undefined, subtype: string | undefined}>} XObject details.
 */
function inspectPageXObjects(muhammara, bytes, pageIndex) {
  var reader = muhammara.createReader(bytes);

  try {
    var page = reader.parsePageDictionary(pageIndex);
    var resources = reader.queryDictionaryObject(page, "Resources");
    var xObjects =
      resources &&
      reader.queryDictionaryObject(resources.toPDFDictionary(), "XObject");

    if (!xObjects) {
      return [];
    }

    return Object.keys(xObjects.toPDFDictionary().toJSObject()).map(
      function (name) {
        var entry = xObjects.toPDFDictionary().queryObject(name);
        var reference = entry.toPDFIndirectObjectReference();
        var object = dereference(reader, entry);
        var dictionary = object.toPDFStream().getDictionary();
        var subtype = reader.queryDictionaryObject(dictionary, "Subtype");

        return {
          name: name,
          objectId: reference ? reference.getObjectID() : undefined,
          subtype: subtype ? subtype.toPDFName().value : undefined,
        };
      },
    );
  } finally {
    reader.end();
  }
}

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
 * @param {object} muhammara Loaded Wasm API.
 * @param {Uint8Array} bytes Source PDF bytes.
 * @returns {Array<{title: string, page: number | null, children: object[]}>} Bookmark tree.
 */
function readBookmarks(muhammara, bytes) {
  var reader = muhammara.createReader(bytes);

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

describe("InspectPDFs documentation workflows", function () {
  it("inspects XObjects and reads direct-destination bookmarks", async function () {
    var muhammara = await createMuhammaraWasm();
    var bytes = outlinedPdf();

    assert.deepEqual(inspectPageXObjects(muhammara, bytes, 0), [
      { name: "Im1", objectId: 4, subtype: "Image" },
    ]);
    assert.deepEqual(readBookmarks(muhammara, bytes), [
      { title: "Chapter 1", page: 1, children: [] },
    ]);
  });
});
