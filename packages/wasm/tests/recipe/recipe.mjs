import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRecipe } from "../../index.js";

var recipePromise;

/**
 * Reads a PDF fixture shared with the native Recipe tests.
 * @param {string} name - The fixture file name without extension.
 * @returns {Uint8Array} The fixture bytes.
 */
export function recipeFixture(name) {
  return new Uint8Array(
    readFileSync(
      new URL(
        `../../../native-with-source/tests/TestMaterials/recipe/${name}.pdf`,
        import.meta.url,
      ),
    ),
  );
}

/**
 * Creates a Recipe class on its own Wasm instance and counts every reader
 * created there, over any bytes. The modifier's parser is not counted.
 * @returns {Promise<{Recipe: Function, readers: {created: number}}>} Recipe
 *   and the number of readers created.
 */
export async function createReaderCountingRecipe() {
  var module;
  var Recipe = await createRecipe({
    /**
     * Records the Emscripten module, which the public API does not expose.
     * @returns {void}
     */
    onRuntimeInitialized() {
      module = this;
    },
  });
  var readers = { created: 0 };
  [
    "_muhammara_wasm_reader_create",
    "_muhammara_wasm_reader_create_with_password",
  ].forEach((name) => {
    // An Emscripten export replaces itself on its first call, so the
    // replacement is kept behind the counting wrapper.
    var target = module[name];
    /**
     * Creates a reader through the current export and counts it.
     * @param {...*} args - Arguments of the reader export.
     * @returns {number} The reader handle, 0 when none was created.
     */
    var wrapper = (...args) => {
      var reader = target(...args);
      if (reader) readers.created += 1;
      return reader;
    };
    Object.defineProperty(module, name, {
      configurable: true,
      get: () => wrapper,
      set: (value) => {
        target = value;
      },
    });
  });
  return { Recipe, readers };
}

export function getRecipe() {
  if (!recipePromise) {
    recipePromise = createRecipe().then(async (Recipe) => {
      Recipe.registerFont(
        "arial",
        new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
      );
      Recipe.registerImage(
        "logo",
        new Uint8Array(
          await readFile("tests/TestMaterials/images/png/pnglogo-grr.png"),
        ),
        "png",
      );
      return Recipe;
    });
  }
  return recipePromise;
}
