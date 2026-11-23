import { constants } from "../constants.js";
import { structureTree } from "../structure-tree.js";
import { infoOptionName, standardInfoKeys } from "../recipe-info.js";
import { buildXmpPacket, dateToXmp, pdfDateToXmp } from "../xmp.js";
import {
  PdfAFeature,
  requirePdfaAllows,
  requirePdfaAttachment,
  writeOutputIntents,
} from "../pdfa.js";
import { attachment, writeAttachments } from "../attachments.js";
import { pageRecord } from "./page-record.js";
import { outlineNode, writeOutline } from "../outline.js";

var trappedValues = {
  True: constants.EInfoTrappedTrue,
  False: constants.EInfoTrappedFalse,
  Unknown: constants.EInfoTrappedUnknown,
};

var PRODUCER = "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)";
var CREATOR = "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)";
var PLAIN_METADATA =
  "Recipe cannot write the XMP of a PDF whose metadata is not encrypted";

/**
 * Creates Recipe document-information methods.
 * @param {{call: Function, withString: Function, createReader: Function, valueTypes: {PDFTextString: Function, PDFDate: Function}}} dependencies -
 *   Export helpers, the reader factory and the value types.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createInfoMethods({
  call,
  withString,
  createReader,
  valueTypes,
}) {
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
     * Attaches a file to a new PDF, as an embedded file that the document
     * lists as associated with it. A file attached again under the same name
     * replaces the earlier one.
     *
     * @name attach
     * @function
     * @memberof Recipe#
     * @param {string} name - The file name.
     * @param {Uint8Array|ArrayBuffer} file - The file content.
     * @param {RecipeAttachOptions} [options] - The MIME type (default
     * `application/octet-stream`), a description, how the file relates to the
     * document (an `AFRelationship` value, default `Unspecified`), and its
     * modification date (default now).
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the name is empty, the file is no bytes, the MIME
     * type is no bare `type/subtype`, the description no string, the
     * modDate no valid Date, or the relationship is unknown.
     * @throws {Error} After endPDF(), for a source PDF, with insertPage(), or
     * when the PDF/A level does not allow attached files.
     */
    attach: function (name, file, options) {
      if (this._endedBytes || this._endError) {
        throw new Error("PDF writer has ended");
      }
      if (this._sourceMode) throw new Error("attach() applies to a new PDF");
      if (this._insertions) {
        throw new Error(
          "insertPage() cannot be combined with pdfa or attach()",
        );
      }
      requirePdfaAllows(this._pdfa, PdfAFeature.ATTACHMENTS);
      var bytes = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError("An attached file needs its bytes");
      }
      var entry = attachment(name, bytes, options);
      this._attachments = this._attachments || new Map();
      this._attachments.set(name, entry);
      return this;
    },

    /**
     * Adds a bookmark, an entry of the outline a viewer shows beside the
     * pages, that opens a page. Bookmarks nest through `options.children`.
     * The page may be created after the call.
     *
     * @name bookmark
     * @function
     * @memberof Recipe#
     * @param {string} title - The title; any Unicode text.
     * @param {number} pageNumber - The one-based number of the page it opens,
     * counted in the finished document, after deletePage(), insertPage() and
     * appendPage(); editPage() counts the source.
     * @param {RecipeBookmarkOptions} [options] - Whether its children show
     * open (default closed), where the page opens (`x` and `y`, in Recipe
     * coordinates, together), the `zoom` (1 for 100%) and the `children`, each
     * with a `title`, `pageNumber` and the options of a bookmark. The page
     * opens fitted to the window without `x`, `y` and `zoom`.
     * @returns {Recipe} The Recipe instance.
     * @throws {TypeError} If the title is empty, contains NUL or is not a string,
     * the options are no object, an option is unknown or invalid, `x`, `y` or
     * `zoom` exceeds 2147483647, or only one of `x` and
     * `y` is given.
     * @throws {RangeError} If the page number is no positive integer, or the
     * bookmarks nest deeper than 64 levels. endPDF() throws it too, for a page
     * the finished document does not have; no PDF is returned then.
     * @throws {Error} After endPDF(), and for a source PDF that has an outline.
     */
    bookmark: function (title, pageNumber, options) {
      if (this._endedBytes || this._endError) {
        throw new Error("PDF writer has ended");
      }
      var node = outlineNode(title, pageNumber, options);
      if (this._sourceMode) {
        var reader = this._openSourceReader();
        try {
          var root = reader.queryDictionaryObject(reader.getTrailer(), "Root");
          if (root.toPDFDictionary().exists("Outlines")) {
            throw new Error(
              "bookmark() cannot add to a source PDF that already has an outline",
            );
          }
        } finally {
          reader.end();
        }
      }
      (this._bookmarks ||= []).push(node);
      return this;
    },

    /**
     * Writes the bookmarks of this Recipe as the document outline, with a
     * modifier over the finished document, so that page numbers are those of
     * the finished document.
     *
     * @name _writeBookmarks
     * @function
     * @memberof Recipe#
     * @private
     * @param {Object} writer - A modifier over the finished document.
     * @returns {Uint8Array} The document with its outline.
     * @throws {RangeError} If a bookmark opens a page the document does not
     * have; no PDF is returned then.
     */
    _writeBookmarks: function (writer) {
      var context = writer.createPDFCopyingContextForModifiedFile();
      try {
        var reader = context.getSourceDocumentParser();
        // the helpers of this Recipe, on the geometry of the finished page
        var host = Object.create(this);
        var records = new Map();
        host.pageInfo = (n) => {
          if (!records.has(n)) {
            var info = reader.getPageInfo(n - 1);
            records.set(n, pageRecord(n, info.mediaBox, info.rotate));
          }
          return records.get(n);
        };
        var id = writeOutline(
          writer.getObjectsContext(),
          this._bookmarks,
          reader.getPagesCount(),
          (node) => {
            var id = reader.getPageObjectID(node.pageNumber - 1);
            if (node.x === undefined) return { id };
            var { nx, ny } = host._calibrateCoordinateForAnnots(
              node.x,
              node.y,
              0,
              0,
              node.pageNumber,
            );
            return { id, left: nx, top: ny };
          },
          valueTypes,
        );
        writer._setCatalogEntry("Outlines", id);
      } finally {
        reader?.end();
      }
      // the date the writer stamps on an edit; PDF/A-4 has no Info dictionary
      if (this._pdfa?.withoutInfo) {
        writer.getDocumentContext().getInfoDictionary().setModDate(null);
      }
      return writer.end();
    },

    /**
     * Writes canonical creation and modification information, and the XMP
     * packet, the PDF/A output intent and the attached files.
     *
     * @name _writeCanonicalInfo
     * @function
     * @memberof Recipe#
     * @private
     * @returns {Recipe} The Recipe instance.
     * @throws {Error} If a PDF/A-4f document has no attached file.
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
          writeOutputIntents(this._objectsContext(), this._pdfa),
        );
      }
      requirePdfaAttachment(this._pdfa, this._attachments?.size ?? 0);
      if (this._attachments) {
        var ids = writeAttachments(
          this._objectsContext(),
          [...this._attachments.values()],
          valueTypes,
        );
        this._setCatalogReference("Names", ids.names);
        this._setCatalogReference("AF", ids.associated);
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
     * @throws {Error} For a source that keeps its metadata unencrypted.
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
     * Opens a reader on the source PDF; the caller ends it.
     *
     * @private
     * @returns {object} The modifier's parser while it is open, so that the
     * source is not parsed twice; its own reader after endPDF(), so that the
     * source stays readable then, as on native.
     */
    _openSourceReader: function () {
      return this._endedBytes || this._endError
        ? createReader(this._sourceBytes)
        : this.writer.getModifiedFileParser();
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
     * @throws {Error} If the source cannot be read.
     */
    xmp: function () {
      if (!this._sourceMode || this._sourceNeedsPassword) return undefined;
      var reader = this._openSourceReader();
      try {
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

    /**
     * Describes the object tree of the source PDF's trailer, as native
     * `structure()` writes it. Does not finish the Recipe.
     *
     * @private
     * @returns {string} One `\r\n` terminated line per object.
     * @throws {Error} If the Recipe has no source PDF, or endPDF() already
     * released the reader, as on native, or the source needs a password.
     */
    _structureTree: function () {
      if (!this._sourceMode) {
        throw new Error("The Recipe has no source PDF to read");
      }
      if (this._endedBytes || this._endError) {
        throw new Error(
          "The source PDF reader has been released by endPDF(). Read the source before ending the document.",
        );
      }
      if (this._sourceNeedsPassword) {
        throw new Error(
          "The structure of a password-protected source is unsupported; decrypt it with recrypt() first",
        );
      }
      var reader = this._openSourceReader();
      try {
        return structureTree(reader, constants);
      } finally {
        reader.end();
      }
    },
  };
}
