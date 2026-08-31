function radians(angle) {
  return (angle * Math.PI) / 180;
}

function pointAt(x, y, length, angle) {
  return [
    x + length * Math.cos(radians(angle)),
    y + length * Math.sin(radians(angle)),
  ];
}

function drawingLineWidth(options) {
  return options.stroke || options.color || !options.fill
    ? options.lineWidth || options.width || 2
    : 0;
}

function ngon(sides, x, y, radius, options = {}) {
  var angle = 360 / sides;
  var start = sides % 2 ? 270 : 270 - angle / 2;
  var drawingRadius = radius - drawingLineWidth(options) / 2;
  return Array.from({ length: sides }, (_, index) =>
    pointAt(x, y, drawingRadius, start + angle * index),
  );
}

function polygonOptions(options, x, y) {
  var result = { ...options };
  // Native polygon bounding-box compensation makes the shape's true center the
  // default rotation origin. The direct Wasm path needs that origin explicitly.
  if (result.rotation && !result.rotationOrigin) result.rotationOrigin = [x, y];
  return result;
}

function starPath(vertices) {
  var interval = Math.floor(vertices.length / 2);
  return vertices.map(
    (_, index) => vertices[(index * interval) % vertices.length],
  );
}

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function triangleGeometry(x, y, traitID, traits) {
  var a, b, c;
  var vertices;
  if (traitID === "vtx") {
    vertices = [traits[0], traits[1], traits[2]];
    a = distance(vertices[0], vertices[1]);
    b = distance(vertices[2], vertices[1]);
    c = distance(vertices[2], vertices[0]);
  } else {
    if (traitID === "sss") [a, b, c] = traits;
    else if (traitID === "sas") {
      [a, , b] = traits;
      c = Math.sqrt(a ** 2 + b ** 2 - 2 * a * b * Math.cos(radians(traits[1])));
    } else if (traitID === "asa") {
      var angleC = 180 - traits[0] - traits[2];
      if (angleC <= 0)
        throw new Error(
          "Not a valid triangle angle specification (sum of 2 angles must less than 180)",
        );
      c = traits[1];
      a = (c * Math.sin(radians(traits[2]))) / Math.sin(radians(angleC));
      b = (c * Math.sin(radians(traits[0]))) / Math.sin(radians(angleC));
    } else throw new Error(`Unhandled trait identification ${traitID}`);
    if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a)
      throw new Error(
        "Not a valid triangle inequality (sum of 2 shortest sides must be greater than third side",
      );
    var angleB = Math.acos((a * a + c * c - b * b) / (2 * a * c));
    vertices = [
      [x, y],
      pointAt(x, y, a, -angleB * (180 / Math.PI)),
      [x + c, y],
    ];
  }
  return { vertices, a, b, c };
}

function centerForTriangle(vertices, sides) {
  var B = vertices[0],
    C = vertices[1],
    A = vertices[2];
  var perimeter = sides.a + sides.b + sides.c;
  var area = Math.abs(
    (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])) / 2,
  );
  var centroid = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  var denominator =
    2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  var circumcenter =
    denominator === 0
      ? centroid
      : [
          ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) +
            (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) +
            (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) /
            denominator,
          ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) +
            (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) +
            (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) /
            denominator,
        ];
  var incenter = [
    (sides.a * A[0] + sides.b * B[0] + sides.c * C[0]) / perimeter,
    (sides.a * A[1] + sides.b * B[1] + sides.c * C[1]) / perimeter,
  ];
  return {
    centroid,
    circumcenter,
    circumradius: distance(circumcenter, A),
    incenter,
    inradius: (2 * area) / perimeter,
  };
}

function translated(vertices, dx, dy) {
  return vertices.map((point) => [point[0] + dx, point[1] + dy]);
}

function flipped(vertices, x, y, flipX, flipY) {
  return vertices.map((point) => [
    flipY ? 2 * x - point[0] : point[0],
    flipX ? 2 * y - point[1] : point[1],
  ]);
}

function rotated(vertices, x, y, angle) {
  if (!angle) return vertices;
  var cosine = Math.cos(radians(angle));
  var sine = Math.sin(radians(angle));
  return vertices.map((point) => {
    var dx = point[0] - x;
    var dy = point[1] - y;
    return [dx * cosine - dy * sine + x, dx * sine + dy * cosine + y];
  });
}

function extend(first, second, length) {
  var span = distance(first, second);
  return [
    second[0] + ((second[0] - first[0]) * length) / span,
    second[1] + ((second[1] - first[1]) * length) / span,
  ];
}

