var assert = require("chai").assert;
var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
require.cache[require.resolve("@muhammara/native")] = { exports: muhammara };
var examples = require("../../../native/docs/examples/recrypt-without-blocking");

var fontPath = path.join(
  __dirname,
  "../../tests/TestMaterials/fonts/arial.ttf",
);

function writeSourcePdf(sourcePath) {
  var writer = muhammara.createWriter(sourcePath);
  var page = writer.createPage(0, 0, 200, 200);

  writer
    .startPageContentContext(page)
    .BT()
    .Tf(writer.getFontForFile(fontPath), 12)
    .Tm(1, 0, 0, 1, 20, 30)
    .Tj("Secret")
    .ET();
  writer.writePage(page);
  writer.end();
}

function assertEncrypted(filePath, password) {
  var reader = muhammara.createReader(filePath, { password: password });
  try {
    assert.isTrue(reader.isEncrypted());
    assert.isAbove(reader.getPagesCount(), 0);
  } finally {
    reader.end();
  }
}

describe("docs/how-to/change-pdf-passwords", function () {
  var workingDirectory;

  beforeEach(function () {
    workingDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "muhammara-docs-"),
    );
  });

  afterEach(function () {
    fs.rmSync(workingDirectory, { recursive: true, force: true });
  });

  it("recrypts a file without blocking", async function () {
    var sourcePath = path.join(workingDirectory, "source.pdf");
    var outputPath = path.join(workingDirectory, "encrypted.pdf");
    writeSourcePdf(sourcePath);

    var result = await examples.recryptWithoutBlocking(sourcePath, outputPath, {
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });

    assert.equal(result, outputPath);
    assertEncrypted(outputPath, "user");
  });

  it("recrypts a Buffer without blocking", async function () {
    var sourcePath = path.join(workingDirectory, "source.pdf");
    var outputPath = path.join(workingDirectory, "encrypted-buffer.pdf");
    writeSourcePdf(sourcePath);

    await examples.recryptBufferWithoutBlocking(
      fs.readFileSync(sourcePath),
      outputPath,
      { userPassword: "user" },
    );

    assertEncrypted(outputPath, "user");
  });

  it("ends a Recipe with encryption without blocking", async function () {
    var outputPath = path.join(workingDirectory, "recipe.pdf");

    await examples.encryptRecipeWithoutBlocking(outputPath, {
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });

    assertEncrypted(outputPath, "user");
  });
});
