// PDF/A (ISO 19005) levels, what they allow, and the output intent Recipe
// writes for them. Mirrored in packages/wasm/lib/pdfa.js; keep both files
// identical apart from the module syntax.

/**
 * The PDF/A levels (ISO 19005) Recipe writes, the `level` of the `pdfa`
 * Recipe option.
 * @readonly
 * @enum {string}
 */
var PdfA = Object.freeze({
  /** PDF/A-1b (ISO 19005-1, basic): PDF 1.4. */
  A1B: "1B",
  /** PDF/A-2b (ISO 19005-2, basic): PDF 1.7. */
  A2B: "2B",
  /** PDF/A-2u (ISO 19005-2, Unicode): PDF 1.7, text that maps to Unicode. */
  A2U: "2U",
  /** PDF/A-3b (ISO 19005-3, basic): PDF/A-2b that may carry attached files. */
  A3B: "3B",
  /** PDF/A-3u (ISO 19005-3, Unicode): PDF/A-2u that may carry attached files. */
  A3U: "3U",
  /** PDF/A-4 (ISO 19005-4:2020): PDF 2.0, document information in XMP only. */
  A4: "4",
  /** PDF/A-4e (ISO 19005-4:2020, engineering): PDF/A-4 that may carry 3D content. */
  A4E: "4E",
});

/**
 * What a PDF/A document may not allow, named as in the errors Recipe throws.
 * @readonly
 * @enum {string}
 */
var PdfAFeature = Object.freeze({
  /** Opacity below 1 and images with an alpha channel. */
  TRANSPARENCY: "transparency",
  /** RGB colors and images, which only an RGB output intent describes. */
  RGB: "RGB colors",
  /** CMYK colors and images, which only a CMYK output intent describes. */
  CMYK: "CMYK colors",
  /**
   * Annotations with an area other than links: Recipe writes no appearance
   * stream for them, which PDF/A-2 and later require.
   */
  ANNOTATION_APPEARANCE: "annotations without an appearance stream",
  /**
   * Custom document information entries: PDF/A-4 keeps the document
   * information in XMP only, which has no place for them.
   */
  CUSTOM_INFO: "custom Info entries",
});

// What each level writes, its identification and the PDF version it is based
// on, and the features it does not allow. `withoutInfo` levels write no Info
// dictionary, only XMP.
var PDFA_LEVELS = Object.freeze({
  [PdfA.A1B]: Object.freeze({
    part: 1,
    conformance: "B",
    version: 1.4,
    forbids: Object.freeze([PdfAFeature.TRANSPARENCY]),
  }),
  [PdfA.A2B]: Object.freeze({
    part: 2,
    conformance: "B",
    version: 1.7,
    forbids: Object.freeze([PdfAFeature.ANNOTATION_APPEARANCE]),
  }),
  [PdfA.A2U]: Object.freeze({
    part: 2,
    conformance: "U",
    version: 1.7,
    forbids: Object.freeze([PdfAFeature.ANNOTATION_APPEARANCE]),
  }),
  [PdfA.A3B]: Object.freeze({
    part: 3,
    conformance: "B",
    version: 1.7,
    forbids: Object.freeze([PdfAFeature.ANNOTATION_APPEARANCE]),
  }),
  [PdfA.A3U]: Object.freeze({
    part: 3,
    conformance: "U",
    version: 1.7,
    forbids: Object.freeze([PdfAFeature.ANNOTATION_APPEARANCE]),
  }),
  [PdfA.A4]: Object.freeze({
    part: 4,
    revision: 2020,
    version: 2.0,
    withoutInfo: true,
    forbids: Object.freeze([
      PdfAFeature.ANNOTATION_APPEARANCE,
      PdfAFeature.CUSTOM_INFO,
    ]),
  }),
  [PdfA.A4E]: Object.freeze({
    part: 4,
    conformance: "E",
    revision: 2020,
    version: 2.0,
    withoutInfo: true,
    forbids: Object.freeze([
      PdfAFeature.ANNOTATION_APPEARANCE,
      PdfAFeature.CUSTOM_INFO,
    ]),
  }),
});