function debugTriangle(recipe, x, y, vertices, sides, position, options) {
  var centers = centerForTriangle(vertices, sides);
  recipe.circle(x, y, 2, { color: "red", width: 0.5 });
  if (position === "circumcenter")
    recipe.circle(x, y, centers.circumradius, { color: "green", width: 0.5 });
  if (position === "incenter")
    recipe.circle(x, y, centers.inradius, { color: "green", width: 0.5 });
  if (position === "centroid") {
    var B = vertices[0],
      C = vertices[1],
      A = vertices[2];
    [
      [A, B, C],
      [B, A, C],
      [C, A, B],
    ].forEach(([vertex, first, second]) =>
      recipe.line(
        [vertex, [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]],
        { color: "green", width: 0.5 },
      ),
    );
  }
  recipe.circle(centers.incenter[0], centers.incenter[1], centers.inradius, {
    color: "green",
    width: 0.5,
  });
  [
    ["A", vertices[2]],
    ["B", vertices[0]],
    ["C", vertices[1]],
  ].forEach(([label, vertex]) => {
    var point = extend(centers.incenter, vertex, 10);
    return recipe.text(label, point[0] - 5, point[1] - 5, {
      color: "#a10439",
      size: 12,
      font: options.font,
    });
  });
  [
    ["a", vertices[0], vertices[1]],
    ["b", vertices[2], vertices[1]],
    ["c", vertices[2], vertices[0]],
  ].forEach(([label, first, second]) => {
    var point = extend(first, second, 10);
    return recipe.text(label, point[0] - 3, point[1] - 5, {
      size: 10,
      font: options.font,
    });
  });
}

