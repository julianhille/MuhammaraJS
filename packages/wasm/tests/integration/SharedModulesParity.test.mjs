// Byte-first port of tests/SharedModulesParity.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

var NATIVE_LIB = new URL("../../../native-core/lib/", import.meta.url);
var WASM_LIB = new URL("../../lib/", import.meta.url);

/**
 * Read a mirrored module without the parts that differ by module system: the
 * header comment naming its mirror, `require` or `import` lines, and the
 * trailing `module.exports` or `export` block.
 *
 * @param {URL} file Module URL.
 * @returns {string} Comparable source.
 */
function mirroredSource(file) {
  var source = readFileSync(file, "utf8");
  source = source.slice(source.indexOf("\n\n") + 2);
  source = source.slice(0, source.search(/^(module\.exports = |export \{)/m));
  return source
    .split("\n")
    .filter(
      (line) =>
        !/^(var \w+ = require\(.*\)(\.\w+)?;|import .* from ".*";)$/.test(line),
    )
    .join("\n");
}

/**
 * Read one top-level function, with its JSDoc, from a module.
 *
 * @param {URL} file Module URL.
 * @param {string} name Function name.
 * @returns {string} Function source.
 */
function functionSource(file, name) {
  var source = readFileSync(file, "utf8");
  var start = source.indexOf(`\nfunction ${name}(`);
  assert.notEqual(start, -1, `${name} in ${file}`);
  start = source.lastIndexOf("/**", start);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}

describe("SharedModulesParity", function () {
  for (const name of ["content-stream.js", "font-text.js", "glyph-list.js"]) {
    it(`keeps ${name} identical on native and Wasm`, function () {
      assert.equal(
        mirroredSource(new URL(name, WASM_LIB)),
        mirroredSource(new URL(name, NATIVE_LIB)),
      );
    });
  }

  for (const name of ["replaceShownText", "removeTextShowingOperators"]) {
    it(`keeps the Recipe ${name} identical on both ends`, function () {
      assert.equal(
        functionSource(new URL("recipe/replace-text.js", WASM_LIB), name),
        functionSource(new URL("recipe/replaceText.js", NATIVE_LIB), name),
      );
    });
  }
});
