// PDF/A (ISO 19005) levels and the output intent profile Recipe writes for
// them. Mirrored in packages/native-core/lib/pdfa.js; keep both files
// identical apart from the module syntax.

/**
 * The PDF/A levels (ISO 19005) Recipe writes, the `pdfa` Recipe option.
 * @readonly
 * @enum {string}
 */
var PdfA = Object.freeze({
  /** PDF/A-1b (ISO 19005-1, basic): PDF 1.4. */
  A1B: "1B",
});

/**
 * What a PDF/A level may not allow, named as in the errors Recipe throws.
 * @readonly
 * @enum {string}
 */
var PdfAFeature = Object.freeze({
  /** Opacity below 1 and images with an alpha channel. */
  TRANSPARENCY: "transparency",
  /** CMYK colors and images, which the sRGB output intent cannot describe. */
  CMYK: "CMYK colors",
});

// What each level writes, its identification and the PDF version it is based
// on, and the features it does not allow.
var PDFA_LEVELS = Object.freeze({
  [PdfA.A1B]: Object.freeze({
    part: 1,
    conformance: "B",
    version: 1.4,
    forbids: Object.freeze([PdfAFeature.TRANSPARENCY, PdfAFeature.CMYK]),
  }),
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
 * @returns {{part: number, conformance: (string|undefined), version: number, forbids: string[]}}
 *   The identification and PDF version of the level, and the `PdfAFeature`
 *   values it does not allow.
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
 * Throw when a PDF/A level does not allow a feature.
 * @param {Object|null} level - The level of the Recipe, see `pdfaLevel()`, or
 *   null when it does not write PDF/A.
 * @param {string|null} feature - A `PdfAFeature` value, or null for none.
 * @returns {void}
 * @throws {Error} If the level does not allow the feature.
 */
function requirePdfaAllows(level, feature) {
  if (level && level.forbids.includes(feature)) {
    throw new Error(`PDF/A-${level.part} does not allow ${feature}`);
  }
}

/**
 * Find the feature an image needs that a PDF/A level may not allow: a PNG
 * with an alpha channel or a transparent color, or a JPEG with four (CMYK)
 * components. Other images, such as TIFF, are not inspected.
 * @param {Uint8Array} bytes - The image file.
 * @returns {string|null} A `PdfAFeature` value, or null.
 */
function imagePdfaFeature(bytes) {
  /**
   * @param {number} at - A byte offset.
   * @returns {number} The big-endian 16-bit number there.
   */
  var uint16 = (at) => (bytes[at] << 8) | bytes[at + 1];
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    // the IHDR color type: 4 is gray with alpha, 6 RGB with alpha
    if (bytes[25] === 4 || bytes[25] === 6) return PdfAFeature.TRANSPARENCY;
    for (var at = 8; at + 8 <= bytes.length;) {
      var type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (type === "tRNS") return PdfAFeature.TRANSPARENCY;
      if (type === "IDAT") break;
      at += 12 + uint16(at) * 65536 + uint16(at + 2);
    }
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (var marker = 2; marker + 9 < bytes.length;) {
      if (bytes[marker] !== 0xff) break;
      var code = bytes[marker + 1];
      // a start of frame: C0 to CF, except DHT (C4), JPG (C8) and DAC (CC)
      if (code >= 0xc0 && code <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(code)) {
        return bytes[marker + 9] === 4 ? PdfAFeature.CMYK : null;
      }
      marker += 2 + uint16(marker + 2);
    }
  }
  return null;
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

export {
  PdfA,
  PdfAFeature,
  SRGB_PROFILE,
  imagePdfaFeature,
  pdfaLevel,
  pdfaOptions,
  requirePdfaAllows,
  writeOutputIntents,
};
