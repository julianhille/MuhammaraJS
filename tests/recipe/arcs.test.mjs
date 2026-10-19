import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent, textRuns } from "../support/pdf.mjs";
import { clockwise, fills, paths } from "../support/geometry.mjs";

var LETTER_HEIGHT = 792;

/**
 * Convert degrees to radians.
 * @param {number} angle - The angle in degrees.
 * @returns {number} The angle in radians.
 */
function toRadians(angle) {
  return angle * (Math.PI / 180);
}

/**
 * The point at a distance and angle from another, in Recipe coordinates.
 * @param {number} x - The start x.
 * @param {number} y - The start y.
 * @param {number} l - The distance.
 * @param {number} angle - The angle in degrees, clockwise on the page.
 * @returns {number[]} The [x, y] end point.
 */
function endPoint(x, y, l, angle) {
  var radians = toRadians(angle);
  return [x + l * Math.cos(radians), y + l * Math.sin(radians)];
}

/**
 * Draw a labelled pie chart; registered on the Recipe with `register()`.
 * Every slice gives its fill, so the chart is deterministic.
 * @this {object} The Recipe.
 * @param {number} x - The center x.
 * @param {number} y - The center y.
 * @param {number} radius - The radius.
 * @param {object} chart - The data, sector, label and title options.
 * @returns {object} The Recipe.
 */
function pieChart(x, y, radius, chart) {
  var startAt = -90;
  var sectorLineColor = "#00";
  var sectorOpacity = 1;
  var sectorRay = false;
  var sectorOffset = 0;
  var sectorLimit = 10;
  var sectorPcntColor = "#ffffff";
  var sectorPcntSize = 8;
  var total = 0;
  var labelOpts = { font: "arial", size: 14 };
  var pie = chart.data;
  pie.forEach((slice) => (total += slice.value));
  if (chart.sector) {
    if (chart.sector.stroke) sectorLineColor = chart.sector.stroke;
    if (chart.sector.opacity) sectorOpacity = chart.sector.opacity;
    if (chart.sector.ray) sectorRay = chart.sector.ray;
    if (chart.sector.offset) sectorOffset = chart.sector.offset;
    if (chart.sector.percentColor) sectorPcntColor = chart.sector.percentColor;
    if (chart.sector.percentSize) sectorPcntSize = chart.sector.percentSize;
    if (chart.sector.percentLimit) sectorLimit = chart.sector.percentLimit;
  }
  if (chart.label) Object.assign(labelOpts, chart.label);
  var options = {
    stroke: sectorLineColor,
    width: 1,
    sector: true,
    opacity: sectorOpacity,
  };
  var smallestY = y - radius - 20;
  for (var i = 0; i < pie.length; i++) {
    var sectorSize = Math.round((pie[i].value / total) * 100);
    var halfWay = sectorSize / 2;
    var endAt = startAt + sectorSize * 3.6;
    var midArcAng = startAt + halfWay * 3.6;
    var raySize = sectorRay ? 15 : 5;
    var offdist = sectorOffset || 5;
    var rayStart = pie[i].offset ? offdist : 0;
    var rayPt1 = endPoint(x, y, radius + rayStart, midArcAng);
    var rayPt2 = endPoint(x, y, radius + rayStart + raySize, midArcAng);
    var [ox, oy] = [x, y];
    var needPercent = false;
    var sectorOpts = { fill: pie[i].fill };
    if (pie[i].offset) [ox, oy] = endPoint(x, y, offdist, midArcAng);
    this.arc(ox, oy, radius, startAt, endAt, { ...options, ...sectorOpts });
    // Implant percentages inside sectors where possible.
    if (sectorSize < sectorLimit) {
      needPercent = true;
    } else {
      var percent = `${sectorSize}%`;
      var psz = this.textDimensions(percent, {
        font: "arial",
        size: sectorPcntSize,
      });
      var prcntDist = radius / 2 + (pie[i].offset ? offdist : 0);
      var tx = 0;
      var ty = 0;
      if (midArcAng > 180) {
        tx = -psz.width / 2;
        ty = -psz.height;
      } else if (midArcAng > 90) {
        tx = -psz.width / 2;
      } else if (midArcAng < 0) {
        ty = -psz.height;
      }
      var [px, py] = endPoint(x, y, prcntDist, midArcAng);
      this.text(percent, px + tx, py + ty, {
        font: "arial",
        color: sectorPcntColor,
        size: sectorPcntSize,
      });
    }
    if (pie[i].label) {
      var opts = { ...labelOpts, ...pie[i], opacity: 1 };
      if (!opts.color) opts.color = pie[i].fill;
      var xOffset = 5;
      var yOffset = opts.size / 2;
      var label = needPercent
        ? `${pie[i].label} (${sectorSize}%)`
        : pie[i].label;
      if (sectorRay) {
        this.line([rayPt1, rayPt2], { stroke: pie[i].fill, width: 0.5 });
      }
      var td = this.textDimensions(label, opts);
      if (midArcAng > -90 && midArcAng < -45) {
        yOffset = td.height * 1.5;
        xOffset = -td.width / 2;
      } else if (midArcAng > 45 && midArcAng <= 90) {
        yOffset = -5;
        xOffset = -td.width / 2;
      } else if (midArcAng > 90 && midArcAng <= 220) {
        xOffset = -td.width - 5;
        if (midArcAng < 180) yOffset = 0;
      } else if (midArcAng > 220) {
        xOffset = -td.width / 2;
        yOffset = opts.size;
      }
      var ry = rayPt2[1] - yOffset;
      this.text(label, rayPt2[0] + xOffset, ry, opts);
      if (ry < smallestY) smallestY = ry;
    }
    startAt = endAt;
  }
  if (chart.title && chart.title.text) {
    var title = { font: "arial", ...chart.title };
    var tdTitle = this.textDimensions(title.text, title);
    this.text(
      title.text,
      x - tdTitle.width / 2,
      smallestY - labelOpts.size - tdTitle.height * 1.5,
      title,
    );
  }
  return this;
}

