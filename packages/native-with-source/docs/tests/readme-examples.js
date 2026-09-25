var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

var packagesRoot = path.join(__dirname, "../../..");

/**
 * Extracts the JavaScript code blocks from a package README.
 *
 * @param {string} packageName Directory name below `packages/`.
 * @returns {string[]} Code block bodies in document order.
 */
function readmeExamples(packageName) {
  var readme = fs.readFileSync(
    path.join(packagesRoot, packageName, "README.md"),
    "utf8",
  );
  return Array.from(readme.matchAll(/```js\n([\s\S]*?)```/g), function (match) {
    return match[1];
  });
}

/**
 * Creates a one-page PDF to use as README example input.
 *
 * @returns {Buffer} PDF bytes.
 */
function inputPdf() {
  new muhammara.Recipe("new", "input.pdf").createPage("A4").endPage().endPDF();
  return fs.readFileSync("input.pdf");
}

["native", "native-with-source"].forEach(function (packageName) {
  describe("@muhammara/" + packageName + " README examples", function () {
    var previousCwd;
    var workDir;

    beforeEach(function () {
      previousCwd = process.cwd();
      workDir = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-readme-"));
      process.chdir(workDir);
    });

    afterEach(function () {
      process.chdir(previousCwd);
      fs.rmSync(workDir, { recursive: true, force: true });
    });

    readmeExamples(packageName).forEach(function (source, index) {
      it("runs example " + (index + 1) + " and produces a PDF", function () {
        var results = new Function(
          "require",
          "inputBuffer",
          source +
            "\nreturn [typeof output === 'undefined' ? undefined : output," +
            " typeof pdfBuffer === 'undefined' ? undefined : pdfBuffer];",
        )(function (id) {
          assert.equal(id, "@muhammara/" + packageName);
          return muhammara;
        }, inputPdf());
        var pdf =
          results[0] ||
          results[1] ||
          fs.readFileSync(path.join(workDir, "hello.pdf"));

        assert.isTrue(Buffer.isBuffer(pdf));
        assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
        assert.equal(
          muhammara
            .createReader(new muhammara.PDFRStreamForBuffer(pdf))
            .getPagesCount(),
          1,
        );
      });
    });
  });
});
