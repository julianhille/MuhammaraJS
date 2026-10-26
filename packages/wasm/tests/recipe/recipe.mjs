import { readFile } from "node:fs/promises";
import { createRecipe } from "../../index.js";

var recipePromise;

/**
 * The Recipe class of one shared factory, with the arial font and the logo
 * image registered. Every call returns the same class.
 * @returns {Promise<Function>} The Recipe class.
 */
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
