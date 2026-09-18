/** Creates Recipe line and path methods. */
export function createLineMethods(runtime) {
  return {
    /**
     * Moves the current path position without drawing.
     *
     * Coordinates use Recipe's top-left origin and require an active page.
     *
     * @name moveTo
     * @function
     * @memberof Recipe#
     * @param {number} x - The horizontal coordinate in points.
     * @param {number} y - The vertical coordinate in points.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available.
     */
    moveTo: function (x, y) {
      var point = this._calibrateCoordinate(x, y);
      this._cursor = { x, y };
      return this._movePdf(point.nx, point.ny);
    },
    /**
     * Adds a line from the current path position to a point.
     *
     * Coordinates use Recipe's top-left origin and require an active page. If
     * options are supplied, the line is painted immediately; otherwise it is
     * appended to the current path. The current path position becomes `(x, y)`.
     *
     * @name lineTo
     * @function
     * @memberof Recipe#
     * @param {number} x - The destination horizontal coordinate in points.
     * @param {number} y - The destination vertical coordinate in points.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     * @throws {TypeError} If the requested color space is unknown.
     */
    lineTo: function (x, y, options) {
      var point = this._calibrateCoordinate(x, y);
      this._cursor = { x, y };
      if (options) {
        this._beginPath(options);
        this._linePdf(point.nx, point.ny);
        return this._finishPath(options);
      }
      return this._linePdf(point.nx, point.ny);
    },
    /**
     * Draws a line through two or more points.
     *
     * Pass either an array of coordinate pairs followed by options, or four
     * coordinates followed by options. Coordinates use Recipe's top-left
     * origin and require an active page. Lines are always stroked, never filled.
     *
     * @name line
     * @function
     * @memberof Recipe#
     * @param {number|Array.<Array.<number>>} startX - The start X coordinate, or all coordinate pairs.
     * @param {number|RecipePathOptions} startY - The start Y coordinate, or options for the array form.
     * @param {number} [endX] - The end X coordinate in the numeric form.
     * @param {number} [endY] - The end Y coordinate in the numeric form.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {TypeError} If fewer than two coordinate pairs are supplied or the color space is unknown.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     */
    line: function (startX, startY, endX, endY, options = {}) {
      var points = Array.isArray(startX)
        ? startX
        : [
            [startX, startY],
            [endX, endY],
          ];
      options = Array.isArray(startX) ? startY || {} : options;
      if (points.length < 2)
        throw new TypeError("A line needs at least two coordinate pairs");
      this._beginPath(options, points[0][0], points[0][1]);
      this.moveTo(...points[0]);
      points.slice(1).forEach((point) => this.lineTo(...point));
      return this._finishPath({ ...options, fill: undefined });
    },
  };
}