// The ICC color spaces an output intent profile may have: the number of
// components and the device colors the profile does not describe. Gray is
// allowed with every output intent.
var PROFILE_SPACES = Object.freeze({
  "RGB ": { name: "RGB", components: 3, forbids: [PdfAFeature.CMYK] },
  CMYK: { name: "CMYK", components: 4, forbids: [PdfAFeature.RGB] },
  GRAY: {
    name: "gray",
    components: 1,
    forbids: [PdfAFeature.RGB, PdfAFeature.CMYK],
  },
});

/**
 * Look up a PDF/A level.
 * @param {string} level - A `PdfA` value.
 * @returns {{part: number, conformance: (string|undefined), revision: (number|undefined), version: number, withoutInfo: (boolean|undefined), forbids: string[]}}
 *   The identification and PDF version of the level, whether it writes no
 *   Info dictionary, and the `PdfAFeature` values it does not allow.
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
 * Read the color space and version of an ICC profile from its header.
 * @param {Uint8Array} profile - The profile.
 * @param {number} part - The PDF/A part the profile is for.
 * @returns {{name: string, components: number, forbids: string[]}} The
 *   color space.
 * @throws {TypeError} If the bytes are no ICC profile of an RGB, CMYK or gray
 *   color space, or a version the part does not allow.
 */
function profileSpace(profile, part) {
  /**
   * @param {number} at - A byte offset.
   * @returns {string} The four characters there.
   */
  var tag = (at) =>
    String.fromCharCode(...(profile?.subarray?.(at, at + 4) || []));
  if (tag(36) !== "acsp") {
    throw new TypeError("pdfa.iccProfile must be the bytes of an ICC profile");
  }
  var space = Object.hasOwn(PROFILE_SPACES, tag(16))
    ? PROFILE_SPACES[tag(16)]
    : null;
  if (!space) {
    throw new TypeError("pdfa.iccProfile must be an RGB, CMYK or gray profile");
  }
  // PDF 1.4 knows ICC profiles up to version 2
  if (part === 1 && profile[8] > 2) {
    throw new TypeError("PDF/A-1 needs an ICC profile of version 2 or earlier");
  }
  return space;
}

/**
 * Check that a Recipe with these options can be written as PDF/A.
 * @param {Object} options - The Recipe options.
 * @param {Uint8Array} [profile] - The bytes of `options.pdfa.iccProfile`.
 * @param {boolean} isNewPDF - Whether the Recipe creates a new PDF.
 * @param {boolean} encrypted - Whether the Recipe encrypts the PDF.
 * @returns {Object|null} The level of `options.pdfa`, see `pdfaLevel()`, with
 *   its `profile`, `space` and `condition`, and in `forbids` also the device
 *   colors the profile does not describe; or null without the option.
 * @throws {TypeError} If `pdfa.level` is not a `PdfA` value or the profile is
 *   unusable.
 * @throws {Error} If the Recipe edits a PDF, asks for another PDF version, or
 *   encrypts.
 */
function pdfaOptions(options, profile, isNewPDF, encrypted) {
  if (options.pdfa === undefined) return null;
  var level = pdfaLevel(options.pdfa?.level);
  var space = profileSpace(profile, level.part);
  if (!isNewPDF) throw new Error("The pdfa option applies to a new PDF");
  if (options.version !== undefined && options.version !== level.version) {
    throw new Error(
      `PDF/A-${level.part} is written as PDF ${level.version.toFixed(1)}`,
    );
  }
  if (encrypted) throw new Error("PDF/A does not allow encryption");
  return Object.assign({}, level, {
    profile,
    space,
    condition: options.pdfa.outputCondition || "Custom",
    forbids: level.forbids.concat(space.forbids),
  });
}

/**
 * Throw when a PDF/A document does not allow features.
 * @param {Object|null} pdfa - The PDF/A settings of the Recipe, see
 *   `pdfaOptions()`, or null when it does not write PDF/A.
 * @param {...string} features - `PdfAFeature` values.
 * @returns {void}
 * @throws {Error} If the document does not allow one of the features.
 */
function requirePdfaAllows(pdfa, ...features) {
  var feature = features.find((one) => pdfa && pdfa.forbids.includes(one));
  if (!feature) return;
  if (pdfa.space.forbids.includes(feature)) {
    throw new Error(
      `PDF/A with the ${pdfa.space.name} output intent does not allow ${feature}`,
    );
  }
  throw new Error(`PDF/A-${pdfa.part} does not allow ${feature}`);
}

