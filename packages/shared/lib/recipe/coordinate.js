import { pageRotationMatrix } from "./utils.js";
import { Coordinate } from "../recipe-constants.js";

/**
 * Look up the metadata of a page, or of the active page.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @returns {Object} The page metadata.
 * @throws {TypeError} If there is no such page, for example before createPage().
 */
function pageMetadata(recipe, pageNumber) {
  const metadata = recipe._metadata[pageNumber || recipe.pageNumber];
  if (!metadata) throw recipe.platform.noPageError();
  return metadata;
}

/**
 * Replace `Recipe.Coordinate.CENTER` coordinates with the page center.
 * @private
 * @param {number|"center"} x - The x coordinate.
 * @param {number|"center"} y - The y coordinate.
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @returns {number[]} The numeric [x, y].
 * @throws {TypeError} If no page is active.
 */
export const _centrify = function _centrify(x, y, pageNumber) {
  const { width, height } = pageMetadata(this, pageNumber);
  if (x === Coordinate.CENTER) x = width / 2;
  if (y === Coordinate.CENTER) y = height / 2;

  return [x, y];
};

/**
 * Convert Recipe coordinates (top-left origin, y down) to PDF coordinates
 * (bottom-left origin of the media box, y up).
 * @private
 * @param {number|"center"} x - The Recipe x coordinate.
 * @param {number|"center"} y - The Recipe y coordinate.
 * @param {number} [offsetX=0] - Added to the PDF x coordinate.
 * @param {number} [offsetY=0] - Added to the PDF y coordinate.
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @returns {{nx: number, ny: number}} The PDF coordinates.
 * @throws {TypeError} If no page is active.
 */
export const _calibrateCoordinate = function _calibrateCoordinate(
  x,
  y,
  offsetX = 0,
  offsetY = 0,
  pageNumber,
) {
  pageNumber = pageNumber || this.pageNumber;
  const { height, mediaBox } = pageMetadata(this, pageNumber);
  const startX = mediaBox[0];
  const startY = mediaBox[1];
  [x, y] = this._centrify(x, y, pageNumber);

  const nx = x + offsetX + startX;
  const ny = height - y + offsetY + startY;
  return {
    nx,
    ny,
  };
};

/**
 * Convert Recipe coordinates to PDF coordinates for an annotation, undoing
 * the page rotation so the annotation lands where it appears on screen.
 * @private
 * @param {number|"center"} x - The Recipe x coordinate.
 * @param {number|"center"} y - The Recipe y coordinate.
 * @param {number} [offsetX=0] - Added to the PDF x coordinate.
 * @param {number} [offsetY=0] - Added to the PDF y coordinate.
 * @param {number} pageNumber - The one-based page number.
 * @returns {{nx: number, ny: number}} The PDF coordinates.
 * @throws {TypeError} If the page is unknown.
 */
export const _calibrateCoordinateForAnnots =
  function _calibrateCoordinateForAnnots(
    x,
    y,
    offsetX = 0,
    offsetY = 0,
    pageNumber,
  ) {
    const { nx: tx, ny: ty } = this._calibrateCoordinate(
      x,
      y,
      offsetX,
      offsetY,
      pageNumber,
    );
    // The same transform drawing on a rotated page gets.
    const matrix = pageRotationMatrix(pageMetadata(this, pageNumber));
    if (!matrix) return { nx: tx, ny: ty };
    const [a, b, c, d, e, f] = matrix;
    const nx = a * tx + c * ty + e;
    const ny = b * tx + d * ty + f;
    return {
      nx,
      ny,
    };
  };

/**
 * Convert PDF coordinates back to Recipe coordinates.
 * @private
 * @param {number} x - The PDF x coordinate.
 * @param {number} y - The PDF y coordinate.
 * @param {number} [offsetX=0] - Subtracted from x.
 * @param {number} [offsetY=0] - Subtracted from the Recipe y coordinate.
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @returns {{ox: number, oy: number}} The Recipe coordinates.
 * @throws {TypeError} If no page is active.
 */
export const _reverseCoordinate = function _reverseCoordinate(
  x,
  y,
  offsetX = 0,
  offsetY = 0,
  pageNumber,
) {
  // The inverse of _calibrateCoordinate(), media box origin included.
  const { height, mediaBox } = pageMetadata(this, pageNumber);
  const ox = x - offsetX - mediaBox[0];
  const oy = height - (y - mediaBox[1]) - offsetY;
  return {
    ox,
    oy,
  };
};
