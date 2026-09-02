export function createLineMethods(runtime) {
  return {
    moveTo: function (x, y) {
      var point = this._calibrateCoordinate(x, y);
      this._cursor = { x, y };
      return this._movePdf(point.nx, point.ny);
    },
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
