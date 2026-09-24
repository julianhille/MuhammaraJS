var muhammara = require("@muhammara/native");

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
 * @param {string} inputPath Source PDF path.
 * @param {number} pageIndex Zero-based page index.
 * @returns {Array<{name: string, objectId: number | undefined, subtype: string | undefined}>} XObject details.
 */
function inspectPageXObjects(inputPath, pageIndex) {
  var reader = muhammara.createReader(inputPath);

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

module.exports = inspectPageXObjects;
