var muhammara = require("@muhammara/native-with-source");
var assert = require("assert");

function assertRecryptedPdf(filePath, password, encrypted) {
  var reader = muhammara.createReader(filePath, password ? { password } : {});
  try {
    assert.equal(reader.isEncrypted(), encrypted);
    assert.ok(reader.getPagesCount() > 0);
  } finally {
    reader.end();
  }
}

describe("Xcryption", function () {
  describe("Strip PDF From Password", function () {
    it("should complete without error", function () {
      muhammara.recrypt(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptPDFWithPasswordToNothing.PDF",
        {
          password: "user",
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptPDFWithPasswordToNothing.PDF",
        undefined,
        false,
      );
    });
  });

  describe("Encrypt PDF With a Password as stream from Buffer", function () {
    it("writes an encrypted readable PDF", function (done) {
      var fs = require("fs");
      var result = fs.readFileSync(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
      );
      var source = new muhammara.PDFRStreamForBuffer(result);
      var target = new muhammara.PDFWStreamForFile(
        __dirname + "/output/RecryptPDFOriginalToPasswordProtectedBuffer.PDF",
      );
      muhammara.recrypt(source, target, {
        password: "user",
        userPassword: "user1",
        ownerPassword: "owner1",
        userProtectionFlag: 4,
      });
      target.close(function () {
        assertRecryptedPdf(
          __dirname + "/output/RecryptPDFOriginalToPasswordProtectedBuffer.PDF",
          "user1",
          true,
        );
        done();
      });
    });
  });

  describe("Encrypt PDF With a Password as stream", function () {
    it("writes an encrypted readable PDF", function (done) {
      var source = new muhammara.PDFRStreamForFile(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
      );
      var target = new muhammara.PDFWStreamForFile(
        __dirname + "/output/RecryptPDFOriginalToPasswordProtectedStream.PDF",
      );
      muhammara.recrypt(source, target, {
        password: "user",
        userPassword: "user1",
        ownerPassword: "owner1",
        userProtectionFlag: 4,
      });
      target.close(function () {
        assertRecryptedPdf(
          __dirname + "/output/RecryptPDFOriginalToPasswordProtectedStream.PDF",
          "user1",
          true,
        );
        done();
      });
    });
  });

  describe("Encrypt PDF With a Different Password", function () {
    it("should complete without error", function () {
      muhammara.recrypt(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptPDFWithPasswordToNewPassword.PDF",
        {
          password: "user",
          userPassword: "user1",
          ownerPassword: "owner1",
          userProtectionFlag: 4,
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptPDFWithPasswordToNewPassword.PDF",
        "user1",
        true,
      );
    });
  });

  describe("Encrypt PDF With a Password", function () {
    it("should complete without error", function () {
      muhammara.recrypt(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptPDFOriginalToPasswordProtected.PDF",
        {
          userPassword: "user1",
          ownerPassword: "owner1",
          userProtectionFlag: 4,
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptPDFOriginalToPasswordProtected.PDF",
        "user1",
        true,
      );
    });
  });

  describe("Create a PDF With a Password", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/PDFWithPassword.pdf",
        {
          userPassword: "user",
          ownerPassword: "owner",
          userProtectionFlag: 4,
        },
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter
        .startPageContentContext(page)
        .drawImage(
          10,
          100,
          __dirname + "/TestMaterials/images/soundcloud_logo.jpg",
        )
        .writeText("Hello", 10, 50, {
          font: pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          size: 14,
          colorspace: "gray",
          color: 0x00,
        });

      pdfWriter.writePage(page);
      pdfWriter.end();
      assertRecryptedPdf(
        __dirname + "/output/PDFWithPassword.pdf",
        "user",
        true,
      );
    });
  });

  describe("Create a PDF With a Password, encrypted with AES", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/PDFWithPasswordAES.pdf",
        {
          userPassword: "user",
          ownerPassword: "owner",
          userProtectionFlag: 4,
          version: muhammara.ePDFVersion16,
        },
      );
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter
        .startPageContentContext(page)
        .drawImage(
          10,
          100,
          __dirname + "/TestMaterials/images/soundcloud_logo.jpg",
        )
        .writeText("Hello", 10, 50, {
          font: pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          size: 14,
          colorspace: "gray",
          color: 0x00,
        });

      pdfWriter.writePage(page);
      pdfWriter.end();
      assertRecryptedPdf(
        __dirname + "/output/PDFWithPasswordAES.pdf",
        "user",
        true,
      );
    });
  });

  describe("Decrypt PDF via Appending Pages to New PDF", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriter(
        __dirname + "/output/PDFWithPasswordDecrypted.pdf",
      );
      var copyingContext = pdfWriter.createPDFCopyingContext(
        __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
      );
      for (
        var i = 0;
        i < copyingContext.getSourceDocumentParser().getPagesCount();
        ++i
      ) {
        copyingContext.appendPDFPageFromPDF(i);
      }
      copyingContext.end();
      pdfWriter.end();
      assertRecryptedPdf(
        __dirname + "/output/PDFWithPasswordDecrypted.pdf",
        undefined,
        false,
      );
    });
  });

  describe("Modify encrypted document", function () {
    it("should complete without error", function () {
      var pdfWriter = muhammara.createWriterToModify(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        {
          modifiedFilePath: __dirname + "/output/PDFWithPasswordModified.pdf",
          userPassword: "user",
        },
      );

      // modify first page to include text
      var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
      pageModifier
        .startContext()
        .getContext()
        .writeText("new text on encrypted page", 10, 805, {
          font: pdfWriter.getFontForFile(
            __dirname + "/TestMaterials/fonts/arial.ttf",
          ),
          size: 14,
          colorspace: "gray",
          color: 0x00,
        });

      pageModifier.endContext().writePage();

      // add new page with an image
      var page = pdfWriter.createPage(0, 0, 595, 842);

      pdfWriter
        .startPageContentContext(page)
        .drawImage(
          10,
          300,
          __dirname + "/TestMaterials/images/soundcloud_logo.jpg",
        );

      pdfWriter.writePage(page);

      pdfWriter.end();
      assertRecryptedPdf(
        __dirname + "/output/PDFWithPasswordModified.pdf",
        "user",
        true,
      );
    });
  });
});
