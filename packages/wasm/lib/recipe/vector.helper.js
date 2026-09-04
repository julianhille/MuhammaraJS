import { colorModel } from "./colors.js";

/** Creates shared Recipe vector drawing helpers. */
export function createVectorHelpers(runtime) {
  function operator(recipe, code, ...values) {
    if (recipe._pageContext) {
      var context = recipe._pageContext;
      if (code === 1) context.B();
      else if (code === 5) context.S();
      else if (code === 6) context.f();
      else if (code === 24) context.g(...values);
      else if (code === 25) context.G(...values);
      else if (code === 26) context.rg(...values);
      else if (code === 27) context.RG(...values);
      else if (code === 28) context.k(...values);
      else if (code === 29) context.K(...values);
      return;
    }
    runtime.call(
      "_muhammara_wasm_recipe_operator",
      recipe._recipe,
      code,
      ...values,
    );
  }
  function setColor(recipe, value, options, stroke) {
    var model = colorModel(recipe, value, options);
    if (model.colorspace === "rgb")
      operator(recipe, stroke ? 27 : 26, ...model.values);
    else if (model.colorspace === "gray")
      operator(recipe, stroke ? 25 : 24, model.values[0]);
    else operator(recipe, stroke ? 29 : 28, ...model.values);
  }
  return {
    _pathOptions: function (options = {}) {
      var opacity =
        options.opacity === undefined
          ? 1
          : Math.max(0, Math.min(1, Number(options.opacity)));
      if (!Number.isFinite(opacity)) opacity = 1;
      var dash =
        Array.isArray(options.dash) && options.dash.every(Number.isFinite)
          ? options.dash
          : [];
      if (dash[0] === 0 && dash[1] === 0) dash = [];
      return {
        width:
          Number(options.lineWidth || options.width) > 0
            ? Number(options.lineWidth || options.width)
            : 2,
        cap: ["butt", "round", "square"].indexOf(options.lineCap),
        join: ["miter", "round", "bevel"].indexOf(options.lineJoin),
        miter: Number.isFinite(options.miterLimit) ? options.miterLimit : 1.414,
        dash,
        phase: Number.isFinite(options.dashPhase) ? options.dashPhase : 0,
        opacity,
      };
    },
    _beginPath: function (options = {}, x = 0, y = 0) {
      var style = this._pathOptions(options);
      this.save();
      if (options.rotation)
        this.rotateContent(
          Number(options.rotation),
          ...(options.rotationOrigin || [x, y]),
        );
      if (options.skewX || options.skewY) {
        this.transform(
          1,
          Math.tan(((Number(options.skewX) || 0) * Math.PI) / 180),
          Math.tan(((Number(options.skewY) || 0) * Math.PI) / 180),
          1,
          0,
          0,
        );
      }
      this.lineStyle({
        width: style.width,
        cap: style.cap < 0 ? 1 : style.cap,
        join: style.join < 0 ? 1 : style.join,
        miterLimit: style.miter,
        dash: style.dash,
        dashPhase: style.phase,
      });
      this.opacity(style.opacity);
    },
    _finishPath: function (options = {}) {
      var fill = options.fill;
      var stroke = options.stroke || options.color || options.colour;
      if (fill !== undefined) setColor(this, fill, options, false);
      if (stroke !== undefined || fill === undefined)
        setColor(this, stroke, options, true);
      if (
        fill !== undefined &&
        (stroke !== undefined || options.color !== undefined)
      )
        operator(this, 1);
      else operator(this, fill !== undefined ? 6 : 5);
      this.restore();
      return this;
    },
  };
}
