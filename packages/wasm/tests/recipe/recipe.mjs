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
