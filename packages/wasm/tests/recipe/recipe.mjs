import { readFile } from "node:fs/promises";
import { createRecipe } from "../../index.js";

var recipePromise;

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
