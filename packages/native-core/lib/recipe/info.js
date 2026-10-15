const fs = require("fs");
var {
  standardInfoKeys,
  pdfInfoNames,
  infoOptionName,
} = require("../recipe-info");
var {
  buildXmpPacket,
  dateToXmp,
  pdfDateToXmp,
  hasPlainMetadata,
} = require("../xmp");
var { PdfAFeature, requirePdfaAllows, writeOutputIntents } = require("../pdfa");

var PLAIN_METADATA =
  "Recipe cannot read or write the XMP of a PDF whose metadata is not encrypted";

// Source Info dictionary keys that _readInfo() keeps as raw values.
var PdfInfoKey = Object.freeze({
  TRAPPED: "Trapped",
  CREATION_DATE: "CreationDate",
  MOD_DATE: "ModDate",
  CREATOR: "Creator",
  PRODUCER: "Producer",
});

// Names _readInfo() caches those entries under in this.infoDictionary.
var CachedInfoKey = Object.freeze({
  TRAPPED: "trapped",
  CREATION_DATE: "creationDate",
  MOD_DATE: "modDate",
  CREATOR: "creator",
  PRODUCER: "producer",
});

/**
 * Map the Trapped names in cached info to the addon's EInfoTrapped values.
 * @private
 * @param {Object} muhammara - The addon API the Recipe was created for.
 * @returns {Object<string, number>} The Trapped values by name.
 */
function trappedValues(muhammara) {
  return {
    True: muhammara.EInfoTrappedTrue,
    False: muhammara.EInfoTrappedFalse,
    Unknown: muhammara.EInfoTrappedUnknown,
  };
}

/**
 * @name info
 * @desc Add standard and custom PDF information, or read it. The Info name of a standard field, such as `Title`, sets that field; other keys are custom entries and keep their spelling. Array values are joined with a comma and space.
 * @memberof Recipe#
 * @function
 * @param {Object} [options] - The options (when missing obtains the PDF information)
 * @param {string} [options.author] - The author
 * @param {string} [options.title] - The title
 * @param {string} [options.subject] - The subject
 * @param {string[]} [options.keywords] - The array of keywords
 * @returns {Object<string, string>|Recipe} When options are omitted, the Info
 *   entries of the source PDF overlaid with the values set on this Recipe, as
 *   text: the standard fields and the source's `creationDate`, `modDate`,
 *   `creator`, `producer` and `trapped` by those names, and custom entries as
 *   spelled; a field wins over a source custom entry of the same name, and a
 *   value set on this Recipe over both. Empty for a new PDF without values
 *   and for a source that needs its user password. The Creator,
 *   Producer, ModDate and `source-*` entries Recipe writes at endPDF() are
 *   not included. Otherwise the recipe instance. A standard field set to an empty array is cleared; one without a value (such as `""`), and a custom one that is null or undefined, is left as it is.
 * @throws {TypeError} For an empty key, or Creator, Producer, CreationDate,
 *   ModDate, Trapped and the `source-*` entries, which Recipe writes itself.
 * @throws {Error} If the source information cannot be read, or options are
 *   given after endPDF().
 */
exports.info = function info(options) {
  if (!options) {
    const source = this._readInfo();
    // the fields win over source custom entries of the same name
    return Object.assign({}, this.sourceCustomInfo_, source, this.infoValues_);
  }
  if (this.ended) throw new Error("PDF writer has ended");
  // check every key before any is set
  Object.keys(options).forEach(infoOptionName);
  Object.entries(options).forEach(([key, value]) => {
    const name = infoOptionName(key);
    if (standardInfoKeys.includes(name)) {
      // an empty array clears the field
      if (value) setInfoValue(this, name, value);
    } else if (value !== undefined && value !== null) {
      requirePdfaAllows(this.pdfa_, PdfAFeature.CUSTOM_INFO);
      // written now, and again by endPDF() over the entries of the source
      this.writer
        .getDocumentContext()
        .getInfoDictionary()
        .addAdditionalInfoEntry(name, setInfoValue(this, name, value));
    }
  });
  return this;
};