/**
 * The flags an annotation of a PDF/A document is written with: printed, and
 * never invisible, hidden or unviewed. Also checks its opacity.
 * @param {Object|null} pdfa - The PDF/A settings of the Recipe, see
 *   `pdfaOptions()`, or null when it does not write PDF/A.
 * @param {number} flags - The annotation flag bits.
 * @param {Object} [annotation] - What else the document must allow.
 * @param {number} [annotation.opacity=1] - The annotation opacity.
 * @param {boolean} [annotation.sized=false] - Whether the annotation has an
 *   area and is no link, so that it needs an appearance stream.
 * @returns {number} The flag bits to write.
 * @throws {Error} If the flags hide the annotation, or the document does not
 *   allow the opacity or an annotation without an appearance stream.
 */
function pdfaAnnotationFlags(pdfa, flags, { opacity = 1, sized = false } = {}) {
  if (!pdfa) return flags;
  if (opacity < 1) requirePdfaAllows(pdfa, PdfAFeature.TRANSPARENCY);
  if (sized) requirePdfaAllows(pdfa, PdfAFeature.ANNOTATION_APPEARANCE);
  // Invisible (1), Hidden (2) and NoView (32)
  if (flags & 35) throw new Error("PDF/A does not allow hidden annotations");
  // Print (4)
  return flags | 4;
}

/**
 * Find the features an image needs that a PDF/A document may not allow: the
 * device colors of a PNG or JPEG, and the transparency of a PNG with an alpha
 * channel or a transparent color. Other images, such as TIFF, are not
 * inspected.
 * @param {Uint8Array} bytes - The image file.
 * @returns {string[]} `PdfAFeature` values.
 */
function imagePdfaFeatures(bytes) {
  /**
   * @param {number} at - A byte offset.
   * @returns {number} The big-endian 16-bit number there.
   */
  var uint16 = (at) => (bytes[at] << 8) | bytes[at + 1];
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    // the IHDR color type: 0 gray, 2 RGB, 3 palette, 4 gray and 6 RGB with alpha
    var type = bytes[25];
    var features = [2, 3, 6].includes(type) ? [PdfAFeature.RGB] : [];
    if (type === 4 || type === 6) features.push(PdfAFeature.TRANSPARENCY);
    for (var at = 8; at + 8 <= bytes.length;) {
      var chunk = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (chunk === "tRNS") features.push(PdfAFeature.TRANSPARENCY);
      if (chunk === "IDAT") break;
      at += 12 + uint16(at) * 65536 + uint16(at + 2);
    }
    return features;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (var marker = 2; marker + 9 < bytes.length;) {
      if (bytes[marker] !== 0xff) break;
      var code = bytes[marker + 1];
      // a start of frame: C0 to CF, except DHT (C4), JPG (C8) and DAC (CC)
      if (code >= 0xc0 && code <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(code)) {
        return (
          { 3: [PdfAFeature.RGB], 4: [PdfAFeature.CMYK] }[bytes[marker + 9]] ||
          []
        );
      }
      marker += 2 + uint16(marker + 2);
    }
  }
  return [];
}

/**
 * Write the output intent PDF/A requires, with the caller's ICC profile, and
 * the array the catalog's /OutputIntents entry refers to.
 * @param {Object} objects - The objects context of the writer.
 * @param {Object} pdfa - The PDF/A settings, see `pdfaOptions()`.
 * @param {*} profile - The bytes of the profile in the form the writer's
 *   streams take.
 * @returns {number} The object ID of the /OutputIntents array.
 */
function writeOutputIntents(objects, pdfa, profile) {
  var profileId = objects.startNewIndirectObject();
  var profileDictionary = objects.startDictionary();
  profileDictionary.writeKey("N");
  profileDictionary.writeNumberValue(pdfa.space.components);
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
  intent.writeLiteralStringValue(pdfa.condition);
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

module.exports = {
  PdfA,
  PdfAFeature,
  imagePdfaFeatures,
  pdfaAnnotationFlags,
  pdfaLevel,
  pdfaOptions,
  requirePdfaAllows,
  writeOutputIntents,
};
