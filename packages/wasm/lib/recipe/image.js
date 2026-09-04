/** Creates Recipe image placement methods. */
export function createImageMethods(runtime) {
  function placement(recipe, path, x, y, options) {
    var dimensions = recipe._imageDimensions(path);
    var width = options.width || dimensions.width * (options.scale || 1);
    var height = options.height || dimensions.height * (options.scale || 1);
    if (options.width && !options.height)
      height = (width * dimensions.height) / dimensions.width;
    else if (!options.width && options.height)
      width = (height * dimensions.width) / dimensions.height;
    else if (
      options.width &&
      options.height &&
      options.keepAspectRatio !== false
    ) {
      var ratio = dimensions.width / dimensions.height;
      if (width / height > ratio) width = height * ratio;
      else height = width / ratio;
    }
    var align = String(options.align || "").split(" ");
    if (align[0] === "center") x -= width / 2;
    else if (align[0] === "right") x += width / 2;
    if (align[1] === "center") y -= height / 2;
    else if (align[1] === "bottom") y += height / 2;
    return { x, y, width, height };
  }
  return {
    image: function (name, x, y, options = {}) {
      var path = runtime.images.get(name);
      if (!path) throw new Error(`Unknown image: ${name}`);
      var box = placement(this, path, x, y, options);
      this.save();
      if (options.rotation)
        this.rotateContent(
          Number(options.rotation),
          ...(options.rotationOrigin || [x, y]),
        );
      if (options.skewX || options.skewY)
        this.transform(
          1,
          Math.tan(((Number(options.skewX) || 0) * Math.PI) / 180),
          Math.tan(((Number(options.skewY) || 0) * Math.PI) / 180),
          1,
          0,
          0,
        );
      if (options.opacity !== undefined)
        this.opacity(Math.max(0, Math.min(1, Number(options.opacity))));
      var point = this._calibrateCoordinate(box.x, box.y, 0, -box.height);
      if (this._sourceMode) {
        this._pageContext.drawImage(
          point.nx,
          point.ny,
          runtime.module.FS.readFile(path),
          {
            transformation: {
              width: box.width,
              height: box.height,
              proportional: options.keepAspectRatio !== false,
              fit: "always",
            },
          },
        );
        this.restore();
        return this;
      }
      runtime.withString(path, (pointer) => {
        var matrix = runtime.module._malloc(48);
        try {
          runtime.module.HEAPF64.set([1, 0, 0, 1, 0, 0], matrix >>> 3);
          runtime.call(
            "_muhammara_wasm_writer_draw_image",
            this._recipe,
            point.nx,
            point.ny,
            pointer,
            options.index || 0,
            1,
            matrix,
            box.width,
            box.height,
            options.keepAspectRatio === false ? 0 : 1,
            0,
          );
        } finally {
          runtime.module._free(matrix);
        }
      });
      this.restore();
      return this;
    },
    _imageDimensions: function (path) {
      if (this._sourceMode) {
        return this.writer.getImageDimensions(runtime.module.FS.readFile(path));
      }
      var result = runtime.module._malloc(16);
      try {
        return runtime.withString(path, (pointer) => {
          runtime.call(
            "_muhammara_wasm_recipe_image_dimensions",
            this._recipe,
            pointer,
            result,
            result + 8,
          );
          return {
            width: runtime.module.HEAPF64[result >>> 3],
            height: runtime.module.HEAPF64[(result + 8) >>> 3],
          };
        });
      } finally {
        runtime.module._free(result);
      }
    },
  };
}
