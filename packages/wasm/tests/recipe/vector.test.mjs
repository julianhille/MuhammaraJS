// Ports vector behavior from tests/recipe/vector.js, shapes.js, arcs.js, and triangle.js.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

function getFirstContentStream(pdf) {
  var bytes = Buffer.from(pdf);
  var start = bytes.indexOf("stream\r\n") + "stream\r\n".length;
  var end = bytes.indexOf("\r\nendstream", start);
  return inflateSync(bytes.subarray(start, end)).toString();
}

/** Collects decoded painting blocks from a page and its Form XObjects. */
function getPaintBlocks(muhammara, reader, pageIndex) {
  var page = reader.parsePage(pageIndex).getDictionary();
  var contents = reader.queryDictionaryObject(page, "Contents");
  var streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toPDFArray()
          .toJSArray()
          .map((reference) =>
            reader.parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            ),
          )
      : [contents];
  var resources = reader.queryDictionaryObject(page, "Resources");
  if (resources.exists("XObject")) {
    var forms = reader.queryDictionaryObject(resources, "XObject");
    Object.keys(forms.toJSObject()).forEach(function (name) {
      streams.push(reader.queryDictionaryObject(forms, name));
    });
  }
  return streams.flatMap(function (stream) {
    var input = reader.startReadingFromStream(stream.toPDFStream());
    var bytes = [];
    while (input.notEnded()) bytes.push(...input.read(4096));
    var content = new TextDecoder("latin1").decode(new Uint8Array(bytes));
    return (content.match(/q\r?\n[\s\S]*?\r?\nQ/g) || [content]).filter(
      function (block) {
        return /(?:^|\r?\n)(?:f|S)\r?\n/.test(block);
      },
    );
  });
}