/**
 * Keep an information value for endPDF() as the text it is written with.
 * @private
 * @param {Recipe} recipe - The recipe.
 * @param {string} key - The key.
 * @param {*} value - The value; arrays are joined with a comma and space.
 * @returns {string} The text.
 */
function setInfoValue(recipe, key, value) {
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  recipe.infoValues_ = recipe.infoValues_ || {};
  recipe.infoValues_[key] = text;
  return text;
}

/**
 * @name xmp
 * @desc Read the XMP metadata packet of the source PDF.
 * @memberof Recipe#
 * @function
 * @returns {string|undefined} The XMP packet as text, or undefined for a new PDF, a source without one, or a source that needs its user password. After endPDF(), a path source edited in place is the output.
 * @throws {Error} If the source cannot be read, or keeps its metadata
 *   unencrypted (`/EncryptMetadata false`).
 */
exports.xmp = function xmp() {
  if (this.isNewPDF) return undefined;
  // its own reader, so that the packet can be read after endPDF() too
  const parser = openSourceReader(this);
  if (!parser) return undefined;
  try {
    if (hasPlainMetadata(parser)) throw new Error(PLAIN_METADATA);
    const root = parser.queryDictionaryObject(parser.getTrailer(), "Root");
    const metadata = root && parser.queryDictionaryObject(root, "Metadata");
    if (!metadata || metadata.getType() !== this.muhammara.ePDFObjectStream) {
      return undefined;
    }
    // the reader decodes the stream filters
    const input = parser.startReadingFromStream(metadata.toPDFStream());
    const chunks = [];
    while (input.notEnded()) chunks.push(Buffer.from(input.read(4096)));
    // without a byte order mark, as Wasm reads it
    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally {
    parser.end();
  }
};

/**
 * Read the Info dictionary of the source PDF once and cache it: the standard
 * fields by their option names and Trapped, CreationDate, ModDate, Creator and
 * Producer by their `CachedInfoKey` names in `this.infoDictionary`, and the
 * custom entries as spelled in `this.sourceCustomInfo_`.
 * @private
 * @returns {Object|undefined} The cached information; undefined for a new PDF,
 *   and empty for a source without an Info dictionary.
 * @throws {Error} If the source cannot be read.
 */
exports._readInfo = function _readInfo() {
  if (!this.isNewPDF && !this.infoDictionary) {
    // also cached when the source has no Info dictionary
    this.infoDictionary = {};
    this.sourceCustomInfo_ = {};
    const parser = openSourceReader(this);
    this.sourceNeedsPassword_ = !parser;
    if (!parser) return this.infoDictionary;
    try {
      this.sourcePlainMetadata_ = hasPlainMetadata(parser);
      const infoDict = parser.queryDictionaryObject(
        parser.getTrailer(),
        "Info",
      );
      const keys =
        infoDict && infoDict.getType() === this.muhammara.ePDFObjectDictionary
          ? Object.keys(infoDict.toJSObject())
          : [];
      keys.forEach((key) => {
        // resolves one indirect value, as Wasm does
        const oldInforSrc = key && parser.queryDictionaryObject(infoDict, key);
        // an entry without a name, too, which Wasm does not read either
        if (!oldInforSrc) {
          return;
        }
        switch (key) {
          case PdfInfoKey.TRAPPED:
            // a name, not a boolean
            if (typeof oldInforSrc.value === "string") {
              this.infoDictionary[CachedInfoKey.TRAPPED] = oldInforSrc.value;
            }
            break;
          case PdfInfoKey.CREATION_DATE:
            if (oldInforSrc && oldInforSrc.value) {
              this.infoDictionary[CachedInfoKey.CREATION_DATE] =
                oldInforSrc.value;
            }
            break;
          case PdfInfoKey.MOD_DATE:
            if (oldInforSrc && oldInforSrc.value) {
              this.infoDictionary[CachedInfoKey.MOD_DATE] = oldInforSrc.value;
            }
            break;
          case PdfInfoKey.CREATOR:
            if (oldInforSrc && oldInforSrc.toText) {
              this.infoDictionary[CachedInfoKey.CREATOR] = oldInforSrc.toText();
            }
            break;
          case PdfInfoKey.PRODUCER:
            if (oldInforSrc && oldInforSrc.toText) {
              this.infoDictionary[CachedInfoKey.PRODUCER] =
                oldInforSrc.toText();
            }
            break;
          default:
            if (oldInforSrc && oldInforSrc.toText) {
              // standard fields by their option name, custom entries apart
              // and as spelled, so that they cannot clash
              if (pdfInfoNames[key]) {
                this.infoDictionary[pdfInfoNames[key]] = oldInforSrc.toText();
              } else {
                this.sourceCustomInfo_[key] = oldInforSrc.toText();
              }
            }
        }
      });
    } finally {
      parser.end();
    }
  }

  return this.infoDictionary;
};

/**
 * Open a reader on the source for its Info and XMP, without a password: it
 * decrypts a PDF that only an owner password protects with the right key. A
 * PDF that needs its user password is not read, since the reader cannot tell
 * whether a given password is the user or the owner one, and decrypts with
 * the wrong key for an owner password.
 * @private
 * @param {Recipe} recipe - The recipe.
 * @returns {Object|null} The reader, which the caller ends, or null for a
 *   source that needs its user password.
 */
function openSourceReader(recipe) {
  const parser = recipe.muhammara.createReader(
    recipe.isBufferSrc
      ? new recipe.muhammara.PDFRStreamForBuffer(recipe.src)
      : recipe.src,
  );
  if (parser.getPagesCount() > 0) return parser;
  parser.end();
  return null;
}

/**
 * Write the Info dictionary over the source's fields and custom entries, which
 * the writer has already: the source's CreationDate, Trapped and `source-*`
 * entries, a new ModDate, Producer and Creator, and the fields set with
 * info(); then the XMP packet when the `xmp` option is set.
 * @private
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the source information cannot be read.
 * @throws {Error} For a source that needs its user password, which Recipe
 *   cannot write, and for the `xmp` option on a source that keeps its
 *   metadata unencrypted.
 */
exports._writeInfo = function _writeInfo() {
  const trapped = trappedValues(this.muhammara);
  const oldInfo = this._readInfo();
  // the writer would encrypt the new entries with a key that does not match
  if (this.sourceNeedsPassword_) {
    // as on Wasm
    throw new Error(
      "Editing a password-protected source is unsupported; decrypt it with recrypt() first",
    );
  }
  // the writer would encrypt the packet
  if (this.options.xmp && this.sourcePlainMetadata_) {
    throw new Error(PLAIN_METADATA);
  }
  /*
        #41, #48
        This issue is due to the unhandled process exit from HummusJS.
        I have to disable this part before it gets fixed in HummusJS.
    */

  // PDF/A-4 has no Info dictionary: its values only reach the XMP packet, and
  // the date the writer stamps on an edit, the annotation pass, is removed
  if (this.pdfa_?.withoutInfo) {
    this.writer.getDocumentContext().getInfoDictionary().setModDate(null);
  }
  const infoDictionary = this.pdfa_?.withoutInfo
    ? {
        setCreationDate() {},
        setModDate() {},
        addAdditionalInfoEntry() {},
      }
    : this.writer.getDocumentContext().getInfoDictionary();
  const xmpDates = {};
  if (oldInfo) {
    Object.getOwnPropertyNames(oldInfo).forEach((key) => {
      if (!oldInfo[key]) return;

      switch (key) {
        case CachedInfoKey.TRAPPED:
          if (trapped[oldInfo[CachedInfoKey.TRAPPED]] !== undefined) {
            infoDictionary.trapped = trapped[oldInfo[CachedInfoKey.TRAPPED]];
          }
          break;
        case CachedInfoKey.CREATION_DATE:
          infoDictionary.setCreationDate(oldInfo.creationDate);
          xmpDates.createDate = pdfDateToXmp(oldInfo.creationDate);
          break;
        case CachedInfoKey.MOD_DATE:
          infoDictionary.addAdditionalInfoEntry(
            "source-ModDate",
            oldInfo.modDate,
          );
          break;
        case CachedInfoKey.CREATOR:
          infoDictionary.addAdditionalInfoEntry(
            "source-Creator",
            oldInfo.creator,
          );
          break;
        case CachedInfoKey.PRODUCER:
          infoDictionary.addAdditionalInfoEntry(
            "source-Producer",
            oldInfo.producer,
          );
      }
    });
  }

  if (this.isNewPDF) {
    const created = new Date();
    infoDictionary.setCreationDate(created);
    xmpDates.createDate = dateToXmp(created);
  }
  const modified = new Date();
  infoDictionary.setModDate(modified);
  xmpDates.modifyDate = dateToXmp(modified);
  infoDictionary.producer =
    "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)";
  infoDictionary.creator =
    "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)";

  // the fields set on this Recipe replace those of the source; the custom
  // entries of both are in the dictionary already
  standardInfoKeys.forEach((key) => {
    if (this.infoValues_ && key in this.infoValues_) {
      infoDictionary[key] = this.infoValues_[key];
    }
  });
  if (this.options.xmp || this.pdfa_) {
    writeXmp(this.writer, infoDictionary, xmpDates, this.pdfa_);
  }
  if (this.pdfa_) {
    setCatalogEntry(
      this.writer,
      "OutputIntents",
      writeOutputIntents(
        this.writer.getObjectsContext(),
        this.pdfa_,
        Array.from(this.pdfa_.profile),
      ),
    );
  }
  return this;
};

/**
 * Write the XMP metadata stream for the Info values just written, and point the
 * catalog at it in place of any packet the source PDF had. The stream is not
 * filtered, so that tools which know nothing about PDF can read it.
 * @private
 * @param {Object} writer - The writer.
 * @param {Object} info - The writer's Info dictionary.
 * @param {Object} dates - The XMP dates.
 * @param {string} [dates.createDate] - The creation date.
 * @param {string} [dates.modifyDate] - The modification date.
 * @param {Object} [pdfa] - The PDF/A level to identify the document as.
 * @returns {void}
 */
function writeXmp(writer, info, dates, pdfa) {
  const packet = buildXmpPacket(
    Object.assign(
      {
        title: info.title,
        author: info.author,
        subject: info.subject,
        keywords: info.keywords,
        creator: info.creator,
        producer: info.producer,
        pdfa,
      },
      dates,
    ),
  );
  const objects = writer.getObjectsContext();
  const id = objects.startNewIndirectObject();
  const dictionary = objects.startDictionary();
  dictionary.writeKey("Type");
  dictionary.writeNameValue("Metadata");
  dictionary.writeKey("Subtype");
  dictionary.writeNameValue("XML");
  const stream = objects.startUnfilteredPDFStream(dictionary);
  stream.getWriteStream().write(Array.from(Buffer.from(packet, "utf8")));
  objects.endPDFStream(stream);
  setCatalogEntry(writer, "Metadata", id);
}

/**
 * Point a catalog entry at an object when the catalog is written, in place of
 * the entry of a source PDF.
 * @private
 * @param {Object} writer - The writer.
 * @param {string} key - The catalog key.
 * @param {number} id - The object ID.
 * @returns {void}
 */
function setCatalogEntry(writer, key, id) {
  writer.requireCatalogUpdate();
  writer.getEvents().on("OnCatalogWrite", (event) => {
    event.catalogDictionaryContext.writeKey(key);
    event.catalogDictionaryContext.writeObjectReferenceValue(id);
  });
}

/**
 * @name custom
 * @desc Add an information entry, as `info({ [key]: value })` does.
 * @memberof Recipe#
 * @function
 * @param {string} key - The key
 * @param {*} value - The value; arrays are joined with a comma and space,
 *   other values are converted with String().
 * @returns {Recipe} The recipe instance.
 * @throws {TypeError} If the key or value is null or undefined, or the key is
 *   an Info entry Recipe writes itself.
 * @throws {Error} After endPDF(), or in a PDF/A-4 document, which has no
 *   Info dictionary.
 */
exports.custom = function custom(key, value) {
  if ([key, value].some((part) => part === undefined || part === null)) {
    throw new TypeError("custom() needs a key and a value");
  }
  return this.info({ [key]: value });
};

/**
 * Write the PDF object structure to a file.
 * @name structure
 * @function
 * @memberof Recipe#
 * @param {string} output - The output file path.
 * @returns {Recipe} The recipe instance.
 * @throws {Error} If the source reader was released by endPDF(), or the
 *   output file cannot be written.
 */
exports.structure = function structure(output) {
  // PDF file format http://lotabout.me/orgwiki/pdf.html
  // const outputFileType = path.extname(output);
  const outputFile = fs.openSync(output, "w");
  const muhammara = this.muhammara;
  const pdfReader = this._getReader();

  const tabWidth = "  ";
  const structures = [
    "Info",
    "Root", // catalog
    "Size",
    "Prev",
    "ID",
    // 'Encrypt',
    // 'XRefStm'
  ];

  const write = (item) => {
    const mIteratedObjectIDs = {};
    let mTabLevel = 0;

    const addTabs = () => {
      let output = "";
      for (let i = 0; i < mTabLevel; ++i) {
        output += tabWidth;
      }
      return output;
    };

    const logToFile = (inString) => {
      fs.writeSync(outputFile, addTabs() + inString + "\r\n");
    };

    const iterateObjectTypes = (inObject) => {
      const type = inObject.getType();
      const label = muhammara.getTypeLabel(type);
      let output = "";
      let objectID, jsArray, aDictionary, keys;

      switch (type) {
        case muhammara.ePDFObjectIndirectObjectReference:
          ++mTabLevel;
          objectID = inObject.toPDFIndirectObjectReference().getObjectID();
          output += `Indirect object reference (${objectID}): `;
          logToFile(output);
          if (
            !Object.prototype.hasOwnProperty.call(mIteratedObjectIDs, objectID)
          ) {
            mIteratedObjectIDs[objectID] = true;
            iterateObjectTypes(pdfReader.parseNewObject(objectID));
          }
          for (var i = 0; i < mTabLevel; ++i) {
            output += " ";
          }
          --mTabLevel;
          return;
        case muhammara.ePDFObjectArray:
          jsArray = inObject.toPDFArray().toJSArray();
          output += `- ${label} [${jsArray.length}]`;
          logToFile(output);
          ++mTabLevel;
          jsArray.forEach((element) => {
            iterateObjectTypes(element);
          });
          --mTabLevel;
          break;
        case muhammara.ePDFObjectDictionary:
          aDictionary = inObject.toPDFDictionary().toJSObject();
          keys = Object.getOwnPropertyNames(aDictionary).join(", ");
          output += `- ${label} {${keys}}`;
          logToFile(output);
          ++mTabLevel;
          Object.getOwnPropertyNames(aDictionary).forEach((element) => {
            logToFile(element + " *");
            iterateObjectTypes(aDictionary[element]);
          });
          --mTabLevel;
          break;
        case muhammara.ePDFObjectStream:
          output += "Stream . iterating stream dictionary:";
          logToFile(output);
          iterateObjectTypes(inObject.toPDFStream().getDictionary());
          break;
        default:
          output += `${tabWidth}${label}: ${inObject}`;
          logToFile(output);
      }
    };

    const itemTrailer = pdfReader.queryDictionaryObject(
      pdfReader.getTrailer(),
      item,
    );
    logToFile(item);
    iterateObjectTypes(itemTrailer);
  };

  structures.forEach((item) => {
    write(item);
  });

  fs.closeSync(outputFile);
  return this;
};
