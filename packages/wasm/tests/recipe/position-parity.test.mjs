import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

// Expected values were read from @muhammara/native-with-source on the same
// calls: `position` is the path cursor, written only by moveTo and lineTo,
// while text(), movedown() and table() advance a separate text cursor.
describe("Recipe position parity", function () {
  it("tracks only moveTo and lineTo", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(600, 800);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.moveTo(11, 22);
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    recipe.lineTo(33, 44);
    assert.deepEqual(recipe.position, { x: 33, y: 44 });
    recipe.text("x", 55, 66, { font: "arial" });
    assert.deepEqual(
      recipe.position,
      { x: 33, y: 44 },
      "text() leaves the path position alone",
    );
    recipe.movedown(2);
    assert.deepEqual(
      recipe.position,
      { x: 33, y: 44 },
      "movedown() leaves the path position alone",
    );
    recipe.moveTo(77, 88);
    assert.deepEqual(recipe.position, { x: 77, y: 88 });
    recipe.lineTo(99, 110, { color: "#000000" });
    assert.deepEqual(
      recipe.position,
      { x: 99, y: 110 },
      "a painted lineTo moves the path position like an appended one",
    );
    recipe.endPage().endPDF();
  });

  it("keeps the text cursor flowing while the path position rests", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(600, 800);
    recipe.moveTo(11, 22);
    recipe.text("first", 50, 60, { font: "arial", size: 10 });
    var [cursorX, cursorY] = recipe.movedown(0, true);
    assert.equal(cursorX, 50, "the text cursor keeps the text box origin");
    assert.ok(cursorY > 60, "the text cursor sits below the drawn line");
    var lineHeight = cursorY - 60;
    var [movedX, movedY] = recipe.movedown(2, true);
    assert.equal(movedX, 50);
    assert.ok(
      Math.abs(movedY - (cursorY + 2 * lineHeight)) < 0.01,
      "movedown advances whole line heights",
    );
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    recipe.endPage().endPDF();
  });

  it("leaves the path position where the table found it", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(600, 800);
    recipe.moveTo(11, 22);
    recipe.table(30, 40, [{ a: "one", b: "two" }], {
      columns: [
        { text: "a", name: "a", width: 80 },
        { text: "b", name: "b", width: 80 },
      ],
    });
    assert.deepEqual(recipe.position, { x: 11, y: 22 });
    assert.ok(
      recipe.movedown(0, true)[1] > 40,
      "the text cursor drops below the table",
    );
    recipe.endPage().endPDF();
  });

  it("restarts each new page at the origin", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe().createPage(600, 800);
    recipe.moveTo(11, 22).endPage();
    // Node Recipe ends createPage with moveTo(0, 0).
    recipe.createPage(600, 800);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.endPage().endPDF();
  });
});
