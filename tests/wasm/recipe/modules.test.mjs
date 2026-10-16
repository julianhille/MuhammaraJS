import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeEnd } from "../../support/ends.mjs";

var root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
var wasmLib = path.join(root, "packages/wasm/lib");
var sharedLib = path.join(root, "packages/shared/lib");

/**
 * Every JavaScript file below a directory.
 * @param {string} directory - The directory.
 * @returns {string[]} Absolute file paths.
 */
function scripts(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    var file = path.join(directory, entry.name);
    if (entry.isDirectory()) return scripts(file);
    return entry.name.endsWith(".js") ? [file] : [];
  });
}

/**
 * The relative modules a file imports, resolved to absolute paths.
 * @param {string} file - The importing file.
 * @returns {string[]} The imported files.
 */
function relativeImports(file) {
  return Array.from(
    readFileSync(file, "utf8").matchAll(/from "(\.{1,2}\/[^"]+)"/g),
    (match) => path.resolve(path.dirname(file), match[1]),
  );
}

describeEnd("wasm", "Recipe modules", function (end) {
  it("builds the Recipe only from browser-safe modules", function () {
    // The shared Recipe is bundled into the browser build: no Node.js
    // built-ins, no require() and no Buffer.
    var offenders = [path.join(wasmLib, "recipe.js"), ...scripts(sharedLib)]
      .map((file) => ({
        file: path.relative(root, file),
        code: readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, ""),
      }))
      .filter(({ code }) =>
        /from "(node:|fs"|path"|os"|url"|crypto")|\brequire\(|\bBuffer\.|\bprocess\./.test(
          code,
        ),
      )
      .map(({ file }) => file);
    assert.deepEqual(offenders, []);
  });

  it("ships no Recipe module the Wasm Recipe does not use", function () {
    // lib/recipe/*.js is read by scripts/generate-reference.mjs, so a module
    // left behind by the shared Recipe would publish stale JSDoc.
    var reachable = new Set();
    var pending = [path.join(wasmLib, "recipe.js")];
    while (pending.length) {
      var file = pending.pop();
      if (reachable.has(file)) continue;
      reachable.add(file);
      pending.push(
        ...relativeImports(file).filter((next) => next.startsWith(wasmLib)),
      );
    }
    var unused = scripts(path.join(wasmLib, "recipe"))
      .filter((file) => !reachable.has(file))
      .map((file) => path.relative(root, file))
      .sort();
    assert.deepEqual(unused, []);
  });

  it("parses permissions statically as every Recipe does", function () {
    ["print", "print, copy", "modify,edit, fillform", "printbest"].forEach(
      (flags) =>
        assert.equal(
          end.Recipe.permission(flags),
          end.newRecipe().permission(flags),
          flags,
        ),
    );
    assert.equal(end.Recipe.permission("print, copy"), 20);
    assert.throws(() => end.Recipe.permission("unknown"), {
      message: "Unknown user access permission (unknown)",
    });
  });
});
