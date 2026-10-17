// Reads the document-level metadata of produced PDFs through an end's own
// reader: the encryption dictionary, the Info dictionary of an encrypted PDF
// and the attached files.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withReader } from "./pdf.mjs";

var OUTPUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../output",
);

/**
 * The reader options for a password, or none without one.
 * @param {string} [password] - The password.
 * @returns {object|undefined} The reader options.
 */
function passwordOptions(password) {
  return password === undefined ? undefined : { password };
}

/**
 * The /P entry PDFWriter writes for a user protection flag: the reserved bits
 * 7, 8 and 13 to 32 set and bits 1 and 2 cleared, as a signed 32-bit number.
 * @param {number} flag - The `userProtectionFlag`.
 * @returns {number} The /P value.
 */
export function permissionsEntry(flag) {
  return (flag | 0xfffff0c0) & ~3;
}

/**
 * The encryption of a PDF as its reader sees it with a password.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {string} [password] - The password to open it with.
 * @returns {{encrypted: boolean, pages: number, V?: number, R?: number,
 *   P?: number, Length?: number}} Whether it is encrypted, the pages the
 *   password opens (0 when it opens none) and the encryption dictionary's
 *   /V, /R, /P and /Length.
 */
export function encryption(end, bytes, password) {
  return withReader(
    end,
    bytes,
    (reader) => {
      var result = {
        encrypted: reader.isEncrypted(),
        pages: reader.getPagesCount(),
      };
      var dictionary = reader.queryDictionaryObject(
        reader.getTrailer(),
        "Encrypt",
      );
      if (!dictionary) return result;
      ["V", "R", "P", "Length"].forEach((key) => {
        var value = reader.queryDictionaryObject(dictionary, key);
        if (value) result[key] = value.value;
      });
      return result;
    },
    passwordOptions(password),
  );
}

/**
 * Whether a password opens a PDF: the reader finds its pages.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {string} [password] - The password; none tries the empty one.
 * @returns {boolean} Whether the pages can be read.
 */
export function opens(end, bytes, password) {
  return encryption(end, bytes, password).pages > 0;
}

/**
 * The trailer's Info dictionary as text, read with a password, or undefined
 * when the PDF has none.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {string} [password] - The password to open it with.
 * @returns {Object<string, string>|undefined} The Info entries.
 */
export function infoWith(end, bytes, password) {
  return withReader(
    end,
    bytes,
    (reader) => {
      var dictionary = reader.queryDictionaryObject(
        reader.getTrailer(),
        "Info",
      );
      if (!dictionary) return undefined;
      return Object.fromEntries(
        Object.keys(dictionary.toJSObject()).map((key) => {
          var value = reader.queryDictionaryObject(dictionary, key);
          return [key, value.toText ? value.toText() : value.value];
        }),
      );
    },
    passwordOptions(password),
  );
}

/**
 * Read a PDF stream fully.
 * @param {object} reader - The reader.
 * @param {object} stream - The stream object.
 * @returns {Buffer} The decoded bytes.
 */
function streamBytes(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  var chunks = [];
  while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
  return Buffer.concat(chunks);
}

/**
 * The attached files of a PDF, through its EmbeddedFiles name tree and the
 * catalog's /AF.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @returns {{files: Object[], associated: number}} Each file in name-tree
 *   order, and the number of associated files the catalog lists.
 */
export function attachments(end, bytes) {
  return withReader(end, bytes, (reader) => {
    var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
    var names = reader.queryDictionaryObject(
      reader.queryDictionaryObject(
        reader.queryDictionaryObject(catalog, "Names"),
        "EmbeddedFiles",
      ),
      "Names",
    );
    var files = [];
    for (var i = 0; i < names.getLength(); i += 2) {
      var spec = reader.queryArrayObject(names, i + 1);
      var stream = reader.queryDictionaryObject(
        reader.queryDictionaryObject(spec, "EF"),
        "F",
      );
      var streamDictionary = stream.getDictionary();
      var params = reader.queryDictionaryObject(streamDictionary, "Params");
      files.push({
        key: reader.queryArrayObject(names, i).toText(),
        name: spec.queryObject("UF").toText(),
        description: spec.toJSObject().Desc?.toText(),
        relationship: spec.queryObject("AFRelationship").value,
        mimeType: streamDictionary.queryObject("Subtype").value,
        size: params.queryObject("Size").value,
        content: streamBytes(reader, stream).toString(),
      });
    }
    var associated = reader.queryDictionaryObject(catalog, "AF").getLength();
    return { files, associated };
  });
}

/**
 * A path for an output file below tests/output/<end>/, for the end-only
 * suites that write files themselves.
 * @param {object} end - The end.
 * @param {string} name - The file name with its extension.
 * @returns {string} The path; its directory exists.
 */
export function outputPath(end, name) {
  var dir = path.join(OUTPUT, end.name);
  mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
