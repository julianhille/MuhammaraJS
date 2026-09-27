var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");

/**
 * Runs garbage collection and lets pending native finalizers run.
 *
 * @returns {Promise<void>} Resolves after the finalizers had a chance to run.
 */
async function collectGarbage() {
  for (var i = 0; i < 5; i++) {
    global.gc();
    await new Promise(function (resolve) {
      setTimeout(resolve, 10);
    });
  }
}

/**
 * Starts a form with some content and never ends it.
 *
 * @param {object} pdfWriter The writer to start the form on.
 * @returns {object} The unfinished form.
 */
function startUnfinishedForm(pdfWriter) {
  var form = pdfWriter.createFormXObject(0, 0, 10, 10);
  form.getContentContext().re(0, 0, 10, 10).f();
  return form;
}

describe("FormXObjectTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/XObjectContent.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var pageContent = pdfWriter.startPageContentContext(page);

    pageContent.q().k(100, 0, 0, 0).re(100, 500, 100, 100).f().Q();

    pdfWriter.pausePageContentContext(pageContent);

    // define a form
    var xobjectForm = pdfWriter.createFormXObject(0, 0, 200, 100);
    xobjectForm
      .getContentContext()
      .q()
      .k(0, 100, 100, 0)
      .re(0, 0, 200, 100)
      .f()
      .Q();
    pdfWriter.endFormXObject(xobjectForm);

    // continue page content, and use form
    pageContent
      .q()
      .cm(1, 0, 0, 1, 200, 600)
      .doXObject(xobjectForm)
      .Q()
      .q()
      .G(0.5)
      .w(3)
      .m(200, 600)
      .l(400, 400)
      .S()
      .Q()
      .q()
      .cm(1, 0, 0, 1, 200, 200)
      .doXObject(xobjectForm)
      .Q();

    pdfWriter.writePage(page);

    // 2nd page only uses the form
    var secondPage = pdfWriter.createPage(0, 0, 595, 842);

    pdfWriter
      .startPageContentContext(secondPage)
      .q()
      .cm(1, 0, 0, 1, 300, 500)
      .doXObject(xobjectForm)
      .Q();

    pdfWriter.writePage(secondPage);
    pdfWriter.end();
  });

  it("fails end() while a form is still open", function () {
    var pdfWriter = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    startUnfinishedForm(pdfWriter);
    assert.throws(function () {
      pdfWriter.end();
    }, /Unable to end PDF/);
  });

  it("releases an unfinished form collected before its writer", async function () {
    var pdfWriter = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    (function () {
      startUnfinishedForm(pdfWriter);
    })();
    await collectGarbage();
    assert.throws(function () {
      pdfWriter.end();
    }, /Unable to end PDF/);
  });

  it("releases an unfinished form collected after its writer", async function () {
    var forms = [];
    (function () {
      for (var i = 0; i < 20; i++) {
        forms.push(
          startUnfinishedForm(
            muhammara.createWriter(new muhammara.PDFWStreamForBuffer()),
          ),
        );
      }
    })();
    await collectGarbage();
    forms = null;
    await collectGarbage();
  });

  it("releases unfinished forms collected with their writers", async function () {
    (function () {
      for (var i = 0; i < 20; i++) {
        startUnfinishedForm(
          muhammara.createWriter(new muhammara.PDFWStreamForBuffer()),
        );
        startUnfinishedForm(
          muhammara.createWriter(new muhammara.PDFWStreamForBuffer(), {
            userPassword: "user",
            ownerPassword: "owner",
            userProtectionFlag: 4,
          }),
        );
      }
    })();
    await collectGarbage();
  });

  it("releases an unfinished form when its writer is aborted", function () {
    var pdfWriter = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var form = startUnfinishedForm(pdfWriter);
    pdfWriter._abort();
    assert.ok(form);
  });
});
