import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd } from "../../support/ends.mjs";

var require = createRequire(import.meta.url);
var lib = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/native-core/lib",
);

/**
 * Every JavaScript file below a directory, except the generated lib/shared.
 * @param {string} directory - The directory.
 * @returns {string[]} Absolute file paths.
 */
function scripts(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    var file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return file === path.join(lib, "shared") ? [] : scripts(file);
    }
    return entry.name.endsWith(".js") ? [file] : [];
  });
}

describeEnd("native", "Recipe modules", function () {
  it("keeps every lib/ module requirable for code that requires it directly", function () {
    var files = scripts(lib);
    assert.ok(files.length > 0);
    // muhammara.js, and index.js through it, refuse to load the addon
    // outside a native package, as they always have.
    var internals = ["index.js", "muhammara.js"];
    files.forEach((file) => {
      var name = path.relative(lib, file);
      if (internals.includes(name)) {
        assert.throws(() => require(file), /instead of native-core internals/);
      } else {
        assert.doesNotThrow(() => require(file), name);
      }
    });
  });
});
