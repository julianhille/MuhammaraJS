import { writableInfoKeys } from "../recipe-info.js";

/** Creates Recipe document-information methods. */
export function createInfoMethods({ call, withString }) {
  function pdfDate(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset < 0 ? "-" : "+";
    var pad = (number) => String(Math.abs(number)).padStart(2, "0");
    return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${sign}${pad(Math.trunc(offset / 60))}'${pad(offset % 60)}'`;
  }

  return {
    /**
     * Gets the document information dictionary or sets information entries.
     * Array values are written as comma-and-space-separated text; custom key
     * spelling is preserved.
     *
     * @name info
     * @function
     * @memberof Recipe#
     * @param {Record<string, unknown>} [options] Information entries to set.
     * Omit this argument to return a copy of the current information.
     * @returns {Recipe|Record<string, unknown>} The Recipe instance when
     * setting entries, otherwise a copy of the current information.
     */
    info: function (options = {}) {
      if (arguments.length === 0) return { ...this._info };
      Object.entries(options).forEach(([key, value]) => {
        var text = Array.isArray(value) ? value.join(", ") : String(value);
        if (this._sourceMode) {
          var info = this.writer.getDocumentContext().getInfoDictionary();
          if (writableInfoKeys.includes(key)) {
            info[key] = text;
          } else {
            info.addAdditionalInfoEntry(key, text);
          }
          this._info[key] = Array.isArray(value) ? value.slice() : value;
          return;
        }
        withString(key, (keyPointer) =>
          withString(text, (valuePointer) => {
            call(
              "_muhammara_wasm_recipe_set_info",
              this._recipe,
              keyPointer,
              valuePointer,
            );
          }),
        );
        this._info[key] = Array.isArray(value) ? value.slice() : value;
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
     * @param {unknown} value Value converted to text for the PDF.
     * @returns {Recipe} The Recipe instance.
     */
    custom: function (key, value) {
      return this.info({ [key]: value });
    },

    /**
     * Writes canonical creation and modification information.
     *
     * @name _writeCanonicalInfo
     * @function
     * @memberof Recipe#
     * @private
     */
    _writeCanonicalInfo: function () {
      var info = this._sourceMode
        ? this.writer.getDocumentContext().getInfoDictionary()
        : null;
      var now = new Date();
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
        if (this._isNewPDF) info.setCreationDate(now);
        info.setModDate(now);
        info.producer =
          "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)";
        info.creator =
          "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)";
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
        [
          "producer",
          "MuhammaraJS (https://github.com/julianhille/MuhammaraJS)",
        ],
        [
          "creator",
          "Muhammara-Recipe (https://github.com/julianhille/MuhammaraJS)",
        ],
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
  };
}
