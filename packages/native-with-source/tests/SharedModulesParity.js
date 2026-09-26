var assert = require("chai").assert;
var fs = require("fs");
var path = require("path");

var packages = path.join(__dirname, "..", "..");
var nativeLib = path.join(packages, "native-core", "lib");
var wasmLib = path.join(packages, "wasm", "lib");

/**
 * Read a mirrored module without the parts that differ by module system: the
 * header comment naming its mirror, `require` or `import` lines, and the
 * trailing `module.exports` or `export` block.
 *
 * @param {string} file Module path.
 * @returns {string} Comparable source.
 */
function mirroredSource(file) {
  var source = fs.readFileSync(file, "utf8");
  source = source.slice(source.indexOf("\n\n") + 2);
  source = source.slice(0, source.search(/^(module\.exports = |export \{)/m));
  return source
    .split("\n")
    .filter(function (line) {
      return !/^(var \w+ = require\(.*\)(\.\w+)?;|import .* from ".*";)$/.test(
        line,
      );
    })
    .join("\n");
}

/**
 * Read one top-level function, with its JSDoc, from a module.
 *
 * @param {string} file Module path.
 * @param {string} name Function name.
 * @returns {string} Function source.
 */
function functionSource(file, name) {
  var source = fs.readFileSync(file, "utf8");
  var start = source.indexOf("\nfunction " + name + "(");
  assert.notEqual(start, -1, name + " in " + file);
  start = source.lastIndexOf("/**", start);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}

describe("SharedModulesParity", function () {
  ["content-stream.js", "font-text.js", "glyph-list.js"].forEach(
    function (name) {
      it("keeps " + name + " identical on native and Wasm", function () {
        assert.equal(
          mirroredSource(path.join(wasmLib, name)),
          mirroredSource(path.join(nativeLib, name)),
        );
      });
    },
  );

  ["replaceShownText", "removeTextShowingOperators"].forEach(function (name) {
    it("keeps the Recipe " + name + " identical on both ends", function () {
      assert.equal(
        functionSource(path.join(wasmLib, "recipe", "replace-text.js"), name),
        functionSource(path.join(nativeLib, "recipe", "replaceText.js"), name),
      );
    });
  });
});
