const fs = require("fs");
const muhammara = require("../muhammara");
/**
 * @name info
 * @desc Add new PDF information, or retrieve existing PDF information.
 * @memberof Recipe
 * @function
 * @param {Object} [options] - The options (when missing obtains existing PDF information)
 * @param {number} [options.version] - The pdf version
 * @param {string} [options.author] - The author
 * @param {string} [options.title] - The title
 * @param {string} [options.subject] - The subject
 * @param {string[]} [options.keywords] - The array of keywords
 */
exports.info = function info(options) {
  let result;

  if (!options) {
    result = this._readInfo();
  } else {
    this.toWriteInfo_ = this.toWriteInfo_ || {};
    Object.assign(this.toWriteInfo_, options);
    result = this;
  }

  return result;
};

exports._readInfo = function _readInfo() {
  if (!this.isNewPDF && !this.infoDictionary) {
    const copyFrom = this.isBufferSrc
      ? new muhammara.PDFRStreamForBuffer(this.src)
      : this.src;
    const copyCtx = this.writer.createPDFCopyingContext(copyFrom);
    const infoDict = copyCtx
      .getSourceDocumentParser()
      .queryDictionaryObject(
        copyCtx.getSourceDocumentParser().getTrailer(),
        "Info"
      );

    const oldInfo =
      infoDict && infoDict.toJSObject ? infoDict.toJSObject() : null;

    if (oldInfo) {
      this.infoDictionary = {};
      Object.getOwnPropertyNames(oldInfo).forEach((key) => {
        if (!oldInfo[key]) {
          return;
        }
        const oldInforSrc = this._parseObjectByType(oldInfo[key]);
        if (!oldInforSrc) {
          return;
        }
        switch (key) {
          case "Trapped":
            if (oldInforSrc && oldInforSrc.value) {
              this.infoDictionary.trapped = oldInforSrc.value;
            }
            break;
          case "CreationDate":
            if (oldInforSrc && oldInforSrc.value) {
              this.infoDictionary.creationDate = oldInforSrc.value;
            }
            break;
          case "ModDate":
            if (oldInforSrc && oldInforSrc.value) {
              this.infoDictionary.modDate = oldInforSrc.value;
            }
            break;
          case "Creator":
            if (oldInforSrc && oldInforSrc.toText) {
              this.infoDictionary.creator = oldInforSrc.toText();
            }
            break;
          case "Producer":
            if (oldInforSrc && oldInforSrc.toText) {
              this.infoDictionary.producer = oldInforSrc.toText();
            }
            break;
          default:
            if (oldInforSrc && oldInforSrc.toText) {
              this.infoDictionary[key.toLowerCase()] = oldInforSrc.toText();
            }
        }
      });
    }
  }

  return this.infoDictionary;
};

exports._writeInfo = function _writeInfo() {
  const options = this.toWriteInfo_ || {};
  const oldInfo = this._readInfo();
  /*
        #41, #48
        This issue is due to the unhandled process exit from HummusJS.
        I have to disable this part before it gets fixed in HummusJS.
    */

  const infoDictionary = this.writer.getDocumentContext().getInfoDictionary();
  const fields = [
    {
      key: "author",
      type: "string",
    },
    {
      key: "title",
      type: "string",
    },
    {
      key: "subject",
      type: "string",
    },
    {
      key: "keywords",
      type: "array",
    },
  ];
  // const ignores = [
  //     'CreationDate', 'Creator', 'ModDate', 'Producer'
  // ];

  if (oldInfo) {
    Object.getOwnPropertyNames(oldInfo).forEach((key) => {
      if (!oldInfo[key]) {
        return;
      }

      switch (key) {
        case "trapped":
          infoDictionary.trapped = oldInfo.trapped;
          break;
        case "creationDate":
          infoDictionary.setCreationDate(oldInfo.creationDate);
          break;
        case "modDate":
          infoDictionary.addAdditionalInfoEntry(
            "source-ModDate",
            oldInfo.modDate
          );
          break;
        case "creator":
          infoDictionary.addAdditionalInfoEntry(
            "source-Creator",
            oldInfo.creator
          );
          break;
        case "producer":
          infoDictionary.addAdditionalInfoEntry(
            "source-Producer",
            oldInfo.producer
          );
          break;
        default:
          infoDictionary[key] = oldInfo[key];
      }
    });
  }

  if (this.isNewPDF) {
    infoDictionary.setCreationDate(new Date());
  }
  infoDictionary.setModDate(new Date());
  infoDictionary.producer =
    "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)";
  infoDictionary.creator =
    "Hummus-Recipe (https://github.com/chunyenHuang/hummusRecipe)";

  fields.forEach((item) => {
    let value = options[item.key];
    if (!value) {
      return;
    } else {
      switch (item.type) {
        case "string":
          value = value.toString();
          break;
        case "date":
          value = new Date(value);
          break;
        case "array":
          value = Array.isArray(value) ? value : [value];
          break;
        default:
      }
    }
    if (item.func) {
      infoDictionary[item.func](value);
    } else {
      infoDictionary[item.key] = value;
    }
  });
  return this;
};

/**
 * @name custom
 * @desc Add custom information to pdf
 * @memberof Recipe
 * @function
 * @param {string} [key] - The key
 * @param {string} [value] - The value
 */
exports.custom = function custom(key, value) {
  const infoDictionary = this.writer.getDocumentContext().getInfoDictionary();
  infoDictionary.addAdditionalInfoEntry(key.toString(), value.toString());
  return this;
};

exports.structure = function structure(output) {
  // PDF file format http://lotabout.me/orgwiki/pdf.html
  // const outputFileType = path.extname(output);
  const outputFile = fs.openSync(output, "w");
  const muhammara = this.muhammara;
  const pdfReader = this.pdfReader;

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
      item
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

exports._parseObjectByType = function _parseObjectByType(inObject) {
  if (!inObject) {
    return;
  }
  const muhammara = this.muhammara;
  const pdfReader = this.pdfReader;
  const type = inObject.getType();
  const label = muhammara.getTypeLabel(type);
  const saveToObject = this.pdfStructure || {};
  let objectID, parsed, dictionaryObject, dictionary;
  switch (type) {
    case muhammara.ePDFObjectIndirectObjectReference:
      objectID = inObject.toPDFIndirectObjectReference().getObjectID();
      parsed = pdfReader.parseNewObject(objectID);
      return this._parseObjectByType(parsed);
    case muhammara.ePDFObjectArray:
      inObject
        .toPDFArray()
        .toJSArray()
        .forEach((element) => {
          this._parseObjectByType(element);
        });
      break;
    case muhammara.ePDFObjectDictionary:
      dictionaryObject = inObject.toPDFDictionary().toJSObject();
      Object.getOwnPropertyNames(dictionaryObject).forEach((element) => {
        this._parseObjectByType(dictionaryObject[element]);
      });
      break;
    case muhammara.ePDFObjectStream:
      dictionary = inObject.toPDFStream().getDictionary();
      return this._parseObjectByType(dictionary);
    default:
      saveToObject[`${label}-${Date.now() * Math.random()}`] = inObject;
      return inObject;
  }
};
