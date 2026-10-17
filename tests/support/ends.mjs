// The two ends the shared tests run on. Each end hides what is meant to
// differ, its I/O: native takes paths and Buffers, Wasm takes bytes and
// registered names. A spec describes the behaviour once and runs it on every
// selected end:
//
//   describeEnds("Recipe lineStyle", function (end) {
//     it("writes line style operators", function () {
//       var recipe = end.newRecipe().createPage(100, 100);
//       ...
//       var bytes = recipe.endPage().endPDF();
//     });
//   });
//
// MUHAMMARA_END=native or MUHAMMARA_END=wasm runs one end; both by default.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

var require = createRequire(import.meta.url);
var root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Shared fixtures, also used by the end-specific suites. */
export var MATERIALS = path.join(
  root,
  "packages/native-with-source/tests/TestMaterials",
);
var OUTPUT = path.join(root, "tests/output");
var ARIAL = path.join(MATERIALS, "fonts/arial.ttf");

/**
 * The absolute path of a fixture.
 * @param {string} name - Path below TestMaterials.
 * @returns {string} The path.
 */
export function fixture(name) {
  return path.isAbsolute(name) ? name : path.join(MATERIALS, name);
}

var IMAGE_EXTENSIONS = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  tif: "tiff",
  tiff: "tiff",
};

/**
 * Register Arial for every style on a native Recipe. The fixture has only a
 * regular face; a missing style falls back to Helvetica on native and to the
 * family's regular face on Wasm, so registering all four keeps both ends on
 * Arial.
 * @param {object} recipe - A native Recipe.
 * @returns {object} The recipe.
 */
function withArial(recipe) {
  ["regular", "bold", "italic", "bold-italic"].forEach((style) =>
    recipe.registerFont("arial", ARIAL, style),
  );
  return recipe;
}

/**
 * The native end: the addon from @muhammara/native-with-source.
 * @returns {object} The end.
 */
function nativeEnd() {
  var end = {
    name: "native",
    async load() {
      if (end.muhammara) return;
      end.muhammara = require("@muhammara/native-with-source");
      end.Recipe = end.muhammara.Recipe;
    },
    newRecipe(options = {}) {
      var recipe = new end.Recipe(Buffer.from("new"), undefined, options);
      withArial(recipe);
      return recipe;
    },
    openRecipe(source, options = {}) {
      var bytes =
        typeof source === "string"
          ? readFileSync(fixture(source))
          : Buffer.from(source);
      var recipe = new end.Recipe(bytes, undefined, options);
      withArial(recipe);
      return recipe;
    },
    image: (name) => fixture(name),
    pdf: (name) => fixture(name),
    reader(bytes, options) {
      var stream = new end.muhammara.PDFRStreamForBuffer(Buffer.from(bytes));
      return options
        ? end.muhammara.createReader(stream, options)
        : end.muhammara.createReader(stream);
    },
  };
  return end;
}

/**
 * The Wasm end: the bundle @muhammara/wasm publishes.
 * @returns {object} The end.
 */
function wasmEnd() {
  var registered = new Set();
  var end = {
    name: "wasm",
    async load() {
      if (end.muhammara) return;
      var wasm = await import("@muhammara/wasm");
      end.muhammara = await wasm.createMuhammaraWasm({ recryptWorker: false });
      end.Recipe = await wasm.createRecipe({ recryptWorker: false });
      end.Recipe.registerFont("arial", readFileSync(ARIAL));
    },
    newRecipe(options = {}) {
      return new end.Recipe(options);
    },
    openRecipe(source, options = {}) {
      var bytes =
        typeof source === "string" ? readFileSync(fixture(source)) : source;
      return new end.Recipe(new Uint8Array(bytes), options);
    },
    image(name) {
      if (!registered.has("image:" + name)) {
        var extension =
          IMAGE_EXTENSIONS[path.extname(name).slice(1).toLowerCase()];
        end.Recipe.registerImage(name, readFileSync(fixture(name)), extension);
        registered.add("image:" + name);
      }
      return name;
    },
    pdf(name) {
      if (!registered.has("pdf:" + name)) {
        end.Recipe.registerPdf(name, readFileSync(fixture(name)));
        registered.add("pdf:" + name);
      }
      return name;
    },
    reader: (bytes, options) =>
      end.muhammara.createReader(new Uint8Array(bytes), options),
  };
  return end;
}

var selected = process.env.MUHAMMARA_END || "both";
if (!["native", "wasm", "both"].includes(selected)) {
  throw new Error(
    `MUHAMMARA_END must be native, wasm or both, not ${selected}`,
  );
}

/** The selected ends. */
export var ends = [
  selected !== "wasm" && nativeEnd(),
  selected !== "native" && wasmEnd(),
].filter(Boolean);

/**
 * Describe a suite once per selected end, with that end loaded.
 * @param {string} title - The suite title; the end name is appended.
 * @param {function(object): void} body - Defines the tests for one end.
 * @returns {void}
 */
export function describeEnds(title, body) {
  for (var end of ends) {
    describe(`${title} [${end.name}]`, function () {
      var current = end;
      before(() => current.load());
      body(current);
    });
  }
}

/**
 * Write PDF bytes to tests/output/<end>/<name>.pdf for manual review.
 * @param {object} end - The end that drew them.
 * @param {string} name - The file name without extension.
 * @param {Uint8Array} bytes - The PDF bytes.
 * @returns {string} The written path.
 */
export function writeOutput(end, name, bytes) {
  var dir = path.join(OUTPUT, end.name);
  mkdirSync(dir, { recursive: true });
  var file = path.join(dir, `${name}.pdf`);
  writeFileSync(file, bytes);
  return file;
}

/**
 * Describe a suite for one end only, for behaviour that is meant to differ:
 * paths, streams and Buffers on native; bytes, Blobs and registered assets
 * on Wasm. Skipped when that end is not selected.
 * @param {string} name - "native" or "wasm".
 * @param {string} title - The suite title; the end name is appended.
 * @param {function(object): void} body - Defines the tests.
 * @returns {void}
 */
export function describeEnd(name, title, body) {
  var end = ends.find((candidate) => candidate.name === name);
  if (!end) return;
  describe(`${title} [${name} only]`, function () {
    before(() => end.load());
    body(end);
  });
}
