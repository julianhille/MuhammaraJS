describe("HighLevelContentContext", function () {
  var expect = require("chai").expect;
  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var outputPath = __dirname + "/output/HighLevelContentContext.pdf";

  /** Create a page or form context on a fresh or modifying writer. */
  function drawingTarget(mode) {
    var muhammara = require("@muhammara/native-with-source");
    var output = new muhammara.PDFWStreamForBuffer();
    var writer;
    if (mode.startsWith("modified")) {
      var source = new muhammara.PDFWStreamForBuffer();
      var original = muhammara.createWriter(source);
      original.writePage(original.createPage(0, 0, 100, 100)).end();
      writer = muhammara.createWriterToModify(
        new muhammara.PDFRStreamForBuffer(source.buffer),
        output,
        { compress: false },
      );
    } else {
      writer = muhammara.createWriter(output, { compress: false });
    }
    var form = mode.endsWith("form")
      ? writer.createFormXObject(0, 0, 100, 100)
      : null;
    var page = form ? null : writer.createPage(0, 0, 100, 100);
    return {
      writer: writer,
      context: form
        ? form.getContentContext()
        : writer.startPageContentContext(page),
      /** Finalize the target and return its uncompressed PDF bytes. */
      finish: function () {
        if (form) {
          writer.endFormXObject(form);
          writer.writePage(writer.createPage(0, 0, 100, 100));
        } else writer.writePage(page);
        writer.end();
        return output.buffer.toString("latin1");
      },
    };
  }

  ["page", "form", "modified-page", "modified-form"].forEach(function (mode) {
    it(
      "discards null-type shapes without changing stroke state on " + mode,
      function () {
        var assert = require("assert");
        var target = drawingTarget(mode);
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
      function () {
        var assert = require("assert");
        var target = drawingTarget(mode);
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
        [false, 0, "", "fil", "Fill", "unknown", {}].forEach(function (type) {
          assert.throws(
            () => target.context.drawRectangle(1, 2, 3, 4, { type }),
            {
              name: "TypeError",
              message:
                'Unknown drawing type; use "stroke", "fill", "clip" or null',
            },
          );
        });
        var output = target.finish();
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
      function () {
        var assert = require("assert");
        var target = drawingTarget(mode);
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
      function () {
        var assert = require("assert");
        var target = drawingTarget(mode);
        var context = target.context;
        var font = target.writer.getFontForFile(
          path.join(__dirname, "TestMaterials/fonts/arial.ttf"),
        );
        var options = { color: "red", width: 2 };
        context.q();
        [NaN, Infinity, -Infinity].forEach(function (invalid) {
          [
            ["drawCircle", [10, 20, 5]],
            ["drawSquare", [10, 20, 5]],
            ["drawRectangle", [10, 20, 5, 6]],
            ["drawPath", [10, 20, 30, 40]],
          ].forEach(function (shape) {
            shape[1].forEach(function (_, index) {
              var values = shape[1].slice();
              values[index] = invalid;
              assert.throws(function () {
                context[shape[0]](...values, options);
              }, /finite/);
            });
            assert.throws(function () {
              context[shape[0]](...shape[1], { color: "red", width: invalid });
            }, /finite/);
          });
          for (var index = 0; index < 4; ++index) {
            var points = [
              [10, 20],
              [30, 40],
            ];
            points[Math.floor(index / 2)][index % 2] = invalid;
            assert.throws(function () {
              context.drawPath(points, options);
            }, /finite/);
          }
          assert.throws(function () {
            context.writeText("rejected", invalid, 20, {
              font: font,
              color: "red",
            });
          });
          assert.throws(function () {
            context.writeText("rejected", 10, invalid, {
              font: font,
              color: "red",
            });
          });
          assert.throws(function () {
            context.writeText("rejected", 10, 20, {
              font: font,
              size: invalid,
              color: "red",
            });
          });
        });
        [
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
        ].forEach(function (args) {
          assert.throws(function () {
            context.drawPath(...args);
          });
        });
        for (var center of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
          for (var radius of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
            assert.throws(function () {
              context.drawCircle(center, 0, radius, options);
            }, /finite/);
            assert.throws(function () {
              context.drawCircle(0, center, radius, options);
            }, /finite/);
          }
        }
        assert.throws(function () {
          context.writeText("MMMMMMMM", Number.MAX_VALUE, 20, {
            font: font,
            size: Number.MAX_VALUE,
            underline: true,
            color: "red",
          });
        }, /finite/);
        context.Q().drawRectangle(1, 2, 3, 4, {});
        var output = target.finish();
        assert.match(output, /stream\r?\nq\s+Q\s+1 2 3 4 re\s+S/);
        assert.doesNotMatch(output, /\b(?:nan|[-+]?inf(?:inity)?)\b/i);
      },
    );

    it("preserves finite numeric coercion on " + mode, function () {
      var assert = require("assert");
      var target = drawingTarget(mode);
      target.context.drawRectangle("1", "2", "3", "4", { width: "2" });
      target.context.drawPath("10", "20", "30", "40", {});
      var output = target.finish();
      assert.match(output, /2 w\s+1 2 3 4 re\s+S/);
      assert.match(output, /10 20 m\s+30 40 l\s+S/);
    });

    it("snapshots path coordinates before output on " + mode, function () {
      var assert = require("assert");
      var target = drawingTarget(mode);
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
    });

    it("validates all shapes and text before output on " + mode, function () {
      var assert = require("assert");
      var target = drawingTarget(mode);
      var context = target.context;
      var font = target.writer.getFontForFile(
        path.join(__dirname, "TestMaterials/fonts/arial.ttf"),
      );
      var failure = new Error("conversion sentinel");
      var invalid = {
        /** Fail numeric/string conversion with the original exception. */
        valueOf: function () {
          throw failure;
        },
        /** Fail string conversion with the original exception. */
        toString: function () {
          throw failure;
        },
      };
      context.q();
      [
        ["drawCircle", [10, 20, 5]],
        ["drawSquare", [10, 20, 5]],
        ["drawRectangle", [10, 20, 5, 6]],
      ].forEach(function (shape) {
        shape[1].forEach(function (_, index) {
          var values = shape[1].slice();
          values[index] = invalid;
          assert.throws(
            function () {
              context[shape[0]].apply(context, values.concat({ color: "red" }));
            },
            function (error) {
              return error === failure;
            },
          );
        });
        ["color", "width", "type", "close"].forEach(function (key) {
          var options = { color: "red", width: 2 };
          Object.defineProperty(options, key, {
            get: function () {
              throw failure;
            },
          });
          assert.throws(
            function () {
              context[shape[0]].apply(context, shape[1].concat(options));
            },
            function (error) {
              return error === failure;
            },
          );
        });
      });
      [0, 1, 2].forEach(function (index) {
        var values = ["text", 10, 20];
        values[index] = invalid;
        assert.throws(
          function () {
            context.writeText.apply(context, values.concat({ font: font }));
          },
          function (error) {
            return error === failure;
          },
        );
      });
      ["font", "size", "color", "underline"].forEach(function (key) {
        var options = { font: font, size: 12, color: "red" };
        Object.defineProperty(options, key, {
          get: function () {
            throw failure;
          },
        });
        assert.throws(
          function () {
            context.writeText("text", 10, 20, options);
          },
          function (error) {
            return error === failure;
          },
        );
      });
      ["font", "size", "color"].forEach(function (key) {
        var reads = 0;
        var options = { font: font, size: 12, color: "red", underline: true };
        var value = options[key];
        Object.defineProperty(options, key, {
          get: function () {
            if (++reads === 2) throw failure;
            return value;
          },
        });
        assert.throws(
          function () {
            context.writeText("text", 10, 20, options);
          },
          function (error) {
            return error === failure;
          },
        );
      });
      context.Q().drawRectangle(1, 2, 3, 4, {});
      assert.match(target.finish(), /stream\r?\nq\s+Q\s+1 2 3 4 re\s+S/);
    });

    it(
      "clips without painting and rejects unknown path types on " + mode,
      function () {
        var assert = require("assert");
        var target = drawingTarget(mode);
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
          .Q();
        assert.throws(
          () => context.drawRectangle(1, 2, 3, 4, { type: "clipp" }),
          TypeError,
        );
        context.drawRectangle(5, 6, 7, 8, { type: "fill" });
        var output = target.finish();
        assert.equal((output.match(/\bW\s+n\b/g) || []).length, 4);
        assert.match(output, /10 20 30 40 re\s+W\s+n/);
        assert.match(output, /10 20 30 30 re\s+h\s+W\s+n/);
        assert.doesNotMatch(output, /1 2 3 4 re/);
        assert.match(output, /Q\s+5 6 7 8 re\s+f/);
      },
    );
  });

  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      outputPath,
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);

    var textOptions = {
      font: pdfWriter.getFontForFile(
        __dirname + "/TestMaterials/fonts/arial.ttf",
      ),
      size: 14,
      colorspace: "gray",
      color: 0x00,
      underline: true,
    };

    var pathFillOptions = {
      color: 0xff000000,
      colorspace: "cmyk",
      type: "fill",
    };
    var pathStrokeOptions = { color: "DarkMagenta", width: 4 };

    // drawPath
    cxt
      .drawPath(
        [
          [75, 640],
          [149, 800],
          [225, 640],
        ],
        pathFillOptions,
      )
      .drawPath(
        75,
        540,
        110,
        440,
        149,
        540,
        188,
        440,
        223,
        540,
        pathStrokeOptions,
      );

    // drawSquare
    cxt
      .drawSquare(375, 640, 120, pathFillOptions)
      .drawSquare(375, 440, 120, pathStrokeOptions);

    // drawRectangle
    cxt
      .drawRectangle(375, 220, 50, 160, pathFillOptions)
      .drawRectangle(375, 10, 50, 160, pathStrokeOptions);

    // drawCircle
    cxt
      .drawCircle(149, 300, 80, pathFillOptions)
      .drawCircle(149, 90, 80, pathStrokeOptions);

    // writeText (writing labels for each of the shapes)
    cxt
      .writeText("Paths", 75, 805, textOptions)
      .writeText("Squares", 375, 805, textOptions)
      .writeText("Rectangles", 375, 400, textOptions)
      .writeText("Circles", 75, 400, textOptions);

    cxt
      .q()
      .setOpacity(0.5)
      .writeText("Transparent", 75, 370, textOptions)
      .Q()
      .writeText("Opaque", 75, 350, textOptions);

    pdfWriter.writePage(page);
    pdfWriter.end();

    var pdf = fs.readFileSync(outputPath, "latin1");
    expect(pdf).to.contain("/ca 0.5");
    expect(pdf).to.contain("/CA 0.5");
  });

  it("should reject invalid opacity values", function () {
    var tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "muhammara-opacity-"),
    );
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      path.join(tempDirectory, "invalid-opacity.pdf"),
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);

    try {
      expect(function () {
        cxt.setOpacity();
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity("0.5");
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(NaN);
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(-0.1);
      }).to.throw("opacity value between 0 and 1");
      expect(function () {
        cxt.setOpacity(1.1);
      }).to.throw("opacity value between 0 and 1");

      pdfWriter.writePage(page);
      pdfWriter.end();
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("does not emit partial drawPath operators", function () {
    var invalidPath = path.join(
      os.tmpdir(),
      "muhammara-invalid-composite-path.pdf",
    );
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      invalidPath,
      { compress: false },
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var cxt = pdfWriter.startPageContentContext(page);

    var optionReads = [];
    expect(function () {
      cxt.drawPath(
        [
          [10, 20],
          [Symbol("invalid x"), 40],
        ],
        {},
      );
    }).to.throw(TypeError);
    expect(function () {
      cxt.drawPath(
        [
          [50, 60],
          [70, 80],
        ],
        {
          get color() {
            optionReads.push("color");
            return "red";
          },
          get width() {
            optionReads.push("width");
            return Symbol("invalid width");
          },
        },
      );
    }).to.throw(TypeError);
    expect(optionReads).to.deep.equal(["color", "width"]);
    expect(function () {
      cxt.drawPath(90, 100, 110, 120, { color: Symbol("invalid color") });
    }).to.throw(TypeError);
    expect(function () {
      cxt.drawPath(130, 140, 150, 160, {
        color: "blue",
        get close() {
          throw new Error("invalid close");
        },
      });
    }).to.throw("invalid close");
    var typeReads = 0;
    expect(function () {
      cxt.drawPath(170, 180, 190, 200, {
        get type() {
          if (++typeReads === 2) throw new Error("invalid type");
          return "stroke";
        },
      });
    }).to.throw("invalid type");
    pdfWriter.writePage(page);
    pdfWriter.end();

    try {
      var contents = fs.readFileSync(invalidPath, "latin1");
      expect(contents).not.to.contain("10 20 m");
      expect(contents).not.to.contain("1 0 0 RG");
      expect(contents).not.to.contain("90 100 m");
      expect(contents).not.to.contain("130 140 m");
      expect(contents).not.to.contain("170 180 m");
      expect(contents).not.to.contain("0 0 1 RG");
    } finally {
      fs.rmSync(invalidPath, { force: true });
    }
  });
});
