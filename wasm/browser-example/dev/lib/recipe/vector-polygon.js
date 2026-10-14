/**
 * Creates Recipe polygon drawing methods.
 * @param {object} runtime - Module and export helpers.
 * @returns {object} Methods mixed into Recipe.prototype.
 */
export function createPolygonMethods(runtime) {
  return {
    /**
     * Draws a closed polygon through the supplied points.
     *
     * Coordinates use Recipe's top-left origin and require an active page. A
     * link option creates an annotation over the polygon's bounding rectangle.
     * Without `rotationOrigin`, `rotation` turns the polygon around the center
     * of its bounding box, as native does.
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
      // null options act like omitted options.
      if (options === null) options = {};
      if (!Array.isArray(coordinates) || coordinates.length < 2)
        throw new TypeError("A polygon needs at least two coordinate pairs");
      var xs = coordinates.map((point) => point[0]);
      var ys = coordinates.map((point) => point[1]);
      // As in native, the shape turns around the center of its bounding box.
      this._beginPath(
        options,
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      );
      this.moveTo(...coordinates[0]);
      coordinates.slice(1).forEach((point) => this.lineTo(...point));
      if (this._pageContext) this._pageContext.h();
      else runtime.call("_muhammara_wasm_recipe_close_path", this._recipe);
      var result = this._finishPath(options);
      if (options.link) {
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
