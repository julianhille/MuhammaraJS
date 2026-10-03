var muhammara = require("@muhammara/native-with-source");
var assert = require("assert");
var path = require("path");
var { writeOutput } = require("./helpers/testOutput");

/**
 * Path of a test output file relative to the working directory, so that
 * `recryptAsync()` has to resolve it.
 *
 * @param {string} name The output file name.
 * @returns {string} The relative path.
 */
function relativeOutput(name) {
  return path.relative(process.cwd(), path.join(__dirname, "output", name));
}

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

    it("rejects instead of throwing when a source or target stream fails", async function () {
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      /**
       * Makes an output stream.
       * @returns {object} A new PDFWStreamForBuffer.
       */
      var output = function () {
        return new muhammara.PDFWStreamForBuffer();
      };
      var cases = [
        [
          function () {
            var source = new muhammara.PDFRStreamForFile(
              __dirname + "/TestMaterials/Original.pdf",
            );
            fs.closeSync(source.rs);
            // A closed descriptor's number may be reused by another thread;
            // this one is beyond any open file limit.
            source.rs = 2 ** 31 - 1;
            return [source, output()];
          },
          /EBADF/,
        ],
        [
          function () {
            var source = new muhammara.PDFRStreamForBuffer(pdf);
            source.read = function () {
              throw new Error("read failed");
            };
            return [source, output()];
          },
          /read failed/,
        ],
        [
          function () {
            var target = output();
            target.getCurrentPosition = function () {
              throw new Error("position failed");
            };
            return [new muhammara.PDFRStreamForBuffer(pdf), target];
          },
          /position failed/,
        ],
      ];
      // Windows refuses to open a directory, so the stream cannot be made.
      if (process.platform !== "win32") {
        cases.push([
          function () {
            return [
              new muhammara.PDFRStreamForFile(__dirname + "/TestMaterials"),
              output(),
            ];
          },
          /EISDIR/,
        ]);
      }
      for (var [streams, error] of cases) {
        var [source, target] = streams();
        var promise;
        try {
          assert.doesNotThrow(function () {
            promise = muhammara.recryptAsync(source, target);
          });
          await assert.rejects(promise, error);
        } finally {
          if (error.source === "EISDIR") fs.closeSync(source.rs);
        }
      }
    });

    it("rejects instead of aborting when the source does not fit in memory", async function () {
      // Electron ends the process when an allocation fails, and so does ASan
      // unless allocator_may_return_null is set.
      var asan = /asan/.test(process.env.LD_PRELOAD || "");
      if (
        process.versions.electron ||
        (asan &&
          !/allocator_may_return_null=1/.test(process.env.ASAN_OPTIONS || ""))
      )
        this.skip();
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var source = new muhammara.PDFRStreamForBuffer(pdf);
      var atEnd = false;
      // Claim a length no allocation can hold.
      source.setPositionFromEnd = function () {
        atEnd = true;
      };
      source.setPosition = function (position) {
        atEnd = false;
        muhammara.PDFRStreamForBuffer.prototype.setPosition.call(
          this,
          position,
        );
      };
      source.getCurrentPosition = function () {
        return atEnd
          ? 2 ** 52
          : muhammara.PDFRStreamForBuffer.prototype.getCurrentPosition.call(
              this,
            );
      };
      var promise;
      assert.doesNotThrow(function () {
        promise = muhammara.recryptAsync(
          source,
          new muhammara.PDFWStreamForBuffer(),
        );
      });
      await assert.rejects(promise, {
        name: "RangeError",
        message: "Not enough memory to buffer the recryptAsync() streams",
      });
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

    it("treats undefined and null options as no options, like Wasm", async function () {
      for (var options of [undefined, null]) {
        var name = "RecryptOptions-" + options;
        muhammara.recrypt(
          __dirname + "/TestMaterials/Original.pdf",
          __dirname + "/output/" + name + ".pdf",
          options,
        );
        await muhammara.recryptAsync(
          __dirname + "/TestMaterials/Original.pdf",
          __dirname + "/output/" + name + "-async.pdf",
          options,
        );
        assertRecryptedPdf(
          __dirname + "/output/" + name + ".pdf",
          undefined,
          false,
        );
        assertRecryptedPdf(
          __dirname + "/output/" + name + "-async.pdf",
          undefined,
          false,
        );
      }
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
      this.timeout(120000);
      // A large source keeps the first job on a pool thread for a while.
      var big = __dirname + "/output/RecryptAsyncPoolSource.pdf";
      var writer = muhammara.createWriter(big);
      for (var i = 0; i < 4; i++) {
        writer.appendPDFPagesFromPDF(
          __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
        );
      }
      writer.end();

      var firstDone = false;
      var first = muhammara
        .recryptAsync(big, __dirname + "/output/RecryptAsyncPoolFirst.pdf", {
          userPassword: "pool",
        })
        .then(function () {
          firstDone = true;
        });
      // Waiting behind the first job, these must stay in the queue. On pool
      // threads they would occupy every one, leaving none for fs until they
      // end.
      var waiting = Array.from({ length: 8 }, function (_, index) {
        return muhammara.recryptAsync(
          __dirname + "/TestMaterials/Original.pdf",
          __dirname + "/output/RecryptAsyncPoolWaiting-" + index + ".pdf",
        );
      });
      try {
        await Promise.all(
          Array.from(
            { length: Number(process.env.UV_THREADPOOL_SIZE || 4) * 2 },
            function () {
              return fs.promises.readFile(
                __dirname + "/TestMaterials/Original.pdf",
              );
            },
          ),
        );
        assert.equal(
          firstDone,
          false,
          "fs reads waited for the first recrypt, so waiting jobs held pool threads",
        );
      } finally {
        await first;
        await Promise.all(waiting);
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

    it("ignores a kept promise executor once its job is gone", async function () {
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var constructor = Object.getOwnPropertyDescriptor(
        Promise.prototype,
        "constructor",
      );
      var executors = [];
      /**
       * A Promise constructor that keeps every executor it is given.
       * @param {Function} executor - The executor.
       * @returns {Promise<*>} A built-in promise.
       */
      function KeepingPromise(executor) {
        executors.push(executor);
        return new constructor.value(executor);
      }
      Object.defineProperty(Promise.prototype, "constructor", {
        ...constructor,
        value: KeepingPromise,
      });
      try {
        var promise = muhammara.recryptAsync(
          new muhammara.PDFRStreamForBuffer(pdf),
          new muhammara.PDFWStreamForBuffer(),
        );
      } finally {
        Object.defineProperty(Promise.prototype, "constructor", constructor);
      }
      await promise;
      assert.equal(executors.length, 1);
      // The job was freed when it settled; this must not touch it.
      executors[0](
        function () {},
        function () {},
      );
      await muhammara.recryptAsync(
        new muhammara.PDFRStreamForBuffer(pdf),
        new muhammara.PDFWStreamForBuffer(),
      );
    });

    it("settles the other jobs when a replaced settle function throws", async function () {
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var constructor = Object.getOwnPropertyDescriptor(
        Promise.prototype,
        "constructor",
      );
      /**
       * A Promise constructor whose resolve function throws.
       * @param {Function} executor - The executor.
       * @returns {Promise<*>} A built-in promise that never resolves.
       */
      function ThrowingPromise(executor) {
        return new constructor.value(function (resolve, reject) {
          executor(function () {
            throw new Error("hostile resolve");
          }, reject);
        });
      }
      // Node reports the exception as uncaught; take it from mocha.
      var listeners = process.rawListeners("uncaughtException");
      process.removeAllListeners("uncaughtException");
      var timer;
      // Fail before mocha's timeout so that finally gives mocha its
      // listeners back.
      var uncaught = new Promise(function (resolve, reject) {
        process.once("uncaughtException", resolve);
        timer = setTimeout(reject, 10000, new Error("No uncaught exception"));
      });
      try {
        Object.defineProperty(Promise.prototype, "constructor", {
          ...constructor,
          value: ThrowingPromise,
        });
        try {
          muhammara.recryptAsync(
            new muhammara.PDFRStreamForBuffer(pdf),
            new muhammara.PDFWStreamForBuffer(),
          );
        } finally {
          Object.defineProperty(Promise.prototype, "constructor", constructor);
        }
        var waiting = muhammara.recryptAsync(
          new muhammara.PDFRStreamForBuffer(pdf),
          new muhammara.PDFWStreamForBuffer(),
        );
        assert.equal((await uncaught).message, "hostile resolve");
        await waiting;
      } finally {
        clearTimeout(timer);
        process.removeAllListeners("uncaughtException");
        listeners.forEach(function (listener) {
          process.on("uncaughtException", listener);
        });
      }
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

    it("resolves relative paths through a symlink like recrypt", async function () {
      if (process.platform === "win32") this.skip();
      var path = require("path");
      // link points to real/sub, so the system resolves link/.. to real.
      var root = path.join(__dirname, "output/RecryptAsyncSymlink");
      fs.rmSync(root, { recursive: true, force: true });
      fs.mkdirSync(path.join(root, "real/sub"), { recursive: true });
      fs.symlinkSync(path.join(root, "real/sub"), path.join(root, "link"));
      var source = path.join(__dirname, "TestMaterials/Original.pdf");
      var original = process.cwd();
      process.chdir(root);
      var promise;
      try {
        muhammara.recrypt(source, "link/../sync.pdf");
        promise = muhammara.recryptAsync(source, "link/../async.pdf");
      } finally {
        process.chdir(original);
      }
      await promise;
      assert.ok(fs.existsSync(path.join(root, "real/sync.pdf")));
      assert.ok(fs.existsSync(path.join(root, "real/async.pdf")));
      assert.ok(!fs.existsSync(path.join(root, "async.pdf")));
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
      await assert.rejects(
        promise,
        /^Error: The output stream was written to after recryptAsync\(\) was called$/,
      );
    });

    it("names the earlier job when a queued job shares the output stream", async function () {
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var target = new muhammara.PDFWStreamForBuffer();
      var results = await Promise.allSettled([
        muhammara.recryptAsync(new muhammara.PDFRStreamForBuffer(pdf), target),
        muhammara.recryptAsync(new muhammara.PDFRStreamForBuffer(pdf), target),
      ]);
      assert.equal(results[0].status, "fulfilled");
      // The second job had not started while the first one wrote.
      assert.equal(results[1].status, "rejected");
      assert.equal(
        results[1].reason.message,
        "An earlier recryptAsync() call wrote to the same output stream " +
          "before this one started; use a separate output stream for each call",
      );
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(target.buffer),
      );
      assert.ok(reader.getPagesCount() > 0);
    });

    it("names the earlier job when its write to the shared stream fails", async function () {
      var pdf = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");
      var target = new muhammara.PDFWStreamForBuffer();
      var write = target.write;
      var writes = 0;
      // The first chunk is stored, then the stream fails.
      target.write = function (bytes) {
        var written = write.call(this, bytes);
        if (++writes === 1) throw new Error("disk full");
        return written;
      };
      var results = await Promise.allSettled([
        muhammara.recryptAsync(new muhammara.PDFRStreamForBuffer(pdf), target),
        muhammara.recryptAsync(new muhammara.PDFRStreamForBuffer(pdf), target),
      ]);
      assert.equal(results[0].reason.message, "disk full");
      assert.match(
        results[1].reason.message,
        /^An earlier recryptAsync\(\) call wrote to the same output stream/,
      );
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

    it("keeps getter, inherited, Proxy, frozen and class options when log is set", async function () {
      var source = __dirname + "/TestMaterials/Original.pdf";
      var encryption = {
        password: "",
        userPassword: "user",
        ownerPassword: "owner",
        userProtectionFlag: 4,
      };
      var getters = {
        log: __dirname + "/output/RecryptAsyncGetterOptions.log",
      };
      Object.keys(encryption).forEach(function (key) {
        Object.defineProperty(getters, key, {
          get: function () {
            return encryption[key];
          },
        });
      });
      var inherited = Object.create(encryption);
      inherited.log = __dirname + "/output/RecryptAsyncInheritedOptions.log";
      var proxied = new Proxy(
        {},
        {
          has: function (target, key) {
            return key === "log" || key in encryption;
          },
          get: function (target, key) {
            return key === "log"
              ? __dirname + "/output/RecryptAsyncProxyOptions.log"
              : encryption[key];
          },
        },
      );
      var frozen = Object.freeze(
        Object.assign({}, encryption, {
          log: relativeOutput("RecryptAsyncFrozenOptions.log"),
        }),
      );
      var readOnly = Object.assign({}, encryption);
      Object.defineProperty(readOnly, "log", {
        value: relativeOutput("RecryptAsyncReadOnlyOptions.log"),
        enumerable: true,
      });
      /** Options whose getters need the original object as `this`. */
      class PrivateOptions {
        #password = "user";
        /** @returns {string} The empty source password. */
        get password() {
          return "";
        }
        /** @returns {string} The user password from a private field. */
        get userPassword() {
          return this.#password;
        }
        /** @returns {string} The owner password. */
        get ownerPassword() {
          return "owner";
        }
        /** @returns {number} The user protection flags. */
        get userProtectionFlag() {
          return 4;
        }
        /** @returns {string} The relative log path. */
        get log() {
          return relativeOutput("RecryptAsyncPrivateOptions.log");
        }
      }
      var cases = {
        Getter: getters,
        Inherited: inherited,
        Proxy: proxied,
        Frozen: frozen,
        ReadOnly: readOnly,
        Private: new PrivateOptions(),
      };
      for (var name of Object.keys(cases)) {
        var target = __dirname + "/output/RecryptAsync" + name + "Options.pdf";
        var syncTarget = __dirname + "/output/Recrypt" + name + "Options.pdf";
        muhammara.recrypt(source, syncTarget, cases[name]);
        assertRecryptedPdf(syncTarget, "user", true);
        await muhammara.recryptAsync(source, target, cases[name]);
        assertRecryptedPdf(target, "user", true);
      }
    });

    it("uses the time zone of the call, not of the pool thread", async function () {
      /**
       * Reads how far the first log timestamp is ahead of UTC.
       * @param {string} log - The log file path.
       * @returns {number} The offset from UTC in minutes.
       */
      function loggedMinutesAhead(log) {
        var stamp = /^\[ (\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d):(\d\d) \]/.exec(
          fs.readFileSync(log, "utf8"),
        );
        assert.ok(stamp, "the log starts with a timestamp");
        var loggedAsUtc = Date.UTC(
          +stamp[3],
          +stamp[2] - 1,
          +stamp[1],
          +stamp[4],
          +stamp[5],
          +stamp[6],
        );
        return (loggedAsUtc - Date.now()) / 60000;
      }
      /**
       * Starts a recrypt of a missing source that logs to `name`.
       * @param {string} name - The log file name in the test output folder.
       * @returns {{log: string, promise: Promise<void>}} The log path and job.
       */
      function recryptMissingSource(name) {
        var log = path.join(__dirname, "output", name + ".log");
        fs.rmSync(log, { force: true });
        return {
          log: log,
          promise: muhammara.recryptAsync(
            path.join(__dirname, "output/MissingTimeZoneSource.pdf"),
            path.join(__dirname, "output", name + ".pdf"),
            { log: log },
          ),
        };
      }
      var originalTimeZone = process.env.TZ;
      var control;
      var job;
      // POSIX zone strings need no tz database, which Alpine images lack:
      // always 5:30 ahead of UTC, then 5:00 behind it.
      process.env.TZ = "IST-5:30";
      try {
        control = recryptMissingSource("RecryptAsyncTimeZoneControl");
        await assert.rejects(control.promise, /Unable to recrypt files/);
        job = recryptMissingSource("RecryptAsyncTimeZone");
        // The job reads no time zone on its pool thread, where it would race
        // this write.
        process.env.TZ = "EST5";
        await assert.rejects(job.promise, /Unable to recrypt files/);
      } finally {
        if (originalTimeZone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimeZone;
      }
      // The Windows C runtime does not see process.env.TZ, so the native side
      // keeps the system zone there and the switch cannot be observed.
      if (Math.abs(loggedMinutesAhead(control.log) - 330) >= 2) this.skip();
      var minutesAhead = loggedMinutesAhead(job.log);
      assert.ok(
        Math.abs(minutesAhead - 330) < 2,
        "expected UTC+5:30, got " + minutesAhead + " minutes from UTC",
      );
    });

    it("reads log only when the options have one, like recrypt", async function () {
      // Every get throws, but no key exists, so the addon reads none.
      var options = new Proxy(
        {},
        {
          has: function () {
            return false;
          },
          get: function () {
            throw new Error("read an option that does not exist");
          },
        },
      );
      muhammara.recrypt(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptHasOnlyOptions.pdf",
        options,
      );
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptAsyncHasOnlyOptions.pdf",
        options,
      );
    });

    it("rejects instead of throwing when the working directory is gone", async function () {
      // Windows cannot remove the working directory.
      if (process.platform === "win32") this.skip();
      var path = require("path");
      var gone = path.join(__dirname, "output/RecryptAsyncRemovedDirectory");
      var next = path.join(__dirname, "output/RecryptAsyncNextDirectory");
      fs.rmSync(gone, { recursive: true, force: true });
      fs.rmSync(next, { recursive: true, force: true });
      fs.mkdirSync(gone);
      fs.mkdirSync(next);
      // The directory the caller moves on to has the source, so a job that
      // resolved the relative paths only when it ran would recrypt it there.
      fs.copyFileSync(
        __dirname + "/TestMaterials/Original.pdf",
        path.join(next, "in.pdf"),
      );
      // A thread runs its jobs one at a time, so a job queued now cannot
      // start before the caller has moved on.
      var first = muhammara.recryptAsync(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptAsyncBeforeRemoved.pdf",
      );
      var BuiltinPromise = Promise;
      var original = process.cwd();
      var promise;
      process.chdir(gone);
      try {
        fs.rmdirSync(gone);
        assert.throws(function () {
          muhammara.recrypt("in.pdf", "out.pdf");
        }, /Unable to recrypt files/);
        global.Promise = function NotAPromise() {};
        try {
          promise = muhammara.recryptAsync("in.pdf", "out.pdf", {
            log: "recrypt.log",
          });
        } finally {
          global.Promise = BuiltinPromise;
        }
        process.chdir(next);
        assert.ok(promise instanceof BuiltinPromise);
        var rejected = assert.rejects(promise);
        await first;
        await rejected;
      } finally {
        process.chdir(original);
      }
      assert.deepEqual(fs.readdirSync(next), ["in.pdf"]);
    });

    it("skips a relative log in a removed working directory, like recrypt", async function () {
      // Windows cannot remove the working directory.
      if (process.platform === "win32") this.skip();
      var path = require("path");
      var gone = path.join(__dirname, "output/RecryptAsyncRemovedLogDirectory");
      var next = path.join(__dirname, "output/RecryptAsyncNextLogDirectory");
      fs.rmSync(gone, { recursive: true, force: true });
      fs.rmSync(next, { recursive: true, force: true });
      fs.mkdirSync(gone);
      fs.mkdirSync(next);
      var source = __dirname + "/TestMaterials/Original.pdf";
      var missing = __dirname + "/output/MissingLogRecrypt.pdf";
      // A thread runs its jobs one at a time, so the jobs queued after this
      // one cannot start before the caller has moved on.
      var first = muhammara.recryptAsync(
        source,
        __dirname + "/output/RecryptAsyncBeforeRemovedLog.pdf",
      );
      var original = process.cwd();
      var written;
      var failed;
      process.chdir(gone);
      try {
        fs.rmdirSync(gone);
        // recrypt() cannot create the log there: it writes the PDF without
        // one, and a failure logs nothing.
        muhammara.recrypt(source, path.join(next, "sync.pdf"), {
          log: "recrypt.log",
        });
        assert.throws(function () {
          muhammara.recrypt(missing, path.join(next, "never.pdf"), {
            log: "recrypt.log",
          });
        }, /Unable to recrypt files/);
        written = muhammara.recryptAsync(source, path.join(next, "async.pdf"), {
          log: "recrypt.log",
        });
        failed = muhammara.recryptAsync(missing, path.join(next, "never.pdf"), {
          log: "recrypt.log",
        });
        process.chdir(next);
        var rejected = assert.rejects(failed, /Unable to recrypt files/);
        await first;
        await written;
        await rejected;
      } finally {
        process.chdir(original);
      }
      assert.deepEqual(fs.readdirSync(next).sort(), ["async.pdf", "sync.pdf"]);
    });

    it("rejects a path that is too long once made absolute", async function () {
      // Windows makes relative paths absolute for recrypt() as well.
      if (process.platform === "win32") this.skip();
      var path = require("path");
      var top = path.join(__dirname, "output/RecryptAsyncLongDirectory");
      var name = "d".repeat(200);
      var original = process.cwd();
      /**
       * Removes the nested directories by relative paths, as their absolute
       * paths are too long to remove directly.
       * @returns {void}
       */
      var removeNested = function () {
        if (!fs.existsSync(top)) return;
        process.chdir(top);
        try {
          var levels = 0;
          while (fs.existsSync(name)) {
            process.chdir(name);
            levels++;
          }
          fs.readdirSync(".").forEach(function (file) {
            fs.rmSync(file, { force: true });
          });
          for (; levels > 0; levels--) {
            process.chdir("..");
            fs.rmdirSync(name);
          }
        } finally {
          process.chdir(original);
        }
        fs.rmdirSync(top);
      };
      removeNested();
      fs.mkdirSync(top);
      process.chdir(top);
      try {
        // Longer than PATH_MAX on Linux (4096) and macOS (1024).
        for (var level = 0; level < 25; level++) {
          fs.mkdirSync(name);
          process.chdir(name);
        }
        fs.copyFileSync(__dirname + "/TestMaterials/Original.pdf", "in.pdf");
        // recrypt() opens the relative paths from inside the directory.
        muhammara.recrypt("in.pdf", "sync.pdf");
        // Checked where it was run: glibc makes the working directory
        // absolute and the addon rejects, while musl fails to and the wrapper
        // rejects with the same message.
        var message =
          process.platform === "linux" ? /too long for this system/ : undefined;
        var rejected = [
          assert.rejects(
            muhammara.recryptAsync("in.pdf", "async.pdf"),
            message,
          ),
          assert.rejects(
            muhammara.recryptAsync(
              __dirname + "/TestMaterials/Original.pdf",
              __dirname + "/output/RecryptAsyncLongLog.pdf",
              { log: "recrypt.log" },
            ),
            message,
          ),
        ];
        await Promise.all(rejected);
        assert.deepEqual(fs.readdirSync(".").sort(), ["in.pdf", "sync.pdf"]);
      } finally {
        process.chdir(original);
        removeNested();
      }
    });

    it("resolves relative paths in a renamed working directory, like recrypt", async function () {
      // Windows cannot rename the working directory.
      if (process.platform === "win32") this.skip();
      var path = require("path");
      var before = path.join(__dirname, "output/RecryptAsyncBeforeRename");
      var after = path.join(__dirname, "output/RecryptAsyncAfterRename");
      fs.rmSync(before, { recursive: true, force: true });
      fs.rmSync(after, { recursive: true, force: true });
      fs.mkdirSync(before);
      fs.copyFileSync(
        __dirname + "/TestMaterials/Original.pdf",
        path.join(before, "in.pdf"),
      );
      var original = process.cwd();
      process.chdir(before);
      try {
        // Node keeps this path until the next chdir().
        assert.equal(fs.realpathSync(process.cwd()), fs.realpathSync(before));
        fs.renameSync(before, after);
        muhammara.recrypt("in.pdf", "sync.pdf");
        await muhammara.recryptAsync("in.pdf", "async.pdf");
      } finally {
        process.chdir(original);
      }
      assert.deepEqual(fs.readdirSync(after).sort(), [
        "async.pdf",
        "in.pdf",
        "sync.pdf",
      ]);
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

    it("recrypts in a worker thread while this thread is inside recrypt()", async function () {
      this.timeout(60000);
      var { Worker } = require("worker_threads");
      // flags[0]: this thread is inside recrypt(); flags[1]: the worker is done.
      var flags = new Int32Array(new SharedArrayBuffer(8));
      var worker = new Worker(
        `
        const { workerData } = require("worker_threads");
        const muhammara = require(workerData.module);
        const flags = new Int32Array(workerData.flags);
        Atomics.wait(flags, 0, 0);
        muhammara.recrypt(workerData.source, workerData.prefix + "Sync.pdf", {
          userPassword: "worker",
        });
        muhammara
          .recryptAsync(workerData.source, workerData.prefix + "Async.pdf", {
            userPassword: "worker",
          })
          .finally(function () {
            Atomics.store(flags, 1, 1);
            Atomics.notify(flags, 1);
          });
        `,
        {
          eval: true,
          workerData: {
            module: require.resolve("@muhammara/native-with-source"),
            source: __dirname + "/TestMaterials/Original.pdf",
            prefix: __dirname + "/output/RecryptParallelWorker",
            flags: flags.buffer,
          },
        },
      );
      var exited = new Promise(function (resolve, reject) {
        worker.once("exit", resolve);
        worker.once("error", reject);
      });
      var source = new muhammara.PDFRStreamForBuffer(
        fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
      );
      var read = source.read;
      var waited;
      source.read = function (amount) {
        if (waited === undefined) {
          // Block inside recrypt() until the worker has recrypted. A lock
          // shared by all recrypts would make both threads wait forever.
          Atomics.store(flags, 0, 1);
          Atomics.notify(flags, 0);
          waited = Atomics.wait(flags, 1, 0, 30000);
        }
        return read.call(this, amount);
      };
      muhammara.recrypt(source, new muhammara.PDFWStreamForBuffer(), {
        userPassword: "main",
      });
      await exited;
      assert.equal(waited, "ok", "the worker could not recrypt in parallel");
      assertRecryptedPdf(
        __dirname + "/output/RecryptParallelWorkerSync.pdf",
        "worker",
        true,
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptParallelWorkerAsync.pdf",
        "worker",
        true,
      );
    });

    it("survives process.exit() in a worker thread during a job", async function () {
      this.timeout(60000);
      var { Worker } = require("worker_threads");
      var worker = new Worker(
        `
        const { workerData } = require("worker_threads");
        const muhammara = require(workerData.module);
        for (let i = 0; i < 4; i++)
          muhammara.recryptAsync(
            workerData.source,
            workerData.outputPrefix + i + ".pdf",
            { userPassword: "exit", version: muhammara.ePDFVersion20 },
          );
        setTimeout(() => process.exit(0), 20);
        `,
        {
          eval: true,
          workerData: {
            module: require.resolve("@muhammara/native-with-source"),
            source: __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
            outputPrefix: __dirname + "/output/RecryptAsyncExit-",
          },
        },
      );
      var code = await new Promise(function (resolve, reject) {
        worker.once("exit", resolve);
        worker.once("error", reject);
      });
      assert.equal(code, 0);
      // The process survives the worker's exit, and recrypt still works.
      await muhammara.recryptAsync(
        __dirname + "/TestMaterials/Original.pdf",
        __dirname + "/output/RecryptAsyncAfterExit.pdf",
        { version: muhammara.ePDFVersion20, userPassword: "after" },
      );
      assertRecryptedPdf(
        __dirname + "/output/RecryptAsyncAfterExit.pdf",
        "after",
        true,
      );
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

    it("logs early errors of recrypt() to its own log, like recryptAsync", async function () {
      var output = __dirname + "/output/";
      var logs = {
        writer: output + "RecryptEarlyErrorWriter.log",
        sync: output + "RecryptEarlyErrorSync.log",
        async: output + "RecryptEarlyErrorAsync.log",
      };
      Object.values(logs).forEach(function (log) {
        fs.rmSync(log, { force: true });
      });
      // Another writer on this thread holds its own log meanwhile.
      var writer = muhammara.createWriter(
        output + "RecryptEarlyErrorWriter.pdf",
        { log: logs.writer },
      );
      try {
        assert.throws(function () {
          muhammara.recrypt(
            output + "MissingSyncRecrypt.pdf",
            output + "RecryptEarlyErrorSync.pdf",
            { log: logs.sync },
          );
        }, /Unable to recrypt files/);
        // Without a log of its own, it logs nowhere, as recryptAsync() does.
        assert.throws(function () {
          muhammara.recrypt(
            output + "MissingUnloggedRecrypt.pdf",
            output + "RecryptEarlyErrorUnlogged.pdf",
          );
        }, /Unable to recrypt files/);
        await assert.rejects(
          muhammara.recryptAsync(
            output + "MissingAsyncRecrypt.pdf",
            output + "RecryptEarlyErrorAsync.pdf",
            { log: logs.async },
          ),
          /Unable to recrypt files/,
        );
      } finally {
        writer.end();
        // A writer without a log turns this thread's logging off again, so
        // later tests do not log into these files.
        muhammara.createWriter(new muhammara.PDFWStreamForBuffer()).end();
      }
      /**
       * Reads a log file.
       * @param {string} log - The log path.
       * @returns {string} Its text, or "" when it does not exist.
       */
      var read = function (log) {
        return fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
      };
      assert.ok(read(logs.async).includes("MissingAsyncRecrypt.pdf"));
      assert.ok(read(logs.sync).includes("MissingSyncRecrypt.pdf"));
      assert.ok(!read(logs.writer).includes("MissingSyncRecrypt.pdf"));
      assert.ok(!read(logs.writer).includes("MissingUnloggedRecrypt.pdf"));
    });

    it("skips a log file it cannot append to instead of crashing", async function () {
      var output = __dirname + "/output/";
      var directory = output + "RecryptLogDirectory";
      var readOnly = output + "RecryptReadOnly.log";
      fs.mkdirSync(directory, { recursive: true });
      // A run that ended early may have left the file read-only.
      if (fs.existsSync(readOnly)) fs.chmodSync(readOnly, 0o644);
      fs.writeFileSync(readOnly, "");
      fs.chmodSync(readOnly, 0o444);
      var logs = [directory, readOnly];
      // A device that opens for reading but not for appending, as /dev/autofs
      // does for users other than root, where the system has one.
      var device = ["/dev/autofs", "/dev/kmsg"].find(function (candidate) {
        try {
          fs.closeSync(fs.openSync(candidate, "r"));
        } catch (error) {
          return false;
        }
        try {
          fs.closeSync(fs.openSync(candidate, "a"));
          return false;
        } catch (error) {
          return true;
        }
      });
      if (device) logs.push(device);
      var writerLog = output + "RecryptUnusableLogWriter.log";
      fs.rmSync(writerLog, { force: true });
      // Another writer on this thread holds its own log meanwhile.
      var writer = muhammara.createWriter(
        output + "RecryptUnusableLogWriter.pdf",
        { log: writerLog },
      );
      /**
       * Reads the other writer's log.
       * @returns {string} Its text, or "" when it does not exist.
       */
      var read = function () {
        return fs.existsSync(writerLog)
          ? fs.readFileSync(writerLog, "utf8")
          : "";
      };
      var before = read();
      try {
        for (var log of logs) {
          // Each fails while parsing, so it logs before writing anything.
          assert.throws(function () {
            muhammara.recrypt(
              output + "MissingLogRecrypt.pdf",
              output + "RecryptUnusableLog.pdf",
              { log },
            );
          }, /Unable to recrypt files/);
          assert.throws(function () {
            muhammara.recrypt(
              new muhammara.PDFRStreamForBuffer(Buffer.from("not a PDF")),
              new muhammara.PDFWStreamForBuffer(),
              { log },
            );
          }, /Unable to recrypt files/);
          await assert.rejects(
            muhammara.recryptAsync(
              output + "MissingLogRecrypt.pdf",
              output + "RecryptAsyncUnusableLog.pdf",
              { log },
            ),
            /Unable to recrypt files/,
          );
        }
        // Without a usable log of their own, the calls log nowhere, not into
        // the other writer's log.
        assert.equal(read(), before);
      } finally {
        fs.chmodSync(readOnly, 0o644);
        writer.end();
        // A writer without a log turns this thread's logging off again, so
        // later tests do not log into the other writer's log.
        muhammara.createWriter(new muhammara.PDFWStreamForBuffer()).end();
      }
    });

    it("gives an open writer its log back once recrypt() returns", function () {
      var output = __dirname + "/output/";
      var writerLog = output + "RecryptWriterLogBack.log";
      var ownLog = output + "RecryptWriterLogBackOwn.log";
      fs.rmSync(writerLog, { force: true });
      fs.rmSync(ownLog, { force: true });
      var writer = muhammara.createWriter(output + "RecryptWriterLogBack.pdf", {
        log: writerLog,
      });
      /**
       * Makes the writer log an error that names a missing file.
       * @param {string} name - The missing file's name.
       * @returns {void}
       */
      var fail = function (name) {
        assert.throws(function () {
          writer.appendPDFPagesFromPDF(output + name);
        });
      };
      try {
        // After a call that fails early, one that succeeds with a log of its
        // own, and one that succeeds without.
        assert.throws(function () {
          muhammara.recrypt(
            output + "MissingWriterLogBack.pdf",
            output + "RecryptWriterLogBackFailed.pdf",
            { log: ownLog },
          );
        }, /Unable to recrypt files/);
        fail("MissingAfterFailedRecrypt.pdf");
        muhammara.recrypt(
          __dirname + "/TestMaterials/Original.pdf",
          output + "RecryptWriterLogBackOwn.pdf",
          { log: ownLog },
        );
        fail("MissingAfterLoggedRecrypt.pdf");
        muhammara.recrypt(
          __dirname + "/TestMaterials/Original.pdf",
          output + "RecryptWriterLogBackNone.pdf",
        );
        fail("MissingAfterUnloggedRecrypt.pdf");
      } finally {
        writer.end();
        // A writer without a log turns this thread's logging off again, so
        // later tests do not log into the writer's log.
        muhammara.createWriter(new muhammara.PDFWStreamForBuffer()).end();
      }
      var text = fs.readFileSync(writerLog, "utf8");
      [
        "MissingAfterFailedRecrypt.pdf",
        "MissingAfterLoggedRecrypt.pdf",
        "MissingAfterUnloggedRecrypt.pdf",
      ].forEach(function (name) {
        assert.ok(text.includes(name), name);
      });
      var own = fs.readFileSync(ownLog, "utf8");
      assert.ok(own.includes("MissingWriterLogBack.pdf"));
      assert.ok(!own.includes("MissingAfter"));
    });

    it("stops logging to its log once recrypt() returns", function () {
      var output = __dirname + "/output/";
      var log = output + "RecryptOwnLogOnly.log";
      fs.rmSync(log, { force: true });
      assert.throws(function () {
        muhammara.recrypt(
          output + "MissingOwnLogFirst.pdf",
          output + "RecryptOwnLogOnly.pdf",
          { log },
        );
      }, /Unable to recrypt files/);
      assert.throws(function () {
        muhammara.recrypt(
          output + "MissingOwnLogSecond.pdf",
          output + "RecryptOwnLogOnly.pdf",
        );
      }, /Unable to recrypt files/);
      var text = fs.readFileSync(log, "utf8");
      assert.ok(text.includes("MissingOwnLogFirst.pdf"));
      assert.ok(!text.includes("MissingOwnLogSecond.pdf"));
    });

    it("leaves the event loop free while the synchronous call blocks it", async function () {
      this.timeout(120000);
      // A single small fixture recrypts too fast to observe, so build a bigger
      // one first, about 32 MB. The synchronous call blocks the loop at any
      // size; the asynchronous one only has to outlast a few timer ticks, and
      // a larger file only slows the sanitizer job.
      var big = __dirname + "/output/RecryptAsyncLargeSource.pdf";
      var writer = muhammara.createWriter(big);
      for (var i = 0; i < 4; i++) {
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
      // Under RISC-V emulation the 24 PDF 2.0 jobs alone can pass 60 seconds.
      this.timeout(process.arch === "riscv64" ? 180000 : 60000);
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