/**
 * Assert that two points match within 0.01 pt.
 * @param {number[]} actual - The drawn point.
 * @param {number[]} expected - The expected point.
 * @param {string} message - Which point.
 * @returns {void}
 */
function assertPoint(actual, expected, message) {
  assert.ok(
    Math.abs(actual[0] - expected[0]) < 0.01 &&
      Math.abs(actual[1] - expected[1]) < 0.01,
    `${message}: ${actual} is not ${expected}`,
  );
}

/**
 * The angle a sector path spans, from its first to its last arc point.
 * @param {object} sector - A sector path starting at its center.
 * @returns {number} The angle in degrees.
 */
function span(sector) {
  var [center, start] = sector.anchors;
  var stop = sector.anchors.at(-1);
  var from = Math.atan2(start[1] - center[1], start[0] - center[0]);
  var to = Math.atan2(stop[1] - center[1], stop[0] - center[0]);
  return Math.round(((((from - to) * 180) / Math.PI + 360) % 360) * 10) / 10;
}

/**
 * Draw the arcs and sectors page.
 * @param {object} end - The end.
 * @returns {Uint8Array} The PDF.
 */
function simpleArcs(end) {
  var x = 120;
  var y = 120;
  var r = 50;
  var txtOps = { font: "arial", color: "#000000", size: 10 };
  var recipe = end
    .newRecipe()
    .createPage("letter")
    .text("Arcs of Circles", 230, 27, { font: "arial", size: 20, bold: true })
    .arc(x, y, r, 0, 90)
    .text("0°", x + r + 5, y, txtOps)
    .text("90°", x, y + r + 5, txtOps)
    .arc(x, y, r, -90, -180)
    .text("-90°", x - 15, y - r - 13, txtOps)
    .text("-180°", x - r - 30, y - 10, txtOps)
    .circle(x, y, 2, { color: "red", width: 0.5 })
    .arc(x + 120, y, r, 90, -90)
    .arc(x + 240, y, r, -90, 90, { rotation: -60 })
    .arc(x + 360, y, r, 45, -270)
    .arc(x + 363, y + 7, r, 45, 90);
  y += 160;
  return recipe
    .text("Sectors of Circles", 220, y - r - 30, {
      font: "arial",
      size: 20,
      bold: true,
    })
    .arc(x, y, r, 0, 90, { rotation: 0, sector: true })
    .arc(x, y, r, -90, -180, { rotation: 0, fill: "red", sector: true })
    .text("showing sector & fill", x - r, y + r + 21, txtOps)
    .arc(x + 120, y, r, 90, -90, { rotation: 0 })
    .arc(x + 120, y, r, 90, 270, {
      rotation: 0,
      fill: "green",
      stroke: "default",
    })
    .text("fill and nofill", x + 120 - r / 2, y + r + 21, txtOps)
    .arc(x + 240, y, r, -140, 120, { sector: true, stroke: "default" })
    .text(
      "sector: true\ncloses arc\nto centerpoint",
      x + 215,
      y + r + 21,
      txtOps,
    )
    .arc(x + 360, y, r, 45, -270, { rotation: 0, fill: "def", sector: true })
    .arc(x + 363, y + 7, r, 45, 90, {
      rotation: 0,
      fill: "red",
      sector: true,
    })
    .text("PIZZA anyone?", x + 360 - 20, y + r + 21, txtOps)
    .endPage()
    .endPDF();
}

