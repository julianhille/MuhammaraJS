var muhammara = require("@muhammara/native-with-source");
var assert = require("assert");
var { writeOutput } = require("./helpers/testOutput");

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

  // https://github.com/julianhille/MuhammaraJS/issues/324
  describe("Encrypt PDF into a JavaScript stream", function () {
    it("batches encrypted output instead of writing byte by byte", function () {
      var sourceWriter = new muhammara.PDFWStreamForBuffer();
      var writer = muhammara.createWriter(sourceWriter, { compress: false });
      for (var i = 0; i < 5; ++i) {
        var page = writer.createPage(0, 0, 595, 842);
        writer
          .startPageContentContext(page)
          .writeFreeCode("0 0 m 10 10 l S\n".repeat(5000));
        writer.writePage(page);
      }
      writer.end();
      writeOutput("Xcryption-stream-source", sourceWriter.buffer);

      var chunks = [];
      var position = 0;
      muhammara.recrypt(
        new muhammara.PDFRStreamForBuffer(sourceWriter.buffer),
        {
          write: function (bytes) {
            chunks.push(bytes);
            position += bytes.length;
            return bytes.length;
          },
          getCurrentPosition: function () {
            return position;
          },
        },
        { userPassword: "user1", ownerPassword: "owner1" },
      );

      writeOutput("Xcryption-stream-encrypted", Buffer.concat(chunks));
      // RC4 encrypts one byte per write; ~400 KB must not become ~400k calls.
      assert.ok(chunks.length < 100, chunks.length + " writes");
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(Buffer.concat(chunks)),
        { password: "user1" },
      );
      assert.equal(reader.isEncrypted(), true);
      assert.equal(reader.getPagesCount(), 5);
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

    it("settles jobs in the order they were started", async function () {
      var settled = [];
      await Promise.all(
        [0, 1, 2, 3].map(function (index) {
          return muhammara
            .recryptAsync(
              __dirname + "/TestMaterials/Original.pdf",
              __dirname + "/output/RecryptAsyncOrder-" + index + ".pdf",
            )
            .then(function () {
              settled.push(index);
            });
        }),
      );
      assert.deepEqual(settled, [0, 1, 2, 3]);
    });

    it("keeps waiting jobs off the libuv pool", async function () {
      if (process.platform === "win32") {
        this.skip();
      }
      var path = require("path");
      var directory = fs.mkdtempSync(
        path.join(__dirname, "output/recrypt-queue-"),
      );
      var fifo = path.join(directory, "source.fifo");
      require("child_process").execFileSync("mkfifo", [fifo]);
      // The first job blocks a pool thread reading the FIFO; the ones behind it
      // must wait in the queue, not on pool threads, or fs would starve.
      var blocked = assert.rejects(
        muhammara.recryptAsync(fifo, path.join(directory, "blocked.pdf")),
        /Unable to recrypt files/,
      );
      var waiting = Array.from({ length: 8 }, function (_, index) {
        return muhammara.recryptAsync(
          __dirname + "/TestMaterials/Original.pdf",
          path.join(directory, "waiting-" + index + ".pdf"),
        );
      });
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
        var reads = Array.from(
          { length: Number(process.env.UV_THREADPOOL_SIZE || 4) * 2 },
          function () {
            return fs.promises.readFile(
              __dirname + "/TestMaterials/Original.pdf",
            );
          },
        );
        await Promise.race([
          Promise.all(reads),
          new Promise(function (_, reject) {
            timer = setTimeout(function () {
              reject(new Error("Waiting recrypt jobs starved the libuv pool"));
            }, 5000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        if (fd === undefined)
          fd = fs.openSync(fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
        fs.closeSync(fd);
        await blocked;
        await Promise.all(waiting);
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it("rejects with the error a write stream throws", async function () {
      var failure = new Error("disk full");
      await assert.rejects(
        muhammara.recryptAsync(
          new muhammara.PDFRStreamForBuffer(
            fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
          ),
          {
            write: function () {
              throw failure;
            },
            getCurrentPosition: function () {
              return 0;
            },
          },
        ),
        function (error) {
          return error === failure;
        },
      );
    });

    it("does not run waiting jobs while a worker thread ends", async function () {
      this.timeout(60000);
      var path = require("path");
      var { Worker } = require("worker_threads");
      var directory = fs.mkdtempSync(
        path.join(__dirname, "output/recrypt-terminate-"),
      );
      var worker = new Worker(
        `
        const { parentPort, workerData } = require("worker_threads");
        const muhammara = require(workerData.module);
        for (let i = 0; i < 10; i++)
          muhammara.recryptAsync(
            workerData.source,
            workerData.directory + "/out-" + i + ".pdf",
            { userPassword: "worker" },
          );
        parentPort.postMessage("queued");
        `,
        {
          eval: true,
          workerData: {
            module: require.resolve("@muhammara/native-with-source"),
            source: __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
            directory: directory,
          },
        },
      );
      try {
        await new Promise(function (resolve, reject) {
          worker.once("message", resolve);
          worker.once("error", reject);
        });
        await worker.terminate();
        // The running job finishes; the ones behind it never start.
        assert.ok(fs.readdirSync(directory).length < 10);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it("writes offsets that match a stream with earlier bytes", async function () {
      var prefix = Buffer.from("%prefix written before the PDF\n");
      var source = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var syncTarget = new muhammara.PDFWStreamForBuffer();
      var asyncTarget = new muhammara.PDFWStreamForBuffer();
      syncTarget.write(prefix);
      asyncTarget.write(prefix);
      muhammara.recrypt(new muhammara.PDFRStreamForBuffer(source), syncTarget);
      await muhammara.recryptAsync(
        new muhammara.PDFRStreamForBuffer(source),
        asyncTarget,
      );
      var startxref = function (buffer) {
        return /startxref\s+(\d+)/.exec(
          buffer.toString("latin1").slice(-64),
        )[1];
      };
      assert.equal(startxref(asyncTarget.buffer), startxref(syncTarget.buffer));
    });

    it("returns a built-in promise when globalThis.Promise is replaced", async function () {
      var BuiltinPromise = Promise;
      var promise;
      global.Promise = function NotAPromise() {};
      try {
        promise = muhammara.recryptAsync(
          __dirname + "/TestMaterials/Original.pdf",
          __dirname + "/output/RecryptAsyncReplacedPromise.pdf",
        );
      } finally {
        global.Promise = BuiltinPromise;
      }
      assert.ok(promise instanceof BuiltinPromise);
      await promise;
    });

    it("resolves relative paths when it is called", async function () {
      var path = require("path");
      var original = process.cwd();
      process.chdir(__dirname);
      var target = "output/RecryptAsyncRelative.pdf";
      fs.rmSync(path.join(__dirname, target), { force: true });
      var promise;
      try {
        promise = muhammara.recryptAsync("TestMaterials/Original.pdf", target);
      } finally {
        process.chdir(original);
      }
      await promise;
      assertRecryptedPdf(path.join(__dirname, target), undefined, false);
    });

    it("rejects when the output stream moves while the job runs", async function () {
      var target = new muhammara.PDFWStreamForBuffer();
      var promise = muhammara.recryptAsync(
        new muhammara.PDFRStreamForBuffer(
          fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
        ),
        target,
      );
      target.write(Buffer.from("%written meanwhile\n"));
      await assert.rejects(promise, /written to while recryptAsync/);
    });

    it("resolves a relative log path when it is called", async function () {
      var path = require("path");
      var original = process.cwd();
      var log = path.join(__dirname, "output/RecryptAsyncRelative.log");
      fs.rmSync(log, { force: true });
      process.chdir(__dirname);
      var promise;
      try {
        promise = assert.rejects(
          muhammara.recryptAsync(
            "output/MissingRelativeLogSource.pdf",
            "output/RecryptAsyncRelativeLog.pdf",
            { log: "output/RecryptAsyncRelative.log" },
          ),
          /Unable to recrypt files/,
        );
      } finally {
        process.chdir(original);
      }
      await promise;
      assert.ok(
        fs.readFileSync(log, "utf8").includes("MissingRelativeLogSource"),
      );
    });

    it("lets a stream callback call recrypt() on the same thread", function () {
      var nested = __dirname + "/output/RecryptNestedInCallback.pdf";
      var inner = new muhammara.PDFWStreamForBuffer();
      var called = false;
      muhammara.recrypt(
        new muhammara.PDFRStreamForBuffer(
          fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
        ),
        {
          write: function (bytes) {
            if (!called) {
              called = true;
              muhammara.recrypt(
                __dirname + "/TestMaterials/Original.pdf",
                nested,
              );
            }
            return inner.write(bytes);
          },
          getCurrentPosition: function () {
            return inner.getCurrentPosition();
          },
        },
      );
      assert.ok(called);
      assertRecryptedPdf(nested, undefined, false);
    });

    it("exits cleanly when process.exit() runs during a job", function () {
      this.timeout(60000);
      var result = require("child_process").spawnSync(
        process.execPath,
        [
          "-e",
          `
          const muhammara = require(${JSON.stringify(require.resolve("@muhammara/native-with-source"))});
          for (let i = 0; i < 4; i++)
            muhammara.recryptAsync(
              ${JSON.stringify(__dirname + "/TestMaterials/BasicTIFFImagesTest.PDF")},
              ${JSON.stringify(__dirname + "/output/RecryptAsyncExit-")} + i + ".pdf",
              { userPassword: "exit", version: muhammara.ePDFVersion20 },
            );
          setTimeout(() => process.exit(0), 20);
          `,
        ],
        { encoding: "utf8" },
      );
      assert.equal(result.signal, null, result.stderr);
      assert.equal(result.status, 0, result.stderr);
    });

    it("drops waiting jobs when a worker thread ends", async function () {
      var { Worker } = require("worker_threads");
      var worker = new Worker(
        `
        const { parentPort } = require("worker_threads");
        const muhammara = require(${JSON.stringify(require.resolve("@muhammara/native-with-source"))});
        for (let i = 0; i < 6; i++)
          muhammara.recryptAsync(
            ${JSON.stringify(__dirname + "/TestMaterials/Original.pdf")},
            ${JSON.stringify(__dirname + "/output/RecryptAsyncWorker-")} + i + ".pdf",
            { userPassword: "worker" },
          );
        parentPort.postMessage("queued");
        `,
        { eval: true },
      );
      await new Promise(function (resolve, reject) {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      await worker.terminate();
      // The process must survive, and the addon must still work here.
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptAsyncAfterWorker.pdf",
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncAfterWorker.pdf",
        undefined,
        false,
      );
    });

    it("keeps queued passwords and main-thread writing independent", async function () {
      var jobs = Array.from({ length: 16 }, function (_, index) {
        var target = __dirname + "/output/RecryptQueued-" + index + ".pdf";
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
            log: __dirname + "/output/RecryptQueued-" + index + ".log",
          })
          .then(function () {
            assertRecryptedPdf(target, password, true);
          });
      });
      var mainOutput = __dirname + "/output/RecryptQueuedMain.pdf";
      var writer = muhammara.createWriter(mainOutput, {
        log: __dirname + "/output/RecryptQueuedMain.log",
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
      this.timeout(120000);
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

    it("reuses OpenSSL on pooled threads after successful and failed jobs", async function () {
      this.timeout(60000);
      var randomBytes = require("crypto").randomBytes;
      // PDF 2.0 initializes OpenSSL's per-thread RNG. Repeated batches exercise
      // cleanup and reinitialization; the sanitizer run checks process exit.
      for (var round = 0; round < 3; round++) {
        await Promise.all(
          Array.from({ length: 8 }, async function (_, index) {
            var target = __dirname + "/output/RecryptOpenSSL-" + index + ".pdf";
            var password = "round-" + round + "-" + index;
            await muhammara.recryptAsync(
              __dirname + "/TestMaterials/Original.pdf",
              target,
              {
                version: muhammara.ePDFVersion20,
                userPassword: password,
              },
            );
            assertRecryptedPdf(target, password, true);
            await assert.rejects(
              muhammara.recryptAsync(target, target + ".rejected.pdf", {
                password: "wrong-password",
              }),
              /Unable to recrypt files/,
            );
            assert.equal(randomBytes(32).length, 32);
          }),
        );
      }
    });
  });
});
