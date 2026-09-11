import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsdoc2md from "jsdoc-to-markdown";
import { createRecipeFactory } from "../../lib/recipe.js";

var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function interfaceBody(declarations, name) {
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

function declaredMethods(body) {
  return new Set(
    Array.from(body.matchAll(/^  ([A-Za-z]\w*)\(/gm), (match) => match[1]),
  );
}

async function recipeSources() {
  var recipeFiles = (await readdir(path.join(packageRoot, "lib/recipe")))
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.join(packageRoot, "lib/recipe", file));
  return [path.join(packageRoot, "lib/recipe.js"), ...recipeFiles];
}

describe("Recipe JSDoc", function () {
  it("keeps declarations aligned with the composed runtime methods", async function () {
    var declarations = await readFile(
      path.join(packageRoot, "index.d.ts"),
      "utf8",
    );
    var Recipe = createRecipeFactory({});
    var runtimeInstance = new Set(
      Object.entries(Object.getOwnPropertyDescriptors(Recipe.prototype))
        .filter(
          ([name, descriptor]) =>
            name !== "constructor" &&
            !name.startsWith("_") &&
            typeof descriptor.value === "function",
        )
        .map(([name]) => name),
    );
    var runtimeStatic = new Set(
      Object.getOwnPropertyNames(Recipe).filter(
        (name) =>
          !["length", "name", "prototype"].includes(name) &&
          typeof Recipe[name] === "function",
      ),
    );
    assert.deepEqual(
      runtimeInstance,
      declaredMethods(interfaceBody(declarations, "Recipe")),
    );
    assert.deepEqual(
      runtimeStatic,
      declaredMethods(interfaceBody(declarations, "RecipeConstructor")),
    );
  });

  it("documents every public instance and static method", async function () {
    var declarations = await readFile(
      path.join(packageRoot, "index.d.ts"),
      "utf8",
    );
    var sources = await Promise.all(
      (await recipeSources()).map((file) => readFile(file, "utf8")),
    );
    var docs = sources.flatMap((source) =>
      Array.from(source.matchAll(/\/\*\*([\s\S]*?)\*\//g), (match) => match[1]),
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
        declaredMethods(interfaceBody(declarations, "Recipe")),
        (name) => `#${name}`,
      ),
      ...Array.from(
        declaredMethods(interfaceBody(declarations, "RecipeConstructor")),
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
    var declarations = await readFile(
      path.join(packageRoot, "index.d.ts"),
      "utf8",
    );
    var data = await jsdoc2md.getTemplateData({ files: await recipeSources() });
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
        declaredMethods(interfaceBody(declarations, "Recipe")),
        (name) => `Recipe+${name}`,
      ),
      ...Array.from(
        declaredMethods(interfaceBody(declarations, "RecipeConstructor")),
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

  it("marks underscore-prefixed Recipe methods as private", async function () {
    for (var file of await recipeSources()) {
      var source = await readFile(file, "utf8");
      var methods = source.matchAll(
        /^\s*(_[A-Za-z]\w*)\s*(?:\([^)]*\)|:\s*(?:async\s+)?(?:function\b|[A-Za-z]\w*\b))/gm,
      );
      for (var method of methods) {
        var preceding = source.slice(0, method.index);
        var doc = preceding.match(/\/\*\*([\s\S]*?)\*\/\s*$/)?.[1];
        assert.match(
          doc || "",
          /@private\b/,
          `${file}: ${method[1]} must be documented as private`,
        );
      }
    }
  });
});
