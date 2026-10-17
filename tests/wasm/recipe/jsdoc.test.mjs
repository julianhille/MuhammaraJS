import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsdoc2md from "jsdoc-to-markdown";
import { describeEnd } from "../../support/ends.mjs";

var root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
var wasmRoot = path.join(root, "packages/wasm");
var sharedRecipe = path.join(root, "packages/shared/lib/recipe");
var declarations = readFileSync(path.join(wasmRoot, "index.d.ts"), "utf8");

/**
 * The body of an exported interface in index.d.ts.
 * @param {string} name - The interface name.
 * @returns {string} The text between its braces.
 */
function interfaceBody(name) {
  var start = declarations.indexOf(`export interface ${name} {`);
  assert.notEqual(start, -1, `Missing ${name} declaration`);
  var open = declarations.indexOf("{", start);
  var depth = 0;
  for (var index = open; index < declarations.length; index += 1) {
    if (declarations[index] === "{") depth += 1;
    if (declarations[index] === "}") depth -= 1;
    if (depth === 0) return declarations.slice(open + 1, index);
  }
  throw new Error(`Unclosed ${name} declaration`);
}

/**
 * The method names an interface body declares.
 * @param {string} body - The interface body.
 * @returns {Set<string>} The method names.
 */
function declaredMethods(body) {
  return new Set(
    Array.from(body.matchAll(/^  ([A-Za-z]\w*)[<(]/gm), (match) => match[1]),
  );
}

/**
 * The files the Wasm Recipe is built from: the shared Recipe modules, the
 * Wasm platform and the Wasm recipe modules the platform imports.
 * @returns {string[]} Absolute file paths.
 */
function recipeSources() {
  var platform = path.join(wasmRoot, "lib/recipe.js");
  var imported = Array.from(
    readFileSync(platform, "utf8").matchAll(
      /from "\.\/(recipe\/[\w.-]+\.js)"/g,
    ),
    (match) => path.join(wasmRoot, "lib", match[1]),
  );
  var shared = readdirSync(sharedRecipe)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => path.join(sharedRecipe, file));
  return [platform, ...imported, ...shared];
}

/**
 * The public methods of a Recipe class: instance methods along the prototype
 * chain, and static functions.
 * @param {Function} Recipe - The Recipe class.
 * @returns {{instance: Set<string>, statics: Set<string>}} The method names.
 */
function runtimeMethods(Recipe) {
  var instance = new Set();
  for (
    var prototype = Recipe.prototype;
    prototype && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    Object.entries(Object.getOwnPropertyDescriptors(prototype))
      .filter(
        ([name, descriptor]) =>
          name !== "constructor" &&
          !name.startsWith("_") &&
          typeof descriptor.value === "function",
      )
      .forEach(([name]) => instance.add(name));
  }
  var statics = new Set(
    Object.getOwnPropertyNames(Recipe).filter(
      (name) =>
        !["length", "name", "prototype"].includes(name) &&
        typeof Recipe[name] === "function",
    ),
  );
  return { instance, statics };
}

describeEnd("wasm", "Recipe JSDoc", function (end) {
  it("keeps declarations aligned with the runtime methods", function () {
    var { instance, statics } = runtimeMethods(end.Recipe);
    assert.deepEqual(
      [...instance].sort(),
      [...declaredMethods(interfaceBody("Recipe"))].sort(),
    );
    assert.deepEqual(
      [...statics].sort(),
      [...declaredMethods(interfaceBody("RecipeConstructor"))].sort(),
    );
  });

  it("documents every public instance and static method", function () {
    var docs = recipeSources().flatMap((file) =>
      Array.from(
        readFileSync(file, "utf8").matchAll(/\/\*\*([\s\S]*?)\*\//g),
        (match) => match[1],
      ),
    );
    var documented = new Set();
    docs.forEach((doc) => {
      var name = doc.match(/@name\s+(\w+)/)?.[1];
      var member = doc.match(/@memberof\s+Recipe(#?)/)?.[1];
      if (name && member !== undefined && /@function\b/.test(doc)) {
        documented.add(`${member || "."}${name}`);
      }
    });
    var expected = [
      ...Array.from(
        declaredMethods(interfaceBody("Recipe")),
        (name) => `#${name}`,
      ),
      ...Array.from(
        declaredMethods(interfaceBody("RecipeConstructor")),
        (name) => `.${name}`,
      ),
    ];
    assert.deepEqual(
      expected.filter((method) => !documented.has(method)),
      [],
      "Every declared Recipe method needs matching runtime JSDoc",
    );
  });

  it("renders every public method into the generated Recipe reference", async function () {
    this.timeout(60000);
    var data = await jsdoc2md.getTemplateData({ files: recipeSources() });
    var recipeData = data.filter(
      (item) =>
        (item.kind === "class" && item.name === "Recipe") ||
        (item.memberof === "Recipe" && item.access !== "private"),
    );
    var reference = await jsdoc2md.render({
      data: recipeData,
      template: '{{#class name="Recipe"}}{{>docs}}{{/class}}',
    });
    var expected = [
      ...Array.from(
        declaredMethods(interfaceBody("Recipe")),
        (name) => `Recipe+${name}`,
      ),
      ...Array.from(
        declaredMethods(interfaceBody("RecipeConstructor")),
        (name) => `Recipe.${name}`,
      ),
    ];
    assert.deepEqual(
      expected.filter((anchor) => !reference.includes(`name="${anchor}"`)),
      [],
      "Every declared Recipe method must appear in generated documentation",
    );
    assert.doesNotMatch(reference, /name="Recipe\+_/);
  });

  it("marks underscore-prefixed Recipe methods as private", function () {
    var sources = recipeSources().map((file) => ({
      file: path.relative(root, file),
      text: readFileSync(file, "utf8"),
    }));
    var names = new Set();
    for (
      var prototype = end.Recipe.prototype;
      prototype && prototype !== Object.prototype;
      prototype = Object.getPrototypeOf(prototype)
    ) {
      Object.getOwnPropertyNames(prototype)
        .filter((name) => name.startsWith("_"))
        .forEach((name) => names.add(name));
    }
    var problems = [];
    names.forEach((name) => {
      var declaration = new RegExp(
        `^\\s*(?:export const ${name}\\s*=|${name}\\s*\\([^)]*\\)\\s*\\{)`,
        "m",
      );
      var found = sources.find((source) => declaration.test(source.text));
      if (!found) {
        problems.push(`${name}: no declaration found`);
        return;
      }
      var preceding = found.text.slice(0, found.text.match(declaration).index);
      var start = preceding.lastIndexOf("/**");
      var doc = start === -1 ? "" : preceding.slice(start);
      if (!/^\/\*\*[\s\S]*?\*\/\s*$/.test(doc) || !/@private\b/.test(doc)) {
        problems.push(`${found.file}: ${name}`);
      }
    });
    assert.deepEqual(problems, [], "underscore methods need @private");
  });
});