describe("Recipe vector", function () {
  it("creates vector shapes, transforms, and images", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var pdf = new Recipe()
      .info({ title: "Browser Recipe", author: "Muhammara" })
      .custom("TestKey", "TestValue")
      .createPage(595, 842)
      .setPageBox(muhammara.ePDFPageBoxCropBox, 10, 10, 585, 832)
      .rotate(90)
      .lineStyle({ width: 3, cap: 1, join: 1, dash: [6, 3] })
      .opacity(0.5)
      .rectangle(260, 180, 80, 40, {
        stroke: "#dc2626",
        rotation: 15,
        rotationOrigin: [300, 200],
      })
      .opacity(1)
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

    writeOutput("vector-shapes", pdf);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), "%PDF-1.7");
    assert.match(new TextDecoder().decode(pdf), /%%EOF/);
  });

  it("closes pie wedges", async function () {
    var Recipe = await getRecipe();
    var pdf = new Recipe()
      .createPage(200, 200)
      .pie(100, 100, 50, 20, 220, { stroke: "#000000" })
      .endPage()
      .endPDF();

    writeOutput("vector-pie-wedge", pdf);
    assert.match(getFirstContentStream(pdf), /\r?\nh\r?\n[\s\S]*?S\r?\n/);
  });

  it("insets vector strokes within the requested bounds", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var options = {
      fill: "#000000",
      stroke: "#ff0000",
      lineWidth: 10,
    };
    var inheritedOptions = Object.create(options);
    Object.defineProperty(inheritedOptions, "unused", {
      enumerable: true,
      get: function () {
        throw new Error("Unused option getter must not be evaluated");
      },
    });
    var pdf = new Recipe()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, inheritedOptions)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, { ...options, borderRadius: 10 })
      .endPage()
      .createPage(80, 80)
      .circle(40, 40, 40, options)
      .endPage()
      .createPage(80, 40)
      .ellipse(40, 20, 40, 20, options)
      .endPage()
      .createPage(80, 80)
      .arc(40, 40, 40, 0, 90, options)
      .endPage()
      .createPage(80, 80)
      .pie(40, 40, 40, 0, 90, options)
      .endPage()
      .createPage(100, 60)
      .rectangle(0, 0, 100, 60, {
        stroke: "#ff0000",
        lineWidth: 10,
      })
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(pdf);
    try {
      var expectedGeometry = [
        [/\b0 0 100 60 re\b/, /\b5 5 90 50 re\b/],
        [/\b10 0 m\b/, /\b15 5 m\b/],
        [/\b0 40 m\b/, /\b5 40 m\b/],
        [/\b0 20 m\b/, /\b5 20 m\b/],
        [/\b80 40 m\b/, /\b75 40 m\b/],
        [/\b80 40 m\b/, /\b75 40 m\b/],
      ];
      expectedGeometry.forEach(function (geometry, pageIndex) {
        var blocks = getPaintBlocks(muhammara, reader, pageIndex);
        var fillBlock = blocks.find(function (block) {
          return /(?:^|\r?\n)f\r?\n/.test(block);
        });
        var strokeBlock = blocks.find(function (block) {
          return /(?:^|\r?\n)S\r?\n/.test(block);
        });
        assert.equal(blocks.length, 2);
        assert.match(fillBlock, geometry[0]);
        assert.match(strokeBlock, geometry[1]);
        assert.match(strokeBlock, /(?:^|\r?\n)10 w\r?\n/);
        assert.doesNotMatch(blocks.join("\n"), /(?:^|\r?\n)B\r?\n/);
      });
      var strokeOnlyBlocks = getPaintBlocks(muhammara, reader, 6);
      assert.equal(strokeOnlyBlocks.length, 1);
      assert.match(strokeOnlyBlocks[0], /\b5 5 90 50 re\b/);
      assert.match(strokeOnlyBlocks[0], /(?:^|\r?\n)10 w\r?\n/);
      assert.match(strokeOnlyBlocks[0], /(?:^|\r?\n)S\r?\n/);
      assert.doesNotMatch(strokeOnlyBlocks[0], /(?:^|\r?\n)(?:f|B)\r?\n/);
    } finally {
      reader.end();
    }
  });

  it("insets vector strokes while editing an existing page", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe()
      .createPage(100, 60)
      .endPage()
      .createPage(100, 60)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .createPage(80, 40)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .createPage(80, 80)
      .endPage()
      .endPDF();
    var options = {
      fill: "#000000",
      stroke: "#ff0000",
      lineWidth: 10,
    };
    var pdf = new Recipe(source)
      .editPage(1)
      .rectangle(0, 0, 100, 60, options)
      .endPage()
      .editPage(2)
      .rectangle(0, 0, 100, 60, { ...options, borderRadius: 10 })
      .endPage()
      .editPage(3)
      .circle(40, 40, 40, options)
      .endPage()
      .editPage(4)
      .ellipse(40, 20, 40, 20, options)
      .endPage()
      .editPage(5)
      .arc(40, 40, 40, 0, 90, options)
      .endPage()
      .editPage(6)
      .pie(40, 40, 40, 0, 90, options)
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(pdf);
    try {
      var expectedGeometry = [
        [/\b0 0 100 60 re\b/, /\b5 5 90 50 re\b/],
        [/\b10 0 m\b/, /\b15 5 m\b/],
        [/\b0 40 m\b/, /\b5 40 m\b/],
        [/\b0 20 m\b/, /\b5 20 m\b/],
        [/\b80 40 m\b/, /\b75 40 m\b/],
        [/\b80 40 m\b/, /\b75 40 m\b/],
      ];
      expectedGeometry.forEach(function (geometry, pageIndex) {
        var blocks = getPaintBlocks(muhammara, reader, pageIndex);
        var fillBlock = blocks.find(function (block) {
          return /(?:^|\r?\n)f\r?\n/.test(block);
        });
        var strokeBlock = blocks.find(function (block) {
          return /(?:^|\r?\n)S\r?\n/.test(block);
        });
        assert.equal(blocks.length, 2);
        assert.match(fillBlock, geometry[0]);
        assert.match(strokeBlock, geometry[1]);
        assert.match(strokeBlock, /(?:^|\r?\n)10 w\r?\n/);
        assert.doesNotMatch(blocks.join("\n"), /(?:^|\r?\n)B\r?\n/);
      });
    } finally {
      reader.end();
    }
  });
});
