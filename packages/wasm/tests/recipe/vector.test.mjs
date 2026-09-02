// Ports vector behavior from tests/recipe/vector.js, shapes.js, arcs.js, and triangle.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

describe("Recipe vector", function () {
  it("creates vector shapes, transforms, and images", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .info({ title: "Browser Recipe", author: "Muhammara" })
      .custom("TestKey", "TestValue")
      .createPage(595, 842)
      .setPageBox("crop", 10, 10, 585, 832)
      .rotate(90)
      .save()
      .rotateContent(15, 300, 200)
      .lineStyle({ width: 3, cap: 1, join: 1, dash: [6, 3] })
      .opacity(0.5)
      .rectangle(260, 180, 80, 40, { stroke: "#dc2626" })
      .restore()
      .rectangle(20, 20, 100, 50, { fill: "#dbeafe" })
      .rectangle(140, 20, 100, 50, { fill: "#fecaca", borderRadius: 12 })
      .circle(200, 100, 30, { stroke: "#2563eb" })
      .line(20, 200, 300, 200, { stroke: "#111827" })
      .line(
        [
          [20, 220],
          [300, 220],
        ],
        { stroke: "red" },
      )
      .line(
        [
          [20, 240],
          [100, 260],
          [180, 240],
          [260, 260],
        ],
        { stroke: "#7c3aed", lineWidth: 2 },
      )
      .polygon(
        [
          [50, 350],
          [100, 390],
          [150, 350],
        ],
        { fill: "#facc15" },
      )
      .ellipse(250, 370, 40, 20, { stroke: "#16a34a" })
      .arc(350, 370, 30, 0, 270, { stroke: "#9333ea" })
      .pie(400, 370, 30, 20, 220, { fill: "#fb923c" })
      .n_gon(450, 370, 30, 6, { fill: "#f97316" })
      .star(520, 370, 30, { stroke: "#0891b2" })
      .arrow(100, 460, { head: [30, 30], shaft: [80, 12], fill: "#4f46e5" })
      .arrow(300, 460, {
        head: 24,
        shaft: [70, 12],
        double: true,
        stroke: "#0f766e",
      })
      .triangle(400, 480, [60, 70, 80], { fill: "#f43f5e" })
      .triangle(500, 480, [45, 80, 60], {
        traitID: "sas",
        stroke: "#1d4ed8",
      })
      .image("logo", 400, 450, { width: 100 })
      .endPage()
      .endPDF();

    assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.7");
    assert.match(new TextDecoder().decode(pdf), /%%EOF/);
  });
});