export function createShapeMethods() {
  return {
    n_gon: function (cx, cy, radius, sides = 3, options = {}) {
      if (typeof sides === "object") [options, sides] = [sides, 3];
      sides = Math.max(3, Math.floor(sides));
      var vertices = ngon(sides, cx, cy, radius, options);
      var drawOptions = polygonOptions(options, cx, cy);
      if (options.rotationVertice)
        drawOptions.rotationOrigin =
          vertices[(options.rotationVertice - 1) % sides];
      this.polygon(vertices, drawOptions);
      if (options.debug) {
        this.circle(cx, cy, radius, { width: 1, stroke: "#00ff00" });
        this.circle(cx, cy, 2, { fill: "#ff0000" });
      }
      return this;
    },
    star: function (cx, cy, radius, points = 5, options = {}) {
      if (typeof points === "object") [options, points] = [points, 5];
      points = Math.max(5, Math.floor(points));
      var drawOptions = polygonOptions(options, cx, cy);
      if (points % 2)
        this.polygon(
          starPath(ngon(points, cx, cy, radius, options)),
          drawOptions,
        );
      else {
        var halfPoints = points / 2;
        var userRotation = options.rotation || 0;
        if (halfPoints % 2) {
          var path =
            halfPoints === 3
              ? ngon(halfPoints, cx, cy, radius, options)
              : starPath(ngon(halfPoints, cx, cy, radius, options));
          this.polygon(
            path,
            polygonOptions({ ...options, rotation: userRotation }, cx, cy),
          );
          drawOptions = polygonOptions(
            { ...options, rotation: userRotation + 360 / points },
            cx,
            cy,
          );
          this.polygon(path, drawOptions);
        } else {
          var vertices = ngon(points, cx, cy, radius, { fill: true });
          var interval = halfPoints - 1;
          var offset = -1;
          var path = [];
          drawOptions = polygonOptions(
            { ...options, rotation: 360 / points / 2 + userRotation },
            cx,
            cy,
          );
          for (var index = 0; index < points; ++index) {
            var vertex = (index * interval) % points;
            if (vertex === 0) {
              ++offset;
              if (offset > 0) {
                this.polygon(path, drawOptions);
                path = [];
              }
            }
            path.push(vertices[vertex + offset]);
          }
          this.polygon(path, drawOptions);
        }
      }
      if (options.debug) {
        this.circle(cx, cy, radius, { width: 1, stroke: "#00ff00" });
        this.circle(cx, cy, 2, { fill: "#ff0000" });
      }
      return this;
    },
    arrow: function (x, y, options = {}) {
      var originalX = x;
      var headLength = 10,
        headWidth = 20,
        baseOffset = 0,
        shaftLength = 10,
        shaftWidth = 10;
      if (options.head !== undefined) {
        [headLength, headWidth, baseOffset] = Array.isArray(options.head)
          ? options.head
          : [options.head];
        if (headWidth === undefined)
          [shaftLength, shaftWidth, headWidth] = [
            headLength,
            headLength,
            headLength * 2,
          ];
        if (baseOffset === undefined) baseOffset = 0;
      }
      if (!headLength) headLength = 10;
      if (!headWidth) headWidth = headLength * 2;
      if (options.shaft !== undefined) {
        [shaftLength, shaftWidth] = Array.isArray(options.shaft)
          ? options.shaft
          : [options.shaft];
        if (shaftWidth === undefined) shaftWidth = shaftLength;
      }
      if (shaftWidth > headWidth) shaftWidth = headWidth;
      else if (shaftWidth === 0) shaftWidth = headWidth / 2;
      if (baseOffset === 0 && options.type) {
        var types = { 0: 0, triangle: 0, 1: 0.5, dart: 0.5, 2: -1, kite: -1 };
        if (types[options.type] !== undefined)
          baseOffset = types[options.type] * headLength;
      }
      var drawOptions = { ...options };
      if (options.at && options.rotation && !options.rotationOrigin)
        drawOptions.rotationOrigin = [x, y];
      if (options.double) {
        if (options.at === "head") x -= headLength;
        else if (options.at === "tail") x += shaftLength + headLength;
        else x += shaftLength / 2;
      } else if (options.at === "head") x -= headLength;
      else if (options.at === "tail") x += shaftLength;
      else x += (shaftLength - headLength) / 2;
      var halfHead = headWidth / 2,
        halfShaft = shaftWidth / 2;
      var connectX =
        baseOffset === 0
          ? x
          : x + (baseOffset * (halfHead - halfShaft)) / halfHead;
      var tip = [x + headLength, y],
        top = [x, y - halfHead],
        bottom = [x, y + halfHead];
      var tr = [connectX, y - halfShaft],
        br = [connectX, y + halfShaft];
      var tl = [x - shaftLength, y - halfShaft],
        bl = [x - shaftLength, y + halfShaft];
      var points = options.double
        ? [
            tip,
            bottom,
            br,
            bl,
            [x - shaftLength, y + halfHead],
            [x - shaftLength - headLength, y],
            [x - shaftLength, y - halfHead],
            tl,
            tr,
            top,
            tip,
          ]
        : [tip, bottom, br, bl, tl, tr, top, tip];
      this.polygon(points, drawOptions);
      if (options.debug) {
        this.circle(originalX, y, 2, { color: "red" });
        if (options.debug === 2) {
          var E = [x + baseOffset, y];
          [
            ["E", E[0] - 3, E[1] - 4, E[0], E[1], "blue", "green"],
            ["K", top[0] - 3, top[1] - 10, top[0], top[1] - 6, "blue", "green"],
            ["i", tip[0] + 5, tip[1] - 4, tip[0] + 6, tip[1], "blue", "green"],
            [
              "T",
              bottom[0] - 2,
              bottom[1] + 3,
              bottom[0],
              bottom[1] + 6,
              "blue",
              "green",
            ],
            ["br", br[0] - 4, br[1] - 11, br[0], br[1] - 8, "red", "red"],
            ["bl", bl[0] + 4, bl[1] - 11, bl[0] + 8, bl[1] - 8, "red", "red"],
            ["tl", tl[0] + 5, tl[1] + 2, tl[0] + 8, tl[1] + 7, "red", "red"],
            ["tr", tr[0] - 3, tr[1] + 2, tr[0], tr[1] + 7, "red", "red"],
          ].forEach(([label, tx, ty, cx, cy, textColor, circleColor]) => {
            this.text(label, tx, ty, {
              size: 9,
              color: textColor,
              font: options.font,
            });
            this.circle(cx, cy, 6, { color: circleColor, width: 0.5 });
          });
        }
      }
      return this;
    },
    triangle: function (x, y, traits, options = {}) {
      if (!Array.isArray(traits) || traits.length !== 3)
        throw new Error(
          "Triangle requires 3 traits (sides/angles) for definition.",
        );
      var traitID = (
        options.traitID ||
        options.traitsID ||
        "sss"
      ).toLowerCase();
      var geometry = triangleGeometry(x, y, traitID, traits);
      var position = options.position
        ? options.position.toLowerCase()
        : "default";
      var centers = centerForTriangle(geometry.vertices, geometry);
      var target =
        position === "a"
          ? geometry.vertices[2]
          : position === "b" || position === "default"
            ? geometry.vertices[0]
            : position === "c"
              ? geometry.vertices[1]
              : centers[position] || geometry.vertices[0];
      var vertices =
        position === "default"
          ? geometry.vertices
          : translated(geometry.vertices, x - target[0], y - target[1]);
      vertices = flipped(vertices, x, y, options.flipX, options.flipY);
      var drawOptions = { ...options };
      if (
        options.rotation &&
        options.rotation !== 0 &&
        !drawOptions.rotationOrigin
      )
        drawOptions.rotationOrigin = [x, y];
      this.polygon(vertices, drawOptions);
      if (options.debug) {
        var debugVertices = rotated(
          vertices,
          drawOptions.rotationOrigin?.[0] ?? x,
          drawOptions.rotationOrigin?.[1] ?? y,
          drawOptions.rotation || 0,
        );
        debugTriangle(this, x, y, debugVertices, geometry, position, options);
      }
      return this;
    },
  };
}
