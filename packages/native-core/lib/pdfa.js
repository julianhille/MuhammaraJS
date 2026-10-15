// PDF/A (ISO 19005) levels and the output intent profile Recipe writes for
// them. Mirrored in packages/wasm/lib/pdfa.js; keep both files identical apart
// from the module syntax.

/**
 * The PDF/A levels (ISO 19005) Recipe writes, the `pdfa` Recipe option.
 * @readonly
 * @enum {string}
 */
var PdfA = Object.freeze({
  /** PDF/A-1b (ISO 19005-1, basic): PDF 1.4. */
  A1B: "1B",
});

// What each level writes: its identification and the PDF version it is based
// on.
var PDFA_LEVELS = Object.freeze({
  [PdfA.A1B]: Object.freeze({ part: 1, conformance: "B", version: 1.4 }),
});

// The output condition of the bundled profile.
var SRGB_CONDITION = "sRGB IEC61966-2.1";

// sRGB-v2-micro.icc of Compact ICC Profiles by Clinton Ingram, CC0
// (https://github.com/saucecontrol/Compact-ICC-Profiles): an ICC 2.1 sRGB
// display profile for the output intent PDF/A requires.
var SRGB_PROFILE =
  "AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0" +
  "cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAA" +
  "ARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABg" +
  "Z1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRl" +
  "eHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVog" +
  "AAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4" +
  "AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVW" +
  "fo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//";

/**
 * Look up a PDF/A level.
 * @param {string} level - A `PdfA` value.
 * @returns {{part: number, conformance: (string|undefined), version: number}}
 *   The identification and PDF version of the level.
 * @throws {TypeError} If level is not a `PdfA` value.
 */
function pdfaLevel(level) {
  var found = Object.hasOwn(PDFA_LEVELS, level) ? PDFA_LEVELS[level] : null;
  if (!found) {
    throw new TypeError(`Unknown PDF/A level ${level}; use a PdfA value`);
  }
  return found;
}

/**
 * Write the output intent PDF/A requires, with the bundled sRGB profile, and
 * the array the catalog's /OutputIntents entry refers to.
 * @param {Object} objects - The objects context of the writer.
 * @param {*} profile - The bytes of `SRGB_PROFILE` in the form the writer's
 *   streams take.
 * @returns {number} The object ID of the /OutputIntents array.
 */
function writeOutputIntents(objects, profile) {
  var profileId = objects.startNewIndirectObject();
  var profileDictionary = objects.startDictionary();
  profileDictionary.writeKey("N");
  profileDictionary.writeNumberValue(3);
  var stream = objects.startPDFStream(profileDictionary);
  stream.getWriteStream().write(profile);
  objects.endPDFStream(stream);

  var intentId = objects.startNewIndirectObject();
  var intent = objects.startDictionary();
  intent.writeKey("Type");
  intent.writeNameValue("OutputIntent");
  intent.writeKey("S");
  intent.writeNameValue("GTS_PDFA1");
  intent.writeKey("OutputConditionIdentifier");
  intent.writeLiteralStringValue(SRGB_CONDITION);
  intent.writeKey("Info");
  intent.writeLiteralStringValue(SRGB_CONDITION);
  intent.writeKey("DestOutputProfile");
  intent.writeObjectReferenceValue(profileId);
  objects.endDictionary(intent);
  objects.endIndirectObject();

  var intentsId = objects.startNewIndirectObject();
  objects.startArray();
  objects.writeIndirectObjectReference(intentId);
  objects.endArray();
  objects.endLine();
  objects.endIndirectObject();
  return intentsId;
}

/**
 * Check that a Recipe with these options can be written as PDF/A.
 * @param {Object} options - The Recipe options.
 * @param {boolean} isNewPDF - Whether the Recipe creates a new PDF.
 * @param {boolean} encrypted - Whether the Recipe encrypts the PDF.
 * @returns {Object|null} The level of the `pdfa` option, see `pdfaLevel()`,
 *   or null without the option.
 * @throws {TypeError} If `pdfa` is not a `PdfA` value.
 * @throws {Error} If the Recipe edits a PDF, asks for another PDF version, or
 *   encrypts.
 */
function pdfaOptions(options, isNewPDF, encrypted) {
  if (options.pdfa === undefined) return null;
  var level = pdfaLevel(options.pdfa);
  if (!isNewPDF) throw new Error("The pdfa option applies to a new PDF");
  if (options.version !== undefined && options.version !== level.version) {
    throw new Error(
      `PDF/A-${level.part} is written as PDF ${level.version.toFixed(1)}`,
    );
  }
  if (encrypted) throw new Error("PDF/A does not allow encryption");
  return level;
}

module.exports = {
  PdfA,
  SRGB_PROFILE,
  pdfaLevel,
  pdfaOptions,
  writeOutputIntents,
};
