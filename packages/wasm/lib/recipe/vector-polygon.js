/** Creates Recipe polygon drawing methods. */
export function createPolygonMethods(runtime) {
  return {
    /**
     * Draws a closed polygon through the supplied points.
     *
     * Coordinates use Recipe's top-left origin and require an active page. A
     * link option creates an annotation over the polygon's bounding rectangle.
     *
     * @name polygon
     * @function
     * @memberof Recipe#
     * @param {Array.<Array.<number>>} coordinates - Two or more `[x, y]` coordinate pairs.
     * @param {RecipePathOptions} [options] - Path painting and transformation options.
     * @returns {Recipe} The recipe instance.
     * @throws {TypeError} If fewer than two coordinate pairs are supplied or the color space is unknown.
     * @throws {Error} If no target page is available or an unsupported color is requested.
     */
    polygon: function (coordinates, options = {}) {
      if (!Array.isArray(coordinates) || coordinates.length < 2)
        throw new TypeError("A polygon needs at least two coordinate pairs");
      this._beginPath(options, coordinates[0][0], coordinates[0][1]);
      this.moveTo(...coordinates[0]);
      coordinates.slice(1).forEach((point) => this.lineTo(...point));
      if (this._pageContext) this._pageContext.h();
      else runtime.call("_muhammara_wasm_recipe_close_path", this._recipe);
      var result = this._finishPath(options);
      if (options.link) {
        var xs = coordinates.map((point) => point[0]);
        var ys = coordinates.map((point) => point[1]);
        var left = Math.min(...xs);
        var top = Math.min(...ys);
        this.link(
          options.link,
          left,
          top,
          Math.max(...xs) - left,
          Math.max(...ys) - top,
        );
      }
      return result;
    },
  };
}
