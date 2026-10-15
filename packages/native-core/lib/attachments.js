// Files attached to a PDF (ISO 32000-2, 7.11.4) and how they relate to it as
// associated files (14.13). Mirrored in packages/wasm/lib/attachments.js;
// keep both files identical apart from the module syntax.

/**
 * How an attached file relates to the document, its /AFRelationship
 * (ISO 32000-2, 14.13).
 * @readonly
 * @enum {string}
 */
var AFRelationship = Object.freeze({
  /** The original source the document was made from. */
  SOURCE: "Source",
  /** Data the document shows, such as the XML of an e-invoice. */
  DATA: "Data",
  /** Another representation of the document's content. */
  ALTERNATIVE: "Alternative",
  /** A supplement to the document's content. */
  SUPPLEMENT: "Supplement",
  /** An encrypted payload document. */
  ENCRYPTED_PAYLOAD: "EncryptedPayload",
  /** The data of a form in the document. */
  FORM_DATA: "FormData",
  /** A schema of the document's data. */
  SCHEMA: "Schema",
  /** A relationship that is not known or none of the others; the default. */
  UNSPECIFIED: "Unspecified",
});

/**
 * Check an attached file and fill in its defaults.
 * @param {string} name - The file name.
 * @param {Uint8Array} bytes - The file content.
 * @param {Object} [options] - The options of `attach()`.
 * @returns {{name: string, bytes: Uint8Array, mimeType: string, description: (string|undefined), relationship: string, modDate: Date}}
 *   The file to write.
 * @throws {TypeError} If the name is empty or not a string, or the
 *   relationship is not an `AFRelationship` value.
 */
function attachment(name, bytes, options = {}) {
  if (typeof name !== "string" || name === "") {
    throw new TypeError("An attached file needs a name");
  }
  var relationship = options.relationship ?? AFRelationship.UNSPECIFIED;
  if (!Object.values(AFRelationship).includes(relationship)) {
    throw new TypeError(
      `Unknown relationship ${relationship}; use an AFRelationship value`,
    );
  }
  return {
    name,
    bytes,
    mimeType: options.mimeType || "application/octet-stream",
    description: options.description,
    relationship,
    modDate: options.modDate || new Date(),
  };
}

/**
 * Write attached files: their streams and file specifications, the
 * /EmbeddedFiles name tree and the associated files the catalog's /AF lists.
 * @param {Object} objects - The objects context of the writer.
 * @param {Object[]} files - The files, see `attachment()`.
 * @param {{PDFTextString: Function, PDFDate: Function}} types - The value
 *   types of the library.
 * @returns {{names: number, associated: number}} The object IDs of the
 *   catalog's /Names dictionary and /AF array.
 */
function writeAttachments(objects, files, { PDFTextString, PDFDate }) {
  /**
   * @param {string} value - A text.
   * @returns {number[]} It as the bytes of a PDF text string.
   */
  var text = (value) => new PDFTextString(value).toBytesArray();
  /**
   * Writes a dictionary as its own indirect object; it cannot start another.
   * @param {function(Object): void} write - Writes the entries.
   * @returns {number} The object ID.
   */
  var dictionaryObject = (write) => {
    var id = objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    write(dictionary);
    objects.endDictionary(dictionary);
    objects.endIndirectObject();
    return id;
  };
  /**
   * Writes an array as its own indirect object.
   * @param {function(): void} write - Writes the items.
   * @returns {number} The object ID.
   */
  var arrayObject = (write) => {
    var id = objects.startNewIndirectObject();
    objects.startArray();
    write();
    objects.endArray();
    objects.endLine();
    objects.endIndirectObject();
    return id;
  };

  // the keys of a name tree are sorted
  var specs = files
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((file) => {
      var params = dictionaryObject((dictionary) => {
        dictionary.writeKey("Size");
        dictionary.writeNumberValue(file.bytes.length);
        dictionary.writeKey("ModDate");
        dictionary.writeLiteralStringValue(
          new PDFDate(file.modDate).toString(),
        );
      });
      var streamId = objects.startNewIndirectObject();
      var streamDictionary = objects.startDictionary();
      streamDictionary.writeKey("Type");
      streamDictionary.writeNameValue("EmbeddedFile");
      streamDictionary.writeKey("Subtype");
      streamDictionary.writeNameValue(file.mimeType);
      streamDictionary.writeKey("Params");
      streamDictionary.writeObjectReferenceValue(params);
      var stream = objects.startPDFStream(streamDictionary);
      stream.getWriteStream().write(file.bytes);
      objects.endPDFStream(stream);

      var embedded = dictionaryObject((dictionary) => {
        dictionary.writeKey("F");
        dictionary.writeObjectReferenceValue(streamId);
        dictionary.writeKey("UF");
        dictionary.writeObjectReferenceValue(streamId);
      });
      var id = dictionaryObject((dictionary) => {
        dictionary.writeKey("Type");
        dictionary.writeNameValue("Filespec");
        dictionary.writeKey("F");
        dictionary.writeLiteralStringValue(text(file.name));
        dictionary.writeKey("UF");
        dictionary.writeLiteralStringValue(text(file.name));
        if (file.description) {
          dictionary.writeKey("Desc");
          dictionary.writeLiteralStringValue(text(file.description));
        }
        dictionary.writeKey("AFRelationship");
        dictionary.writeNameValue(file.relationship);
        dictionary.writeKey("EF");
        dictionary.writeObjectReferenceValue(embedded);
      });
      return { name: file.name, id };
    });

  var names = arrayObject(() =>
    specs.forEach((spec) => {
      objects.writeLiteralString(text(spec.name));
      objects.writeIndirectObjectReference(spec.id);
    }),
  );
  var tree = dictionaryObject((dictionary) => {
    dictionary.writeKey("Names");
    dictionary.writeObjectReferenceValue(names);
  });
  return {
    names: dictionaryObject((dictionary) => {
      dictionary.writeKey("EmbeddedFiles");
      dictionary.writeObjectReferenceValue(tree);
    }),
    associated: arrayObject(() =>
      specs.forEach((spec) => objects.writeIndirectObjectReference(spec.id)),
    ),
  };
}

module.exports = { AFRelationship, attachment, writeAttachments };
