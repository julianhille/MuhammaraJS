import assert from "node:assert/strict";
import { createShapeMethods } from "../../lib/recipe/shapes.js";

function recorder() {
  var calls = { polygons: [], circles: [], lines: [], text: [] };
  return {
    calls,
    polygon(points, options) {
      calls.polygons.push({ points, options });
      return this;
    },
    circle(...args) {
      calls.circles.push(args);
      return this;
    },
    line(...args) {
      calls.lines.push(args);
      return this;
    },
    text(...args) {
      calls.text.push(args);
      return this;
    },
  };
}

function close(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `${actual} is not ${expected}`,
  );
}

describe("Recipe shape parity", function () {
  it("uses native odd and even star traversals", function () {
    var shapes = createShapeMethods();
    var recipe = recorder();
    shapes.star.call(recipe, 0, 0, 10, 5, { fill: "#000" });
    assert.equal(recipe.calls.polygons.length, 1);
    assert.deepEqual(
      recipe.calls.polygons[0].points.map((point) => Math.round(point[1])),
      [-10, 8, -3, -3, 8],
    );

    recipe = recorder();
    shapes.star.call(recipe, 0, 0, 10, 6, { fill: "#000", rotation: 30 });
    assert.equal(
      recipe.calls.polygons.length,
      2,
      "six-point stars are two rotated triangles",
    );
    assert.equal(recipe.calls.polygons[0].options.rotation, 30);
    assert.equal(recipe.calls.polygons[1].options.rotation, 90);

    recipe = recorder();
    shapes.star.call(recipe, 0, 0, 10, 8, { fill: "#000" });
    assert.equal(recipe.calls.polygons.length, 1);
    assert.equal(recipe.calls.polygons[0].points.length, 8);
  });

  it("anchors arrows at their head or tail and retains detailed debug geometry", function () {
    var shapes = createShapeMethods();
    var recipe = recorder();
    shapes.arrow.call(recipe, 100, 50, {
      head: [20, 10],
      shaft: [30, 4],
      at: "head",
      rotation: 45,
      debug: 2,
    });
    var polygon = recipe.calls.polygons[0];
    assert.deepEqual(polygon.points[0], [100, 50]);
    assert.deepEqual(polygon.options.rotationOrigin, [100, 50]);
    assert.deepEqual(recipe.calls.circles[0], [100, 50, 2, { color: "red" }]);
    assert.equal(recipe.calls.text.length, 8);
    assert.equal(recipe.calls.circles.length, 9);

    recipe = recorder();
    shapes.arrow.call(recipe, 100, 50, {
      head: [20, 10],
      shaft: [30, 4],
      at: "tail",
    });
    assert.deepEqual(recipe.calls.polygons[0].points[3], [100, 52]);
  });

  it("positions and flips triangles at every native reference point", function () {
    var shapes = createShapeMethods();
    ["a", "b", "c", "centroid", "circumcenter", "incenter"].forEach(
      (position) => {
        var recipe = recorder();
        shapes.triangle.call(recipe, 100, 100, [30, 40, 50], { position });
        var vertices = recipe.calls.polygons[0].points;
        if (position === "a") assert.deepEqual(vertices[2], [100, 100]);
        else if (position === "b") assert.deepEqual(vertices[0], [100, 100]);
        else if (position === "c") assert.deepEqual(vertices[1], [100, 100]);
        else {
          var x = vertices.reduce((sum, point) => sum + point[0], 0) / 3;
          var y = vertices.reduce((sum, point) => sum + point[1], 0) / 3;
          if (position === "centroid") {
            close(x, 100);
            close(y, 100);
          }
        }
      },
    );
    var recipe = recorder();
    shapes.triangle.call(recipe, 100, 100, [30, 40, 50], {
      flipX: true,
      flipY: true,
      debug: true,
    });
    assert.deepEqual(recipe.calls.polygons[0].points[0], [100, 100]);
    assert.equal(
      recipe.calls.circles.length,
      2,
      "debug includes anchor and incircle",
    );
    assert.equal(
      recipe.calls.text.length,
      6,
      "debug labels vertices and sides",
    );
  });
});
