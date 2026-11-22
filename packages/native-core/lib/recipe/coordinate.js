const { Coordinate } = require("../recipe-constants");

/**
 * Look up the metadata of a page, or of the active page.
 * @private
 * @param {Recipe} recipe - The recipe instance.
 * @param {number} [pageNumber] - The one-based page number; defaults to the active page.
 * @returns {Object} The page metadata.
 * @throws {TypeError} If there is no such page, for example before createPage().
 */
function pageMetadata(recipe, pageNumber) {
  const metadata = recipe.metadata[pageNumber || recipe.pageNumber];
  if (!metadata) {
    throw new TypeError(
      "No page is active; call createPage() or editPage() first",
    );
  }
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
exports._centrify = function _centrify(x, y, pageNumber) {
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
exports._calibrateCoordinate = function _calibrateCoordinate(
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
exports._calibrateCoordinateForAnnots = function _calibrateCoordinateForAnnots(
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
  const { width, height, rotate, mediaBox } = pageMetadata(this, pageNumber);
  const startX = mediaBox[0];
  const startY = mediaBox[1];
  // The point relative to the media box origin. The width and height are the
  // ones of the page as shown, so a 270 degree page needs neither.
  const u = tx - startX;
  const v = ty - startY;
  switch (rotate) {
    case 90:
      return { nx: startX + height - v, ny: startY + u };
    case 180:
      return { nx: startX + width - u, ny: startY + height - v };
    case 270:
      return { nx: startX + v, ny: startY + width - u };
    default:
      return { nx: tx, ny: ty };
  }
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
exports._reverseCoordinate = function _reverseCoordinate(
  x,
  y,
  offsetX = 0,
  offsetY = 0,
  pageNumber,
) {
  const { height } = pageMetadata(this, pageNumber);
  const ox = x - offsetX;
  const oy = height - y - offsetY;
  return {
    ox,
    oy,
  };
};
