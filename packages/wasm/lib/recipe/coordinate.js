import {
  RecipeHorizontalAlignment,
  RecipeVerticalAlignment,
} from "../value-sets.js";
/** Recipe coordinate conversion methods. */
export var coordinateMethods = {
  /**
   * Resolves centered Recipe coordinates against the target page.
   * @private
   * @param {number|string} x - x, or `center`.
   * @param {number|string} y - y, or `center`.
   * @param {number} [pageNumber] - One-based page; the active page by default.
   * @returns {Array} `[x, y]` with `center` replaced.
   */
  _centrify: function (x, y, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) return [x, y];
    return [
      x === RecipeHorizontalAlignment.CENTER ? page.width / 2 : x,
      y === RecipeVerticalAlignment.CENTER ? page.height / 2 : y,
    ];
  },

  /**
   * Converts top-left Recipe coordinates to bottom-left PDF coordinates.
   *
   * @private
   * @param {number|string} x - Recipe x, or `center`.
   * @param {number|string} y - Recipe y, or `center`.
   * @param {number} [offsetX=0] - Horizontal offset.
   * @param {number} [offsetY=0] - Vertical offset.
   * @param {number} [pageNumber] - One-based page; the active page by default.
   * @returns {{nx: number, ny: number}} Coordinates with the Y axis flipped.
   * @throws {Error} When no target page is available.
   */
  _calibrateCoordinate: function (x, y, offsetX = 0, offsetY = 0, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) throw new Error("A page is required for coordinates");
    [x, y] = this._centrify(x, y, pageNumber);
    return {
      nx: x + offsetX + page.offsetX,
      ny: page.height - y + offsetY + page.offsetY,
    };
  },

  /**
   * Converts bottom-left PDF coordinates to top-left Recipe coordinates.
   * @private
   * @param {number} x - PDF x.
   * @param {number} y - PDF y.
   * @param {number} [offsetX=0] - Horizontal offset.
   * @param {number} [offsetY=0] - Vertical offset.
   * @param {number} [pageNumber] - One-based page; the active page by default.
   * @returns {{ox: number, oy: number}} Recipe coordinates.
   * @throws {Error} When no target page is available.
   */
  _reverseCoordinate: function (x, y, offsetX = 0, offsetY = 0, pageNumber) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    if (!page) throw new Error("A page is required for coordinates");
    return {
      ox: x - offsetX - page.offsetX,
      oy: page.height - (y - page.offsetY) - offsetY,
    };
  },

  /**
   * Converts Recipe coordinates for annotations on rotated pages.
   * @private
   * @param {number} x - Recipe x.
   * @param {number} y - Recipe y.
   * @param {number} [offsetX=0] - Horizontal offset.
   * @param {number} [offsetY=0] - Vertical offset.
   * @param {number} [pageNumber] - One-based page; the active page by default.
   * @returns {{nx: number, ny: number}} PDF coordinates.
   * @throws {Error} When no target page is available.
   */
  _calibrateCoordinateForAnnots: function (
    x,
    y,
    offsetX = 0,
    offsetY = 0,
    pageNumber,
  ) {
    var page = this.pageInfo(
      pageNumber || this._activePageNumber || this._pages.length,
    );
    var point = this._calibrateCoordinate(x, y, offsetX, offsetY, pageNumber);
    var nx = point.nx;
    var ny = point.ny;
    if (page.rotate === 90) {
      nx = page.height - page.offsetX - point.ny;
      ny = page.offsetY + point.nx;
    } else if (page.rotate === 180) {
      nx = page.width - point.nx;
      ny = page.height - point.ny;
    } else if (page.rotate === 270) {
      nx = page.offsetX + point.ny;
      ny = page.width - page.offsetY - point.nx;
    }
    return { nx, ny };
  },
};
