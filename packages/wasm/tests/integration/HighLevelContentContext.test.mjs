// Port of the supported behavior in tests/HighLevelContentContext.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

describe("HighLevelContentContext", function () {
  /** Create the same page/form contexts exposed by fresh and modifying writers. */
  async function drawingTarget(mode) {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var writer;
    if (mode.startsWith("modified")) {
      var original = muhammara.createWriter();
      original.writePage(original.createPage(0, 0, 100, 100));
      writer = muhammara.createWriterToModify(original.end(), {
        compress: false,
      });
    } else writer = muhammara.createWriter({ compress: false });
    writer.getObjectsContext().setCompressStreams(false);
    var form = mode.endsWith("form")
      ? writer.createFormXObject(0, 0, 100, 100)
      : null;
    var page = form ? null : writer.createPage(0, 0, 100, 100);
    return {
      writer,
      context: form
        ? form.getContentContext()
        : writer.startPageContentContext(page),
      /** Finalize the context and decode its uncompressed PDF output. */
      finish() {
        if (form) {
          writer.endFormXObject(form);
          writer.writePage(writer.createPage(0, 0, 100, 100));
        } else writer.writePage(page);
        return new TextDecoder().decode(writer.end());
      },
    };
  }

  for (var mode of ["page", "form", "modified-page", "modified-form"]) {
    // Pass the value into the callback factory because this suite uses var.
    addDrawingTests(mode);
  }

  /** Exercise failure atomicity and clipping on every writer context. */
  function addDrawingTests(mode) {
    it(
      "discards null-type shapes without changing stroke state on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var context = target.context;
        for (var [name, values] of [
          ["drawCircle", [10, 20, 5]],
          ["drawSquare", [10, 20, 5]],
          ["drawRectangle", [10, 20, 5, 6]],
          ["drawPath", [10, 20, 30, 40]],
          [
            "drawPath",
            [
              [
                [10, 20],
                [30, 40],
              ],
            ],
          ],
        ]) {
          for (var close of [false, true]) {
            context.q().RG(0, 0, 1).w(3);
            assert.equal(
              context[name](...values, {
                type: null,
                color: "red",
                width: 7,
                close,
              }),
              context,
            );
            context.drawRectangle(51, 52, 53, 54, { type: "fill" });
            context.drawRectangle(61, 62, 63, 64, {}).Q();
          }
        }
        var output = target.finish();
        var segments = [
          ...output.matchAll(/q\s+(0 0 1 RG\s+3 w\s+[\s\S]*?)\s+Q/g),
        ];
        assert.equal(segments.length, 10);
        for (var segment of segments) {
          assert.match(segment[1], /\b1 0 0 rg\s/);
          assert.match(
            segment[1],
            /\bn\s+51 52 53 54 re\s+f\s+61 62 63 64 re\s+S$/,
          );
          assert.equal((segment[1].match(/\bS\b/g) || []).length, 1);
          assert.doesNotMatch(segment[1], /\b(?:7 w|h|s|W)\b/);
        }
      },
    );

    it(
      "distinguishes default and recognized path types and rejects others on " +
        mode,
      async function () {
        var target = await drawingTarget(mode);
        var cases = [
          [{}, "S"],
          [{ type: undefined }, "S"],
          [{ type: "stroke", close: true }, "s"],
          [{ type: "fill" }, "f"],
          [{ type: "clip", close: true }, "h\\s+W\\s+n"],
          [{ type: null }, "n"],
        ];
        for (var [options] of cases)
          target.context.q().drawRectangle(1, 2, 3, 4, options).Q();
        // Unlike native, which ends such a path unpainted, Wasm rejects any
        // other type before writing anything.
        for (var type of [false, 0, "", "unknown", "clipp"]) {
          assert.throws(
            () => target.context.drawRectangle(9, 9, 9, 9, { type }),
            TypeError,
          );
        }
        var output = target.finish();
        assert.doesNotMatch(output, /9 9 9 9 re/);
        var segments = [...output.matchAll(/q\s+(1 2 3 4 re[\s\S]*?)\s+Q/g)];
        assert.equal(segments.length, cases.length);
        cases.forEach(function (entry, index) {
          assert.match(
            segments[index][1],
            new RegExp("^1 2 3 4 re\\s+" + entry[1] + "$"),
          );
        });
      },
    );

    it(
      "preserves null-type accessor order and failure atomicity on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var events = [];
        var failure = new Error("null type sentinel");
        var fail = true;
        var options = {
          /** Record both legacy type reads, failing before output on the second. */
          get type() {
            events.push("type");
            if (fail && events.length === 3) throw failure;
            return null;
          },
          /** Record the color read between the type reads. */
          get color() {
            events.push("color");
            return "red";
          },
          /** Null is non-stroking, so width must never be evaluated. */
          get width() {
            throw new Error("unexpected width read");
          },
          /** Record closing only after both type reads succeed. */
          get close() {
            events.push("close");
            return true;
          },
        };
        target.context.q();
        assert.throws(
          () => target.context.drawRectangle(1, 2, 3, 4, options),
          (error) => error === failure,
        );
        assert.deepEqual(events, ["type", "color", "type"]);
        target.context.Q().q();
        events.length = 0;
        fail = false;
        target.context.drawRectangle(1, 2, 3, 4, options).Q();
        assert.deepEqual(events, ["type", "color", "type", "close"]);
        var output = target.finish();
        assert.match(output, /\b1 0 0 rg\s/);
        assert.match(
          output.replace(/1 0 0 rg\s+/g, ""),
          /q\s+Q\s+q\s+1 2 3 4 re\s+n\s+Q/,
        );
      },
    );

    it(
      "rejects non-finite drawing and incomplete paths atomically on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var context = target.context;
        var font = target.writer.getFontForBytes("arial");
        var options = { color: "red", width: 2 };
        context.q();
        for (var invalid of [NaN, Infinity, -Infinity]) {
          for (var [name, coordinates] of [
            ["drawCircle", [10, 20, 5]],
            ["drawSquare", [10, 20, 5]],
            ["drawRectangle", [10, 20, 5, 6]],
            ["drawPath", [10, 20, 30, 40]],
          ]) {
            for (var index = 0; index < coordinates.length; ++index) {
              var values = coordinates.slice();
              values[index] = invalid;
              assert.throws(() => context[name](...values, options), /finite/);
            }
            assert.throws(
              () =>
                context[name](...coordinates, { color: "red", width: invalid }),
              /finite/,
            );
          }
          for (var index = 0; index < 4; ++index) {
            var points = [
              [10, 20],
              [30, 40],
            ];
            points[Math.floor(index / 2)][index % 2] = invalid;
            assert.throws(() => context.drawPath(points, options), /finite/);
          }
          assert.throws(() =>
            context.writeText("rejected", invalid, 20, { font, color: "red" }),
          );
          assert.throws(() =>
            context.writeText("rejected", 10, invalid, { font, color: "red" }),
          );
          assert.throws(() =>
            context.writeText("rejected", 10, 20, {
              font,
              size: invalid,
              color: "red",
            }),
          );
        }
        for (var args of [
          [10, 20, 30, options],
          [10, 20, 30, 40, 50, options],
          [10, 20, "garbage", 40, options],
          [10, 20, 30, 40, "garbage", options],
          [[[10, 20], [30]], options],
          [
            [
              [10, 20],
              [30, 40, 50],
            ],
            options,
          ],
          [[[10, 20], new Array(2)], options],
          [[[10, 20], , [30, 40]], options],
          [
            [
              [10, 20],
              [30, 40],
            ],
            options,
            50,
          ],
        ])
          assert.throws(() => context.drawPath(...args));
        for (var center of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
          for (var radius of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
            assert.throws(
              () => context.drawCircle(center, 0, radius, options),
              /finite/,
            );
            assert.throws(
              () => context.drawCircle(0, center, radius, options),
              /finite/,
            );
          }
        }
        var measure = font._underline;
        /** Supply finite metrics whose placement overflows the underline endpoint. */
        font._underline = function () {
          return { thickness: 1, position: 0, advance: Number.MAX_VALUE };
        };
        try {
          assert.throws(
            () =>
              context.writeText("MMMMMMMM", Number.MAX_VALUE, 20, {
                font,
                size: 12,
                underline: true,
                color: "red",
              }),
            /finite/,
          );
        } finally {
          font._underline = measure;
        }
        context.Q().drawRectangle(1, 2, 3, 4, {});
        var output = target.finish();
        assert.match(output, /q\s+Q\s+1 2 3 4 re\s+S/);
        assert.doesNotMatch(output, /\b(?:nan|[-+]?inf(?:inity)?)\b/i);
      },
    );

    it(
      "rejects an unknown colorspace before output on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        assert.throws(
          () =>
            target.context.drawRectangle(1, 2, 3, 4, {
              color: 0xff0000,
              colorspace: "lab",
            }),
          {
            name: "TypeError",
            message: "colorspace must be rgb, gray, or cmyk",
          },
        );
        target.context.drawRectangle(1, 2, 3, 4, {
          color: 0xff0000,
          colorspace: undefined,
        });
        assert.doesNotMatch(await target.finish(), /lab/);
      },
    );

    it(
      "snapshots path coordinates before output on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var failure = new Error("coordinate sentinel");
        var reads = 0;
        var fail = true;
        var points = [
          [10, 20],
          [30, 40],
        ];
        Object.defineProperty(points[1], 1, {
          /** Fail the first attempt; later reads must use the captured coordinate. */
          get: function () {
            if (fail) throw failure;
            if (++reads > 1) throw new Error("coordinate read twice");
            return 40;
          },
        });
        target.context.q();
        assert.throws(
          () => target.context.drawPath(points, { color: "red", width: 2 }),
          (error) => error === failure,
        );
        target.context.Q();
        fail = false;
        target.context.drawPath(points, {});
        assert.equal(reads, 1);
        assert.match(target.finish(), /q\s+Q\s+10 20 m\s+30 40 l\s+S/);
      },
    );

    it(
      "validates all shapes and text before output on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var context = target.context;
        var font = target.writer.getFontForBytes("arial");
        var failure = new Error("option sentinel");
        context.q();
        for (var [name, values] of [
          ["drawCircle", [10, 20, 5]],
          ["drawSquare", [10, 20, 5]],
          ["drawRectangle", [10, 20, 5, 6]],
          [
            "drawPath",
            [
              [
                [10, 20],
                [30, 40],
              ],
            ],
          ],
        ]) {
          for (var key of ["color", "width", "type", "close"]) {
            var options = { color: "red", width: 2 };
            Object.defineProperty(options, key, {
              get() {
                throw failure;
              },
            });
            assert.throws(
              () => context[name](...values, options),
              (error) => error === failure,
            );
          }
          assert.throws(
            () =>
              context[name](...values, {
                color: "red",
                width: Symbol("width"),
              }),
            TypeError,
          );
          assert.throws(
            () => context[name](...values, { color: Symbol("color") }),
            TypeError,
          );
          var reads = 0;
          assert.throws(
            () =>
              context[name](...values, {
                get type() {
                  if (++reads === 2) throw failure;
                  return "stroke";
                },
              }),
            (error) => error === failure,
          );
        }
        for (var key of ["font", "size", "color", "underline"]) {
          var options = { font, size: 12, color: "red" };
          Object.defineProperty(options, key, {
            get() {
              throw failure;
            },
          });
          assert.throws(
            () => context.writeText("text", 10, 20, options),
            (error) => error === failure,
          );
        }
        assert.throws(
          () => context.writeText("text", Symbol("x"), 20, { font }),
          TypeError,
        );
        assert.throws(
          () =>
            context.writeText("text", 10, 20, { font, color: Symbol("color") }),
          TypeError,
        );
        assert.throws(
          () =>
            context.writeText("text", 10, 20, { font, size: Symbol("size") }),
          RangeError,
        );
        context.Q().drawRectangle(1, 2, 3, 4, {});
        assert.match(target.finish(), /q\s+Q\s+1 2 3 4 re\s+S/);
      },
    );

    it("clips without painting on " + mode, async function () {
      var target = await drawingTarget(mode);
      var context = target.context;
      context
        .q()
        .drawRectangle(10, 20, 30, 40, { type: "clip" })
        .drawSquare(10, 20, 30, { type: "clip", close: true })
        .drawCircle(50, 50, 10, { type: "clip" })
        .drawPath(
          [
            [0, 0],
            [10, 10],
          ],
          { type: "clip", close: true },
        )
        .Q()
        .drawRectangle(5, 6, 7, 8, { type: "fill" });
      var output = target.finish();
      assert.equal((output.match(/\bW\s+n\b/g) || []).length, 4);
      assert.match(output, /10 20 30 40 re\s+W\s+n/);
      assert.match(output, /10 20 30 30 re\s+h\s+W\s+n/);
      assert.match(output, /5 6 7 8 re\s+f/);
    });

    it(
      "sets color and width before the path, as native does, on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var context = target.context;
        context
          .drawRectangle(1, 2, 3, 4, { type: "fill", color: 0xff0000 })
          .drawSquare(1, 2, 3, { color: "black", width: 2 })
          .drawCircle(50, 50, 10, { colorspace: "gray", color: 0x80 })
          .drawPath(0, 0, 10, 10, {
            type: "fill",
            colorspace: "cmyk",
            color: 0xff,
          })
          .drawPath(0, 0, 20, 20);
        var output = target.finish();
        // PDF forbids graphics-state operators inside a path object.
        assert.match(output, /1 0 0 rg\s+1 2 3 4 re\s+f/);
        assert.match(output, /0 0 0 RG\s+2 w\s+1 2 3 3 re\s+S/);
        assert.match(output, /0\.50\d* G\s+60 50 m/);
        assert.match(output, /0 0 0 1 k\s+0 0 m\s+10 10 l\s+f/);
        assert.match(output, /0 0 m\s+20 20 l\s+S/);
        assert.doesNotMatch(
          output,
          /\b(?:re|l|c)\s+(?:[\d.]+ ){1,4}(?:rg|RG|g|G|k|K|w)\b/,
        );
      },
    );

    it(
      "underlines text with the font underline metrics on " + mode,
      async function () {
        var target = await drawingTarget(mode);
        var context = target.context;
        var font = target.writer.getFontForBytes("arial");
        context
          .writeText("Hi", 10, 10, { font, size: 12, underline: true })
          .writeText("Gray", 10, 40, {
            font,
            size: 12,
            colorspace: "gray",
            color: 0x80,
          });
        var output = target.finish();
        // Arial post table: thickness 150/2048 and position -217/2048 em; the
        // underline ends at the text advance, matching native byte for byte.
        assert.match(
          output,
          /0\.878906 w\s+10 8\.728516 m\s+21\.328 8\.728516 l\s+S/,
        );
        assert.match(output, /BT\s+0\.50\d* g\s+[^]*?\(Gray\) Tj/);
      },
    );
  }

  it("draws shapes and text with byte-registered fonts", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var writer = muhammara.createWriter();
    writer.getObjectsContext().setCompressStreams(false);
    var page = writer.createPage(0, 0, 595, 842);
    var context = writer.startPageContentContext(page);
    var font = writer.getFontForBytes("arial");
    var fill = { color: 0xff000000, colorspace: "cmyk", type: "fill" };
    var stroke = { color: "DarkMagenta", width: 4 };
    var text = {
      font,
      size: 14,
      colorspace: "gray",
      color: 0,
      underline: true,
    };

    assert.equal(
      context.drawPath(
        [
          [75, 640],
          [149, 800],
          [225, 640],
        ],
        fill,
      ),
      context,
    );
    assert.equal(
      context.drawPath(75, 540, 110, 440, 149, 540, 188, 440, 223, 540, stroke),
      context,
    );
    assert.equal(context.drawSquare(375, 640, 120, fill), context);
    assert.equal(context.drawRectangle(375, 220, 50, 160, stroke), context);
    assert.equal(context.drawCircle(149, 300, 80, fill), context);
    assert.equal(context.writeText("Shapes", 75, 805, text), context);
    context.q().setOpacity(0.5).writeText("Transparent", 75, 370, text).Q();
    writer.writePage(page);

    var pdf = writer.end();
    writeOutput("HighLevelContentContext", pdf);
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /\/ca 0.5/);
    assert.match(output, /\/CA 0.5/);
    assert.match(output, /75 640 m/);
    assert.match(output, /149 800 l/);
    assert.match(output, /225 640 l/);
    assert.match(output, /75 540 m/);
    assert.match(output, /223 540 l/);
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects invalid opacity values with the Node error message", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);
    var message =
      /Wrong Argument, please provide 1 opacity value between 0 and 1/;

    assert.throws(() => context.setOpacity(), message);
    assert.throws(() => context.setOpacity("0.5"), message);
    assert.throws(() => context.setOpacity(NaN), message);
    assert.throws(() => context.setOpacity(-0.1), message);
    assert.throws(() => context.setOpacity(1.1), message);
    writer.writePage(page);
    writer.end();
  });

  it("rejects invalid drawPath arguments", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);

    assert.throws(() => context.drawPath(), /coordinate pairs/);
    assert.throws(() => context.drawPath([[0, 0]]), /at least two/);
    assert.throws(
      () =>
        context.drawPath([
          [0, 0],
          [1, Number.NaN],
        ]),
      /finite numbers/,
    );
    // Like native, flat coordinates may omit the options object.
    context.drawPath(0, 0, 1, 1);
    assert.throws(() => context.drawPath(0, 0, 1), /coordinate pairs/);
    assert.throws(
      () => context.drawPath(0, 0, 1, 1, "stroke"),
      /coordinate pairs/,
    );
    writer.writePage(page);
    writer.end();
  });
});
