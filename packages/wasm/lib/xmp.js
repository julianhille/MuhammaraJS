// XMP metadata (ISO 16684-1) for the Info dictionary values Recipe writes.
// Mirrored in packages/native-core/lib/xmp.js; keep both files identical
// apart from the module syntax.

var XMP_NS = Object.freeze({
  x: "adobe:ns:meta/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  dc: "http://purl.org/dc/elements/1.1/",
  pdf: "http://ns.adobe.com/pdf/1.3/",
  xmp: "http://ns.adobe.com/xap/1.0/",
  pdfaid: "http://www.aiim.org/pdfa/ns/id/",
});

/**
 * Escape text for XML and drop the control characters XML 1.0 cannot hold.
 * @param {string} value - The text.
 * @returns {string} The escaped text.
 */
function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a Date as an XMP (ISO 8601) date with its local time zone, which is
 * the instant the Info dictionary gets for the same Date.
 * @param {Date} date - The date.
 * @returns {string} For example 2020-01-02T03:04:05+01:30.
 */
function dateToXmp(date) {
  /**
   * @param {number} n - A date part.
   * @returns {string} The part with at least two digits.
   */
  var pad = (n) => String(n).padStart(2, "0");
  var offset = -date.getTimezoneOffset();
  var zone =
    offset === 0
      ? "Z"
      : `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${zone}`
  );
}

/**
 * Format a PDF date string (D:YYYYMMDDHHmmSSOHH'mm') as an XMP date.
 * @param {string} value - The PDF date.
 * @returns {string|undefined} The XMP date, or undefined when value is not a PDF date.
 */
function pdfDateToXmp(value) {
  var match =
    /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(?:(\d{2})'?(\d{2})?'?)?/.exec(
      String(value),
    );
  if (!match) return undefined;
  var [, year, month, day, hour, minute, second, relation, zh, zm] = match;
  var result = year;
  if (month) result += `-${month}`;
  if (month && day) result += `-${day}`;
  if (month && day && hour) {
    result += `T${hour}:${minute || "00"}${second ? `:${second}` : ""}`;
    // a PDF date without a zone has an unknown zone, which XMP leaves out
    if (relation === "Z") result += "Z";
    if (relation === "+" || relation === "-") {
      result += `${relation}${zh || "00"}:${zm || "00"}`;
    }
  }
  return result;
}

/**
 * Build the XMP packet that mirrors Info dictionary values, so the two stay in
 * sync. Values that are missing or empty are left out.
 * @param {Object} info - The values.
 * @param {string} [info.title] - The title.
 * @param {string} [info.author] - The author.
 * @param {string} [info.subject] - The subject.
 * @param {string} [info.keywords] - The keywords.
 * @param {string} [info.creator] - The creating application.
 * @param {string} [info.producer] - The PDF producer.
 * @param {string} [info.createDate] - The creation date, as an XMP date.
 * @param {string} [info.modifyDate] - The modification date, as an XMP date.
 * @param {Object} [info.pdfa] - The PDF/A identification (ISO 19005), for a
 *   document that conforms to PDF/A-1 to PDF/A-4.
 * @param {number} info.pdfa.part - The part: 1 to 4.
 * @param {string} [info.pdfa.conformance] - The level: A, B or U for parts 1
 *   to 3; E or F, or none, for part 4.
 * @param {number} [info.pdfa.revision] - The year of the part, which part 4
 *   requires, such as 2020.
 * @returns {string} The packet, wrapped in xpacket processing instructions.
 */
function buildXmpPacket(info) {
  /**
   * @param {unknown} value - A value.
   * @returns {boolean} Whether the value is written.
   */
  var has = (value) => value !== undefined && value !== null && value !== "";
  /**
   * @param {string} value - A text.
   * @returns {string} The text as a language alternative.
   */
  var alt = (value) =>
    `<rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt>`;
  /**
   * @param {string} prefix - The namespace prefix.
   * @param {string} properties - The properties in that namespace.
   * @returns {string} The rdf:Description, or nothing without properties.
   */
  var description = (prefix, properties) =>
    properties
      ? `<rdf:Description rdf:about="" xmlns:${prefix}="${XMP_NS[prefix]}">${properties}</rdf:Description>\n`
      : "";
  /**
   * @param {string} name - The property name.
   * @param {unknown} value - The value.
   * @returns {string} The property, or nothing without a value.
   */
  var simple = (name, value) =>
    has(value) ? `<${name}>${escapeXml(value)}</${name}>` : "";

  var dc =
    (has(info.title) ? `<dc:title>${alt(info.title)}</dc:title>` : "") +
    (has(info.author)
      ? `<dc:creator><rdf:Seq><rdf:li>${escapeXml(info.author)}</rdf:li></rdf:Seq></dc:creator>`
      : "") +
    (has(info.subject)
      ? `<dc:description>${alt(info.subject)}</dc:description>`
      : "");
  var pdf =
    simple("pdf:Producer", info.producer) +
    simple("pdf:Keywords", info.keywords);
  var xmp =
    simple("xmp:CreatorTool", info.creator) +
    simple("xmp:CreateDate", info.createDate) +
    simple("xmp:ModifyDate", info.modifyDate) +
    simple("xmp:MetadataDate", info.modifyDate);
  var body =
    description("dc", dc) +
    description("pdf", pdf) +
    description("xmp", xmp) +
    description(
      "pdfaid",
      info.pdfa
        ? simple("pdfaid:part", info.pdfa.part) +
            simple("pdfaid:conformance", info.pdfa.conformance) +
            simple("pdfaid:rev", info.pdfa.revision)
        : "",
    );

  return (
    '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    `<x:xmpmeta xmlns:x="${XMP_NS.x}">\n` +
    `<rdf:RDF xmlns:rdf="${XMP_NS.rdf}">\n` +
    (body || '<rdf:Description rdf:about=""/>\n') +
    "</rdf:RDF>\n</x:xmpmeta>\n" +
    '<?xpacket end="w"?>'
  );
}

/**
 * Whether a PDF keeps its metadata unencrypted (`/EncryptMetadata false`),
 * which the reader and writer do not honour: they decrypt and encrypt the
 * XMP packet anyway.
 * @param {Object} reader - A reader of the PDF.
 * @returns {boolean} True for such a PDF.
 */
function hasPlainMetadata(reader) {
  var encrypt = reader.queryDictionaryObject(reader.getTrailer(), "Encrypt");
  var flag =
    encrypt && reader.queryDictionaryObject(encrypt, "EncryptMetadata");
  return Boolean(flag) && flag.value === false;
}

export { buildXmpPacket, dateToXmp, pdfDateToXmp, hasPlainMetadata };
