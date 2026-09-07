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

  describe("recryptAsync", function () {
    var fs = require("fs");

    it("strips a password from a path and resolves", async function () {
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptAsyncToNothing.PDF",
        {
          password: "user",
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncToNothing.PDF",
        undefined,
        false,
      );
    });

    it("encrypts a path with a different password", async function () {
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptAsyncDifferentPassword.PDF",
        {
          password: "user",
          userPassword: "newPassword",
          ownerPassword: "newOwner",
          userProtectionFlag: 4,
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncDifferentPassword.PDF",
        "newPassword",
        true,
      );
    });

    it("encrypts a previously unencrypted PDF", async function () {
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptAsyncEncrypted.pdf",
        {
          userPassword: "user",
          ownerPassword: "owner",
          userProtectionFlag: 4,
        },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncEncrypted.pdf",
        "user",
        true,
      );
    });

    it("encrypts from a Buffer source through stream objects", async function () {
      var source = fs.readFileSync(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
      );
      var target = new muhammara.PDFWStreamForFile(
        __dirname + "/output/RecryptAsyncFromBuffer.PDF",
      );

      await muhammara.recryptAsync(
        new muhammara.PDFRStreamForBuffer(source),
        target,
        {
          password: "user",
          userPassword: "user",
          ownerPassword: "owner",
          userProtectionFlag: 4,
        },
      );
      await new Promise(function (resolve) {
        target.close(resolve);
      });

      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncFromBuffer.PDF",
        "user",
        true,
      );
    });

    it("produces the same document as the synchronous recrypt", async function () {
      var options = { password: "user" };
      muhammara.recrypt(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptParitySync.PDF",
        options,
      );
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/PDFWithPassword.PDF",
        __dirname + "/output/RecryptParityAsync.PDF",
        options,
      );

      var syncReader = muhammara.createReader(
        __dirname + "/output/RecryptParitySync.PDF",
      );
      var asyncReader = muhammara.createReader(
        __dirname + "/output/RecryptParityAsync.PDF",
      );
      try {
        assert.equal(
          asyncReader.getPagesCount(),
          syncReader.getPagesCount(),
          "page count should match the synchronous result",
        );
        assert.equal(asyncReader.isEncrypted(), syncReader.isEncrypted());
      } finally {
        syncReader.end();
        asyncReader.end();
      }
    });

    it("rejects instead of throwing when the source cannot be read", async function () {
      await assert.rejects(
        muhammara.recryptAsync(
          __dirname + "/TestMaterials/DoesNotExist.pdf",
          __dirname + "/output/RecryptAsyncMissingSource.pdf",
        ),
        /Unable to recrypt files/,
      );
    });

    it("rejects when the input password is wrong", async function () {
      await assert.rejects(
        muhammara.recryptAsync(
          __dirname + "/TestMaterials/PDFWithPassword.PDF",
          __dirname + "/output/RecryptAsyncWrongPassword.pdf",
          { password: "definitely-not-the-password" },
        ),
        /Unable to recrypt files/,
      );
    });

    it("throws synchronously on bad arguments, like recrypt does", function () {
      assert.throws(function () {
        muhammara.recryptAsync(__dirname + "/TestMaterials/Original.pdf");
      }, /Wrong number of arguments/);

      assert.throws(function () {
        muhammara.recryptAsync(
          __dirname + "/TestMaterials/Original.pdf",
          new muhammara.PDFWStreamForFile(
            __dirname + "/output/RecryptAsyncMixed.pdf",
          ),
        );
      }, /please either provide two paths or two stream objects/);
    });

    it("runs concurrent calls to completion", async function () {
      var targets = [
        __dirname + "/output/RecryptAsyncConcurrentA.pdf",
        __dirname + "/output/RecryptAsyncConcurrentB.pdf",
        __dirname + "/output/RecryptAsyncConcurrentC.pdf",
      ];

      await Promise.all(
        targets.map(function (target) {
          return muhammara.recryptAsync(
            __dirname + "/TestMaterials/PDFWithPassword.PDF",
            target,
            { password: "user", userPassword: "user" },
          );
        }),
      );

      targets.forEach(function (target) {
        assertRecryptedPdf(target, "user", true);
      });
    });

    it("finishes another job while one native recrypt is blocked on input", async function () {
      if (
        process.platform !== "linux" ||
        Number(process.env.UV_THREADPOOL_SIZE || 4) < 2
      ) {
        this.skip();
      }
      var path = require("path");
      var directory = fs.mkdtempSync(
        path.join(__dirname, "output/recrypt-overlap-"),
      );
      var fifo = path.join(directory, "source.fifo");
      require("child_process").execFileSync("mkfifo", [fifo]);
      var blocked = assert.rejects(
        muhammara.recryptAsync(fifo, path.join(directory, "blocked.pdf")),
        /Unable to recrypt files/,
      );
      var fd;
      var timer;
      try {
        // ENXIO means the native reader has not opened the FIFO yet. Keeping
        // the writer open after this handshake blocks its first read, not JS.
        var deadline = Date.now() + 5000;
        while (fd === undefined) {
          try {
            fd = fs.openSync(
              fifo,
              fs.constants.O_WRONLY | fs.constants.O_NONBLOCK,
            );
          } catch (error) {
            if (error.code !== "ENXIO" || Date.now() > deadline) throw error;
            await new Promise(function (resolve) {
              setTimeout(resolve, 5);
            });
          }
        }
        var target = path.join(directory, "independent.pdf");
        await Promise.race([
          muhammara.recryptAsync(
            __dirname + "/TestMaterials/Original.pdf",
            target,
          ),
          new Promise(function (_, reject) {
            timer = setTimeout(function () {
              reject(
                new Error("A blocked recrypt serialized an independent job"),
              );
            }, 5000);
          }),
        ]);
        assertRecryptedPdf(target, undefined, false);
      } finally {
        clearTimeout(timer);
        if (fd === undefined)
          fd = fs.openSync(fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
        fs.closeSync(fd);
        await blocked;
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it("keeps parallel passwords and main-thread writing independent", async function () {
      var jobs = Array.from({ length: 16 }, function (_, index) {
        var target = __dirname + "/output/RecryptParallel-" + index + ".pdf";
        var password = "parallel-password-" + index;
        return muhammara
          .recryptAsync(__dirname + "/TestMaterials/Original.pdf", target, {
            userPassword: password,
            ownerPassword: "owner-" + index,
            version: [
              muhammara.ePDFVersion14,
              muhammara.ePDFVersion17,
              muhammara.ePDFVersion20,
            ][index % 3],
            compress: index % 2 === 0,
            log: __dirname + "/output/RecryptParallel-" + index + ".log",
          })
          .then(function () {
            assertRecryptedPdf(target, password, true);
          });
      });
      var mainOutput = __dirname + "/output/RecryptParallelMain.pdf";
      var writer = muhammara.createWriter(mainOutput, {
        log: __dirname + "/output/RecryptParallelMain.log",
      });
      writer.writePage(writer.createPage(0, 0, 200, 200));
      writer.end();
      await Promise.all(jobs);
      assertRecryptedPdf(mainOutput, undefined, false);
    });

    it("routes early errors to each job's log and clears reused thread settings", async function () {
      var logs = Array.from({ length: 16 }, function (_, index) {
        return __dirname + "/output/RecryptError-" + index + ".log";
      });
      logs.forEach(function (log) {
        fs.rmSync(log, { force: true });
      });
      await Promise.all(
        logs.map(function (log, index) {
          return assert.rejects(
            muhammara.recryptAsync(
              __dirname + "/output/MissingRecryptJob-" + index + ".pdf",
              __dirname + "/output/RecryptError-" + index + ".pdf",
              { log: log },
            ),
            /Unable to recrypt files/,
          );
        }),
      );
      var contents = logs.map(function (log, index) {
        var text = fs.readFileSync(log, "utf8");
        assert.ok(text.includes("MissingRecryptJob-" + index + ".pdf"));
        assert.equal((text.match(/MissingRecryptJob-/g) || []).length, 1);
        return text;
      });
      await Promise.all(
        logs.map(function (_, index) {
          return assert.rejects(
            muhammara.recryptAsync(
              __dirname + "/output/MissingUnloggedJob-" + index + ".pdf",
              __dirname + "/output/RecryptUnlogged-" + index + ".pdf",
            ),
            /Unable to recrypt files/,
          );
        }),
      );
      logs.forEach(function (log, index) {
        assert.equal(fs.readFileSync(log, "utf8"), contents[index]);
      });
    });

    it("leaves the event loop free while the synchronous call blocks it", async function () {
      // A single small fixture recrypts too fast to observe, so build a bigger
      // one first. Appending the same document repeatedly is enough.
      var big = __dirname + "/output/RecryptAsyncLargeSource.pdf";
      var writer = muhammara.createWriter(big);
      for (var i = 0; i < 12; i++) {
        writer.appendPDFPagesFromPDF(
          __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        );
      }
      writer.end();

      async function countTicksDuring(run) {
        var ticks = 0;
        var timer = setInterval(function () {
          ticks += 1;
        }, 2);
        try {
          await run();
          return ticks;
        } finally {
          clearInterval(timer);
        }
      }

      var syncTicks = await countTicksDuring(function () {
        muhammara.recrypt(big, __dirname + "/output/RecryptAsyncLoopSync.pdf", {
          userPassword: "user",
        });
      });

      var asyncTicks = await countTicksDuring(function () {
        return muhammara.recryptAsync(
          big,
          __dirname + "/output/RecryptAsyncLoopAsync.pdf",
          {
            userPassword: "user",
          },
        );
      });

      assert.equal(
        syncTicks,
        0,
        "the synchronous recrypt is expected to block the event loop entirely",
      );
      assert.ok(
        asyncTicks > 0,
        "recryptAsync should let timers run while it works, got " +
          asyncTicks +
          " ticks",
      );
    });
  });

  describe("Recipe.endPDFAsync", function () {
    it("finalizes independent encrypted Recipes concurrently", async function () {
      await Promise.all(
        Array.from({ length: 8 }, async function (_, index) {
          var output = __dirname + "/output/RecipeParallel-" + index + ".pdf";
          var password = "recipe-" + index;
          var recipe = new muhammara.Recipe("new", output);
          recipe.createPage(200, 200).text(password, 20, 20).endPage();
          recipe.encrypt({ userPassword: password });
          await recipe.endPDFAsync();
          assertRecryptedPdf(output, password, true);
        }),
      );
    });

    it("encrypts without blocking and resolves", async function () {
      var output = __dirname + "/output/RecipeEndPDFAsync.pdf";
      var recipe = new muhammara.Recipe("new", output);
      recipe
        .createPage(595, 842)
        .text("encrypted asynchronously", 50, 50)
        .endPage();
      recipe.encrypt({
        userPassword: "user",
        ownerPassword: "owner",
        userProtectionFlag: 4,
      });

      var result = await recipe.endPDFAsync();
      assert.equal(result, undefined);
      assertRecryptedPdf(output, "user", true);
    });

    it("ends a document that needs no encryption", async function () {
      var output = __dirname + "/output/RecipeEndPDFAsyncPlain.pdf";
      var recipe = new muhammara.Recipe("new", output);
      recipe.createPage(595, 842).text("no encryption", 50, 50).endPage();

      await recipe.endPDFAsync();
      assertRecryptedPdf(output, undefined, false);
    });
  });
});
