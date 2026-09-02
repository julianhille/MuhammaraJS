export function createValueTypes({ module, withString, withBytes }) {
  var encoder = new TextEncoder();
  function textStringBytes(value) {
    var bytes = encoder.encode(value);
    var lengthPointer = module._malloc(4);
    try {
      return withBytes(bytes, (pointer) => {
        var result = module._muhammara_wasm_pdf_text_string_from_utf8(
          pointer,
          bytes.length,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!result && length)
          throw new Error("Unable to encode PDF text string");
        try {
          return result
            ? module.HEAPU8.slice(result, result + length)
            : new Uint8Array();
        } finally {
          if (result) module._muhammara_wasm_free(result);
        }
      });
    } finally {
      module._free(lengthPointer);
    }
  }

  function textStringValue(bytes) {
    var lengthPointer = module._malloc(4);
    try {
      return withBytes(bytes, (pointer) => {
        var result = module._muhammara_wasm_pdf_text_string_to_utf8(
          pointer,
          bytes.length,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!result && length)
          throw new Error("Unable to decode PDF text string");
        try {
          return result
            ? new TextDecoder().decode(
                module.HEAPU8.slice(result, result + length),
              )
            : "";
        } finally {
          if (result) module._muhammara_wasm_free(result);
        }
      });
    } finally {
      module._free(lengthPointer);
    }
  }

  function normalizePDFDate(value) {
    if (value instanceof PDFDate) return value.toString();
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime()))
        throw new TypeError("PDFDate requires a valid Date");
      var offset = -value.getTimezoneOffset();
      var sign = offset < 0 ? "-" : "+";
      var pad = (number) => String(Math.abs(number)).padStart(2, "0");
      value = `D:${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}${sign}${pad(Math.trunc(offset / 60))}'${pad(offset % 60)}'`;
    }
    if (typeof value !== "string") {
      throw new TypeError("PDFDate requires a PDF date string or Date");
    }
    return withString(value, (pointer) => {
      var lengthPointer = module._malloc(4);
      try {
        var result = module._muhammara_wasm_pdf_date_normalize(
          pointer,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!result && length) throw new Error("Unable to parse PDF date");
        try {
          return result
            ? new TextDecoder().decode(
                module.HEAPU8.slice(result, result + length),
              )
            : "";
        } finally {
          if (result) module._muhammara_wasm_free(result);
        }
      } finally {
        module._free(lengthPointer);
      }
    });
  }

  class PDFTextString {
    constructor(value = "") {
      this._bytes = new Uint8Array();
      if (typeof value === "string") {
        this.fromString(value);
      } else if (
        Array.isArray(value) ||
        value instanceof Uint8Array ||
        value instanceof ArrayBuffer
      ) {
        value = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
        if (
          !Array.from(value).every(
            (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
          )
        ) {
          throw new TypeError(
            "PDFTextString bytes must be integers from 0 to 255",
          );
        }
        this._bytes = Uint8Array.from(value);
      } else {
        throw new TypeError("PDFTextString requires a string or byte array");
      }
    }

    toBytesArray() {
      return Array.from(this._bytes);
    }

    toString() {
      return textStringValue(this._bytes);
    }

    fromString(value) {
      if (typeof value !== "string")
        throw new TypeError("PDFTextString requires a string");
      this._bytes = textStringBytes(value);
      return this;
    }
  }

  class PDFDate {
    constructor(value) {
      this._value = value === undefined ? "" : normalizePDFDate(value);
    }

    toString() {
      return this._value;
    }

    setToCurrentTime() {
      this._value = normalizePDFDate(new Date());
      return this;
    }
  }

  class PDFPage {
    constructor(left = 0, bottom = 0, right = 595, top = 842) {
      if (
        ![left, bottom, right, top].every(Number.isFinite) ||
        right <= left ||
        top <= bottom
      ) {
        throw new RangeError(
          "PDFPage requires valid left, bottom, right, and top coordinates",
        );
      }
      this._boxes = { media: [left, bottom, right, top] };
      this._rotation = undefined;
      this._setNativeBox = null;
      this._setNativeRotation = null;
      this._getNativeResources = null;
    }
  }

  function definePageBox(name) {
    Object.defineProperty(PDFPage.prototype, `${name}Box`, {
      get: function () {
        return this._boxes[name];
      },
      set: function (value) {
        if (
          !Array.isArray(value) ||
          value.length !== 4 ||
          !value.every(Number.isFinite) ||
          value[2] <= value[0] ||
          value[3] <= value[1]
        ) {
          throw new RangeError(
            `${name}Box requires four valid PDF coordinates`,
          );
        }
        this._boxes[name] = [...value];
        if (this._setNativeBox) this._setNativeBox(name, value);
      },
    });
  }

  ["media", "crop", "bleed", "trim", "art"].forEach(definePageBox);
  PDFPage.prototype.getResourcesDictionary = function () {
    if (!this._getNativeResources) {
      throw new Error("PDFPage resources are not active");
    }
    return this._getNativeResources();
  };
  Object.defineProperty(PDFPage.prototype, "rotate", {
    get: function () {
      return this._rotation;
    },
    set: function (value) {
      if (!Number.isInteger(value) || value % 90 !== 0) {
        throw new RangeError("rotate must be a multiple of 90 degrees");
      }
      this._rotation = value;
      if (this._setNativeRotation) this._setNativeRotation(value);
    },
  });
  return {
    PDFTextString,
    PDFDate,
    PDFPage,
    normalizePDFDate,
    textStringValue,
  };
}