describeEnds("Arc test", function (end) {
  it("draws simple arcs and sectors", function () {
    var bytes = simpleArcs(end);
    writeOutput(end, "arcs", bytes);
    var pdf = (x, y) => [x, LETTER_HEIGHT - y];
    var drawn = paths(end, bytes);
    var startingAt = (point) =>
      drawn.filter(
        (path) =>
          Math.abs(path.anchors[0][0] - point[0]) < 0.01 &&
          Math.abs(path.anchors[0][1] - point[1]) < 0.01,
      );
    // Positive angles run clockwise from 3 o'clock; the stroke is inset by
    // half the default width of 2.
    var [quarter] = startingAt(pdf(169, 120));
    assertPoint(quarter.anchors.at(-1), pdf(120, 169), "0° to 90° ends");
    // Negative angles run counter-clockwise: -90° is 12 o'clock.
    var [negative] = startingAt(pdf(120, 71));
    assertPoint(negative.anchors.at(-1), pdf(71, 120), "-90° to -180° ends");
    // rotation turns the arc around its center; -60 is counter-clockwise.
    var center = pdf(360, 120);
    var [turned] = startingAt(clockwise(pdf(360, 71), center, -60));
    assert.ok(turned, "the turned arc starts at 12 o'clock turned by -60°");
    assertPoint(
      turned.anchors.at(-1),
      clockwise(pdf(360, 169), center, -60),
      "turned arc ends",
    );
    // A sector starts at its center and closes back to it.
    var sectors = startingAt(pdf(120, 280));
    assert.equal(sectors.length, 2);
    var [strokedSector, redSector] = sectors;
    assert.equal(strokedSector.paint, "S");
    assert.ok(strokedSector.closed, "the stroked sector is closed");
    assert.ok(fills(redSector) && redSector.fill.values.join() === "1,0,0");
    // Without sector, a filled arc starts on the circle.
    var filledArc = drawn.find(
      (path) => fills(path) && path.fill.values.join() === "0,1,0",
    );
    assertPoint(filledArc.anchors[0], pdf(240, 330), "filled arc starts");
    assert.ok(textRuns(end, bytes).some((run) => run.text === "PIZZA anyone?"));
  });

  it("draws pie charts on an edited page", function () {
    var movies = [
      { label: "Comedy", value: 8, fill: "red" },
      { label: "Action", value: 5, fill: "#d62e00" },
      { label: "Romance", value: 6, fill: "347d24" },
      { label: "Drama", value: 1, fill: "blue" },
      { label: "SciFi", value: 4, fill: "#a425ff" },
    ];
    var grades = [
      { label: "A", value: 4, fill: "#c4861b" },
      { label: "B", value: 14, fill: "#1f750e" },
      { label: "C", value: 9, fill: "#125878" },
      { label: "D", value: 2, fill: "red", offset: true },
    ];
    var chart = {
      title: {
        text: "Favorite Type of Movie",
        size: 16,
        color: "#ff621f",
        italic: true,
        bold: true,
        underline: { color: "#ff621f" },
      },
      data: movies,
      sector: {
        stroke: "#ff",
        offset: 16,
        ray: true,
        percentLimit: 6,
        percentSize: 8,
      },
      label: { size: 10, bold: true, italic: true },
    };
    var recipe = end.openRecipe(simpleArcs(end));
    recipe.register(pieChart);
    recipe.editPage(1).pieChart(200, 550, 80, chart);
    chart.data = grades;
    chart.sector.ray = false;
    chart.title.text = "Student Grades";
    chart.title.color = "#000000";
    chart.title.underline = { color: chart.title.color };
    var bytes = recipe.pieChart(420, 550, 80, chart).endPage().endPDF();
    writeOutput(end, "arcs-pie-charts", bytes);
    // register() extends the class every Recipe of this end shares.
    delete Object.getPrototypeOf(recipe).pieChart;

    var sectorsAround = (x, y) =>
      paths(end, bytes).filter(
        (path) =>
          fills(path) &&
          Math.hypot(path.anchors[0][0] - x, path.anchors[0][1] - y) <= 16.01 &&
          path.anchors.length > 2 &&
          Math.abs(
            Math.hypot(
              path.anchors[1][0] - path.anchors[0][0],
              path.anchors[1][1] - path.anchors[0][1],
            ) - 80,
          ) < 0.01,
      );
    // Sector angles follow the rounded percentages, which add up to 100.
    var moviesSectors = sectorsAround(200, LETTER_HEIGHT - 550);
    assert.deepEqual(moviesSectors.map(span), [118.8, 75.6, 90, 14.4, 61.2]);
    var gradeSectors = sectorsAround(420, LETTER_HEIGHT - 550);
    assert.deepEqual(gradeSectors.map(span), [50.4, 172.8, 111.6, 25.2]);
    // The offset slice moves out from the center.
    var offset = gradeSectors[3].anchors[0];
    assert.ok(
      Math.abs(Math.hypot(offset[0] - 420, offset[1] - 242) - 16) < 0.01,
      "slice D is offset by 16",
    );
    // Text an edited page adds sits in forms, which the text extraction of
    // the reader does not read, so look for the shown strings.
    var content = drawnContent(end, bytes);
    [
      "Comedy",
      "Drama \\(4%\\)",
      "Favorite Type of Movie",
      "Student Grades",
    ].forEach((text) =>
      assert.ok(content.includes(`(${text}) Tj`), `${text} is shown`),
    );
  });
});
