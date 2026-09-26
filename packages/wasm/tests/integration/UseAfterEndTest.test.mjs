import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("UseAfterEndTest", function () {
  ["end", "dispose", "failed-end"].forEach(function (mode) {
    it("rejects stateful writer calls after " + mode, async function () {
      var muhammara = await createMuhammaraWasm(
        mode === "failed-end" ? { limits: { maxOutputBytes: 10 } } : {},
      );
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 200, 200);
      var context = writer.startPageContentContext(page);
      context.re(10, 10, 20, 20).f();
      writer.writePage(page);
      if (mode === "failed-end") {
        assert.throws(function () {
          writer.end();
        }, /maxOutputBytes/);
      } else {
        writer[mode]();
      }
      try {
        var calls = {
          createPage: [0, 0, 200, 200],
          startPageContentContext: [page],
          pausePageContentContext: [context],
          writePage: [page],
          writePageAndReturnID: [page],
        };
        var independent = [
          "end",
          "dispose",
          "createPDFDate",
          "createPDFTextString",
        ];
        for (var name of Object.keys(writer)) {
          if (independent.includes(name)) continue;
          if (name.endsWith("Async")) {
            var result;
            assert.doesNotThrow(function () {
              result = writer[name]();
            });
            await assert.rejects(result, {
              name: "Error",
              message: "PDF writer has ended",
            });
          } else {
            assert.throws(
              function () {
                writer[name](...(calls[name] || []));
              },
              { name: "Error", message: "PDF writer has ended" },
              name,
            );
          }
        }
        assert.equal(
          writer.createPDFTextString("still valid").toString(),
          "still valid",
        );
        assert.ok(writer.createPDFDate());
      } finally {
        writer.dispose();
      }
    });
  });

  it("rejects font use and keeps value constructors after writers and modifiers end", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "use-after-end",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    try {
      var writer = muhammara.createWriter();
      var modifier = muhammara.createWriterToModify(
        muhammara.createBlankPdf(10, 10),
      );
      var fonts = [writer, modifier].map((target) =>
        target.getFontForBytes("use-after-end"),
      );
      writer.writePage(writer.createPage(0, 0, 10, 10));
      writer.end();
      modifier.end();
      for (var font of fonts) {
        assert.throws(() => font.calculateTextDimensions("a", 10), {
          name: "Error",
          message: "PDF writer has ended",
        });
        assert.throws(() => font.getFontMetrics(10), {
          name: "Error",
          message: "PDF writer has ended",
        });
      }
      assert.equal(modifier.createPDFTextString("kept").toString(), "kept");
      assert.equal(modifier.createPDFDate().toString(), "");
    } finally {
      muhammara.unregisterFont("use-after-end");
    }
  });

  it("rejects copying context use after its writer is disposed", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 200, 200));
    var source = sourceWriter.end();
    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);

    writer.dispose();

    assert.throws(
      function () {
        copying.appendPDFPageFromPDF(0);
      },
      { name: "Error", message: "PDF writer has ended" },
    );
  });
});
