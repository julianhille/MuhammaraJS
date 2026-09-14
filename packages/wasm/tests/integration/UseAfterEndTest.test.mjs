import assert from "node:assert/strict";
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
});
