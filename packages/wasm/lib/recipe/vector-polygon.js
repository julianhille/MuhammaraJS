export function createPolygonMethods(runtime) {
  return {
    polygon: function (coordinates, options = {}) {
      if (!Array.isArray(coordinates) || coordinates.length < 2)
        throw new TypeError("A polygon needs at least two coordinate pairs");
      this._beginPath(options, coordinates[0][0], coordinates[0][1]);
      this.moveTo(...coordinates[0]);
      coordinates.slice(1).forEach((point) => this.lineTo(...point));
      if (this._pageContext) this._pageContext.h();
      else runtime.call("_muhammara_wasm_recipe_close_path", this._recipe);
      return this._finishPath(options);
    },
  };
}
