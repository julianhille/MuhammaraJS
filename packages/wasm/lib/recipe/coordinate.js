import { HorizontalAlign, VerticalAlign } from "../value-sets.js";
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
      x === HorizontalAlign.CENTER ? page.width / 2 : x,
      y === VerticalAlign.CENTER ? page.height / 2 : y,
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
    // Work relative to the media box origin, then add it back. The width and
    // height are the ones of the page as shown.
    var u = point.nx - page.offsetX;
    var v = point.ny - page.offsetY;
    var nx = point.nx;
    var ny = point.ny;
    if (page.rotate === 90) {
      nx = page.offsetX + page.height - v;
      ny = page.offsetY + u;
    } else if (page.rotate === 180) {
      nx = page.offsetX + page.width - u;
      ny = page.offsetY + page.height - v;
    } else if (page.rotate === 270) {
      nx = page.offsetX + v;
      ny = page.offsetY + page.width - u;
    }
    return { nx, ny };
  },
};
