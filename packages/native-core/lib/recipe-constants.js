// Kept for code that requires this file directly; the constants are shared
// with @muhammara/wasm and generated into lib/shared by the build. Source is
// native only.
module.exports = {
  ...require("./shared/recipe-constants.js"),
  Source: require("./Recipe.js").Source,
};
