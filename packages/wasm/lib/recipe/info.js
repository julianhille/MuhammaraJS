import { constants } from "../constants.js";
import { infoOptionName, standardInfoKeys } from "../recipe-info.js";
import {
  buildXmpPacket,
  dateToXmp,
  pdfDateToXmp,
  hasPlainMetadata,
} from "../xmp.js";
import { PdfAFeature, requirePdfaAllows, writeOutputIntents } from "../pdfa.js";

var trappedValues = {
  True: constants.EInfoTrappedTrue,
  False: constants.EInfoTrappedFalse,
  Unknown: constants.EInfoTrappedUnknown,
};

var PRODUCER = "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)";
var CREATOR = "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)";
var PLAIN_METADATA =
  "Recipe cannot read or write the XMP of a PDF whose metadata is not encrypted";

/**
 * Creates Recipe document-information methods.
 * @param {{call: Function, withString: Function, createReader: Function}} dependencies - Export helpers and the reader factory.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createInfoMethods({ call, withString, createReader }) {
  /**
   * Formats a Date as a local-time PDF date.
   * @param {Date} date - Date.
   * @returns {string} `D:YYYYMMDDHHmmSS+HH'mm'`.
   */
  function pdfDate(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset < 0 ? "-" : "+";
    /**
     * Formats the absolute value of a number with at least two digits.
     * @param {number} number - Date part.
     * @returns {string} The padded digits.
     */
    var pad = (number) => String(Math.abs(number)).padStart(2, "0");
    return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${sign}${pad(Math.trunc(offset / 60))}'${pad(offset % 60)}'`;
  }

  return {
    /**
     * Gets the document information or sets information entries.
     * Array values are written as comma-and-space-separated text; custom key
     * spelling is preserved.
     *
     * @name info
     * @function
     * @memberof Recipe#
     * @param {Record<string, unknown>} [options] Information entries to set.
     * A standard field set to an empty array is cleared; one without a value (such as `""`), and a custom one that is null or undefined, is left as it is. Omit this argument to read the information.
     * @returns {Recipe|Record<string, string>} The Recipe instance when
     * setting entries, otherwise the Info entries of the source PDF overlaid
     * with the values set on this Recipe, as text; a field wins over
     * a source custom entry of the same name, and a value set on this Recipe
     * over both. Empty for a new PDF without values and for a source that
     * needs a password to open.
     * @throws {TypeError} For an empty key, or Creator, Producer,
     * CreationDate, ModDate, Trapped and the `source-*` entries, which Recipe
     * writes itself.
     * @throws {Error} If entries are set after endPDF(), or custom entries
     * in a PDF/A-4 document, which has no Info dictionary.
     */
    info: function (options) {
      // the fields win over source custom entries of the same name
      if (!options) return { ...this._customInfo, ...this._info };
      if (this._endedBytes || this._endError) {
        throw new Error("PDF writer has ended");
      }
      // check every key before any is set
      Object.keys(options).forEach(infoOptionName);
      Object.entries(options).forEach(([key, value]) => {
        var name = infoOptionName(key);
        var standard = standardInfoKeys.includes(name);
        // an empty array clears a standard field
        if (standard ? !value : value === undefined || value === null) {
          return;
        }
        if (!standard) requirePdfaAllows(this._pdfa, PdfAFeature.CUSTOM_INFO);
        var text = Array.isArray(value) ? value.join(", ") : String(value);
        this._info[name] = text;
        // PDF/A-4 has no Info dictionary: the values only reach XMP
        if (this._pdfa?.withoutInfo) return;
        if (this._sourceMode) {
          var info = this.writer.getDocumentContext().getInfoDictionary();
          if (standard) info[name] = text;
          else info.addAdditionalInfoEntry(name, text);
          return;
        }
        withString(name, (keyPointer) =>
          withString(text, (valuePointer) => {
            call(
              standard
                ? "_muhammara_wasm_recipe_set_info"
                : "_muhammara_wasm_recipe_add_info_entry",
              this._recipe,
              keyPointer,
              valuePointer,
            );
          }),
        );
      });
      return this;
    },

    /**
     * Sets a custom document information entry.
     *
     * @name custom
     * @function
     * @memberof Recipe#
     * @param {string} key Information dictionary key.
     * @param {unknown} value Value converted to text for the PDF; arrays are
     * joined with a comma and space.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the key or value is null or undefined, or the
     * key is one info() rejects.
     * @throws {Error} After endPDF().
     */
    custom: function (key, value) {
      if ([key, value].some((part) => part === undefined || part === null)) {
        throw new TypeError("custom() needs a key and a value");
      }
      return this.info({ [key]: value });
    },

    /**
     * Writes canonical creation and modification information.
     *
     * @name _writeCanonicalInfo
     * @function
     * @memberof Recipe#
     * @private
     * @returns {void}
     */
    _writeCanonicalInfo: function () {
      var info = this._sourceMode
        ? this.writer.getDocumentContext().getInfoDictionary()
        : null;
      var now = new Date();
      if (this.options.xmp || this._pdfa) this._writeXmp(now);
      if (this._pdfa) {
        this._setCatalogReference(
          "OutputIntents",
          writeOutputIntents(
            this._objectsContext(),
            this._pdfa,
            this._pdfa.profile,
          ),
        );
      }
      if (this._pdfa?.withoutInfo) return this;
      if (info) {
        [
          ["modDate", "source-ModDate"],
          ["creator", "source-Creator"],
          ["producer", "source-Producer"],
        ].forEach(([key, sourceKey]) => {
          if (this._sourceInfo?.[key]) {
            info.addAdditionalInfoEntry(sourceKey, this._sourceInfo[key]);
          }
        });
        var trapped = trappedValues[this._sourceInfo?.trapped];
        if (trapped !== undefined) info.trapped = trapped;
        if (this._isNewPDF) info.setCreationDate(now);
        else if (this._sourceInfo?.creationDate) {
          info.setCreationDate(this._sourceInfo.creationDate);
        }
        info.setModDate(now);
        info.producer = PRODUCER;
        info.creator = CREATOR;
        return this;
      }
      withString(pdfDate(now), (datePointer) => {
        call(
          "_muhammara_wasm_recipe_set_info_date",
          this._recipe,
          0,
          datePointer,
        );
        call(
          "_muhammara_wasm_recipe_set_info_date",
          this._recipe,
          1,
          datePointer,
        );
      });
      [
        ["producer", PRODUCER],
        ["creator", CREATOR],
      ].forEach(([key, value]) =>
        withString(key, (keyPointer) =>
          withString(value, (valuePointer) =>
            call(
              "_muhammara_wasm_recipe_set_info",
              this._recipe,
              keyPointer,
              valuePointer,
            ),
          ),
        ),
      );
      return this;
    },

    /**
     * Writes the XMP metadata stream for the Info values this Recipe writes,
     * and points the catalog at it in place of any packet the source PDF had.
     * The stream is not filtered, so that tools which know nothing about PDF
     * can read it.
     *
     * @name _writeXmp
     * @function
     * @memberof Recipe#
     * @private
     * @param {Date} now - The modification date, and creation date of a new PDF.
     * @returns {void}
     * @throws {Error} For a source that keeps its metadata unencrypted, since
     * the writer would encrypt the packet.
     */
    _writeXmp: function (now) {
      if (this._plainMetadata) throw new Error(PLAIN_METADATA);
      // the fields the PDF is written with: an edit's writer dictionary also
      // has low-level changes
      var fields = this._sourceMode
        ? this.writer.getDocumentContext().getInfoDictionary()
        : this._info;
      var packet = buildXmpPacket({
        title: fields.title,
        author: fields.author,
        subject: fields.subject,
        keywords: fields.keywords,
        creator: CREATOR,
        producer: PRODUCER,
        createDate: this._isNewPDF
          ? dateToXmp(now)
          : pdfDateToXmp(this._sourceInfo?.creationDate),
        modifyDate: dateToXmp(now),
        pdfa: this._pdfa,
      });
      var objects = this._objectsContext();
      var id = objects.startNewIndirectObject();
      var dictionary = objects.startDictionary();
      dictionary.writeKey("Type");
      dictionary.writeNameValue("Metadata");
      dictionary.writeKey("Subtype");
      dictionary.writeNameValue("XML");
      var stream = objects.startUnfilteredPDFStream(dictionary);
      stream.getWriteStream().write(new TextEncoder().encode(packet));
      objects.endPDFStream(stream);
      this._setCatalogReference("Metadata", id);
    },

    /**
     * Points a catalog entry at an object when the catalog is written, in
     * place of the entry of a source PDF.
     *
     * @name _setCatalogReference
     * @function
     * @memberof Recipe#
     * @private
     * @param {string} key - The catalog key.
     * @param {number} id - The object ID.
     * @returns {void}
     */
    _setCatalogReference: function (key, id) {
      if (this._sourceMode) {
        this.writer._setCatalogEntry(key, id);
        return;
      }
      withString(key, (keyPointer) =>
        call(
          "_muhammara_wasm_recipe_set_catalog_entry",
          this._recipe,
          keyPointer,
          id,
        ),
      );
    },

    /**
     * Reads the XMP metadata packet of the source PDF.
     *
     * @name xmp
     * @function
     * @memberof Recipe#
     * @returns {string|undefined} The XMP packet as text, or undefined for a
     * new PDF, a source without one, or a source that needs a password to
     * open.
     * @throws {Error} If the source cannot be read, or keeps its metadata
     * unencrypted (`/EncryptMetadata false`).
     */
    xmp: function () {
      if (!this._sourceMode || this._sourceNeedsPassword) return undefined;
      var reader = createReader(this._sourceBytes);
      try {
        if (hasPlainMetadata(reader)) throw new Error(PLAIN_METADATA);
        var root = reader.queryDictionaryObject(reader.getTrailer(), "Root");
        var metadata = root && reader.queryDictionaryObject(root, "Metadata");
        if (metadata?.getType() !== constants.ePDFObjectStream) {
          return undefined;
        }
        // the reader decodes the stream filters
        var input = reader.startReadingFromStream(metadata.toPDFStream());
        var decoder = new TextDecoder();
        var packet = "";
        while (input.notEnded()) {
          packet += decoder.decode(input.read(4096), { stream: true });
        }
        return packet + decoder.decode();
      } finally {
        reader.end();
      }
    },
  };
}
