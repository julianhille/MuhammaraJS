// Dumps the object tree of a source PDF's trailer as text. Mirrored in
// packages/wasm/lib/structure-tree.js; keep both files identical apart from
// the module syntax.

var TAB = "  ";
var TRAILER_ENTRIES = ["Info", "Root", "Size", "Prev", "ID"];

/**
 * Describe the trailer entries of a PDF, walked through indirect references,
 * arrays, dictionaries and stream dictionaries. Entries the PDF lacks are
 * skipped.
 * @param {Object} reader - The source PDF reader.
 * @param {Object} types - The addon constants: `ePDFObject*` and `getTypeLabel`.
 * @returns {string} The tree, one `\r\n` terminated line per object.
 */
function structureTree(reader, types) {
  var text = "";
  var seen = {};
  var level = 0;

  /**
   * Add one line at the current depth.
   * @param {string} line - The line.
   */
  function log(line) {
    text += TAB.repeat(level) + line + "\r\n";
  }

  /**
   * Describe an object and everything below it.
   * @param {Object} object - The PDF object.
   */
  function walk(object) {
    var type = object.getType();
    var label = types.getTypeLabel(type);
    var items, dictionary, keys, id;
    switch (type) {
      case types.ePDFObjectIndirectObjectReference:
        ++level;
        id = object.toPDFIndirectObjectReference().getObjectID();
        log(`Indirect object reference (${id}): `);
        if (!Object.prototype.hasOwnProperty.call(seen, id)) {
          seen[id] = true;
          walk(reader.parseNewObject(id));
        }
        --level;
        return;
      case types.ePDFObjectArray:
        items = object.toPDFArray().toJSArray();
        log(`- ${label} [${items.length}]`);
        ++level;
        items.forEach(walk);
        --level;
        break;
      case types.ePDFObjectDictionary:
        dictionary = object.toPDFDictionary().toJSObject();
        keys = Object.getOwnPropertyNames(dictionary);
        log(`- ${label} {${keys.join(", ")}}`);
        ++level;
        keys.forEach((key) => {
          log(key + " *");
          walk(dictionary[key]);
        });
        --level;
        break;
      case types.ePDFObjectStream:
        log("Stream . iterating stream dictionary:");
        walk(object.toPDFStream().getDictionary());
        break;
      default:
        log(`${TAB}${label}: ${object}`);
    }
  }

  TRAILER_ENTRIES.filter((name) => reader.getTrailer().exists(name)).forEach(
    (name) => {
      log(name);
      walk(reader.queryDictionaryObject(reader.getTrailer(), name));
    },
  );
  return text;
}

module.exports = { structureTree };
