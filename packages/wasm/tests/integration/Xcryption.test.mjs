import assert from "node:assert/strict";
import fs from "node:fs";
import v8 from "node:v8";
import vm from "node:vm";
import { createMuhammaraWasm } from "../../index.js";
import { recryptWorkerHost } from "../../lib/recrypt-worker-client.js";
import { writeOutput } from "../testOutput.mjs";

function readStreamIVs(pdf) {
  var marker = new TextEncoder().encode("stream");
  var ivs = [];

  for (var offset = 1; offset <= pdf.length - marker.length; offset++) {
    if (!marker.every((byte, index) => pdf[offset + index] === byte)) continue;
    var contentOffset = offset + marker.length;
    var previous = pdf[offset - 1];
    if (
      (previous === 0x0a || previous === 0x0d || previous === 0x20) &&
      (pdf[contentOffset] === 0x0a || pdf[contentOffset] === 0x0d)
    ) {
      if (pdf[contentOffset] === 0x0d) contentOffset++;
      if (pdf[contentOffset] === 0x0a) contentOffset++;
      ivs.push(pdf.slice(contentOffset, contentOffset + 16));
    }
  }

  return ivs;
}

describe("Xcryption", function () {
  it("adds, changes, and removes passwords from byte PDFs", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    writeOutput("Xcryption-recrypt-source", source);
    var encrypted = muhammara.recrypt(source, {
      userPassword: "view",
      ownerPassword: "edit",
      userProtectionFlag: 4,
      version: muhammara.ePDFVersion17,
    });
    writeOutput("Xcryption-recrypt-encrypted", encrypted);
    var encryptedReader = muhammara.createReader(encrypted);
    assert.equal(encryptedReader.isEncrypted(), true);
    encryptedReader.end();

    var changed = muhammara.recrypt(encrypted, {
      password: "view",
      userPassword: "new-view",
      ownerPassword: "new-edit",
    });
    writeOutput("Xcryption-recrypt-changed", changed);
    var plain = muhammara.recrypt(changed, { password: "new-view" });
    writeOutput("Xcryption-recrypt-plain", plain);
    var plainReader = muhammara.createReader(plain);
    assert.equal(plainReader.isEncrypted(), false);
    assert.equal(plainReader.getPagesCount(), 1);
    plainReader.end();
  });

  it("creates a PDF with a password, as native createWriter does", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });
    writer.writePage(writer.createPage(0, 0, 595, 842));
    var encrypted = writer.end();
    writeOutput("Xcryption-writer-encrypted", encrypted);
    var reader = muhammara.createReader(encrypted);
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    for (var password of ["user", "owner"]) {
      var decrypted = muhammara.recrypt(encrypted, { password });
      writeOutput("Xcryption-writer-decrypted-" + password, decrypted);
      var plainReader = muhammara.createReader(decrypted);
      assert.equal(plainReader.isEncrypted(), false);
      assert.deepEqual(
        plainReader.parsePage(0).getMediaBox(),
        [0, 0, 595, 842],
      );
      plainReader.end();
    }

    for (var readerPassword of ["user", "owner"]) {
      var passwordReader = muhammara.createReader(encrypted, {
        password: readerPassword,
      });
      assert.equal(passwordReader.getPagesCount(), 1);
      assert.deepEqual(
        passwordReader.parsePage(0).getMediaBox(),
        [0, 0, 595, 842],
      );
      passwordReader.end();
    }
    var asyncReader = await muhammara.createReaderAsync(new Blob([encrypted]), {
      password: "user",
    });
    assert.equal(asyncReader.getPagesCount(), 1);
    asyncReader.end();
    var wrongReader = muhammara.createReader(encrypted, { password: "wrong" });
    assert.throws(() => wrongReader.parsePage(0), /Unable to read page 0/);
    wrongReader.end();
    assert.throws(
      () => muhammara.createReader(encrypted, 5),
      /createReader options must be an object/,
    );
    assert.throws(
      () => muhammara.createReader(encrypted, { password: 1 }),
      /createReader password must be a string/,
    );

    // An owner password alone does not encrypt, as in native.
    var ownerOnly = muhammara.createWriter({ ownerPassword: "owner" });
    ownerOnly.writePage(ownerOnly.createPage(0, 0, 10, 10));
    var ownerOnlyPdf = ownerOnly.end();
    writeOutput("Xcryption-writer-owner-only", ownerOnlyPdf);
    var ownerOnlyReader = muhammara.createReader(ownerOnlyPdf);
    assert.equal(ownerOnlyReader.isEncrypted(), false);
    ownerOnlyReader.end();

    assert.throws(
      () => muhammara.createWriter({ userPassword: 1 }),
      /createWriter userPassword must be a string/,
    );
    assert.throws(
      () => muhammara.createWriter({ log: "muhammara.log" }),
      /log files are unavailable in WebAssembly/,
    );
    assert.throws(
      () =>
        muhammara.createWriter({
          userPassword: "user",
          version: muhammara.ePDFVersion20,
        }),
      /PDF 2.0 encryption needs AES-256/,
    );
    assert.throws(
      () =>
        muhammara.createWriterToModify(muhammara.createBlankPdf(10, 10), {
          userPassword: "user",
        }),
      /createWriterToModify userPassword is unavailable in WebAssembly/,
    );
  });

  it("keeps the native recrypt option defaults", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    writeOutput("Xcryption-defaults-source", source);
    var encrypted = muhammara.recrypt(source, { userPassword: "" });
    writeOutput("Xcryption-defaults-encrypted", encrypted);
    var reader = muhammara.createReader(encrypted);
    assert.equal(reader.isEncrypted(), true);
    reader.end();
    assert.throws(
      () => muhammara.recrypt(source, { log: "muhammara-error.log" }),
      /log files are unavailable/,
    );
  });

  it("uses the native RC4 and AES-128 version selection", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    writeOutput("Xcryption-versions-source", source);
    for (var version of [10, 14, 17]) {
      var encrypted = muhammara.recrypt(source, {
        userPassword: "view",
        version,
      });
      writeOutput("Xcryption-version-" + version + "-encrypted", encrypted);
      var reader = muhammara.createReader(encrypted);
      assert.equal(reader.isEncrypted(), true);
      reader.end();
      var plain = muhammara.recrypt(encrypted, { password: "view" });
      writeOutput("Xcryption-version-" + version + "-plain", plain);
      var plainReader = muhammara.createReader(plain);
      assert.equal(plainReader.isEncrypted(), false);
      plainReader.end();
    }
  });

  it("rejects unsupported PDF 2.0 AES-256 encryption", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = muhammara.createBlankPdf(100, 100);
    writeOutput("Xcryption-aes256-source", source);
    assert.throws(
      () =>
        muhammara.recrypt(source, {
          userPassword: "view",
          version: muhammara.ePDFVersion20,
        }),
      /PDF 2\.0\/AES-256 encryption is unavailable in WebAssembly/,
    );
  });

  it("generates a distinct IV for each AES-encrypted stream", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    for (var index = 0; index < 2; index++) {
      var page = writer.createPage(0, 0, 100, 100);
      writer.startPageContentContext(page).q().re(1, 1, 10, 10).f().Q();
      writer.writePage(page);
    }

    var source = writer.end();
    writeOutput("Xcryption-aes-iv-source", source);
    var encrypted = muhammara.recrypt(source, {
      userPassword: "view",
      version: muhammara.ePDFVersion17,
      compress: false,
    });
    writeOutput("Xcryption-aes-iv-encrypted", encrypted);
    var ivs = readStreamIVs(encrypted);
    assert.ok(ivs.length >= 2);
    assert.notDeepEqual(ivs[0], ivs[1]);
  });

  describe("recryptAsync", function () {
    it("resolves with the same encryption as recrypt from a Blob", async function () {
      var muhammara = await createMuhammaraWasm();
      var source = muhammara.createBlankPdf(100, 100);
      var promise = muhammara.recryptAsync(new Blob([source]), {
        userPassword: "view",
        ownerPassword: "edit",
        version: muhammara.ePDFVersion17,
      });
      assert.ok(promise instanceof Promise);
      var encrypted = await promise;
      writeOutput("Xcryption-recryptAsync-encrypted", encrypted);
      assert.ok(encrypted instanceof Uint8Array);
      var reader = muhammara.createReader(encrypted, { password: "view" });
      assert.equal(reader.isEncrypted(), true);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();

      var plain = await muhammara.recryptAsync(encrypted, { password: "view" });
      var plainReader = muhammara.createReader(plain);
      assert.equal(plainReader.isEncrypted(), false);
      plainReader.end();
    });

    it("reads the options when called, not after reading the source", async function () {
      var muhammara = await createMuhammaraWasm();
      var source = new Blob([muhammara.createBlankPdf(100, 100)]);
      var options = { userPassword: "first", ownerPassword: "edit" };
      var first = muhammara.recryptAsync(source, options);
      options.userPassword = "second";
      var second = muhammara.recryptAsync(source, options);
      delete options.userPassword;

      var firstReader = muhammara.createReader(await first, {
        password: "first",
      });
      assert.equal(firstReader.isEncrypted(), true);
      firstReader.end();
      var secondReader = muhammara.createReader(await second, {
        password: "second",
      });
      assert.equal(secondReader.isEncrypted(), true);
      secondReader.end();
    });

    it("reads getter and inherited options like recrypt", async function () {
      var muhammara = await createMuhammaraWasm();
      var options = Object.create({ userPassword: "view" });
      Object.defineProperty(options, "ownerPassword", {
        get: () => "edit",
        enumerable: false,
      });
      var encrypted = await muhammara.recryptAsync(
        new Blob([muhammara.createBlankPdf(100, 100)]),
        options,
      );
      var reader = muhammara.createReader(encrypted, { password: "view" });
      assert.equal(reader.isEncrypted(), true);
      reader.end();
    });

    it("rejects instead of throwing for unsupported input and options", async function () {
      var muhammara = await createMuhammaraWasm();
      await assert.rejects(
        muhammara.recryptAsync("not bytes"),
        /PDF input must be a Uint8Array or ArrayBuffer/,
      );
      await assert.rejects(
        muhammara.recryptAsync(muhammara.createBlankPdf(100, 100), {
          userPassword: "view",
          version: muhammara.ePDFVersion20,
        }),
        /PDF 2\.0\/AES-256 encryption is unavailable in WebAssembly/,
      );
    });

    it("treats undefined and null options as no options, like native", async function () {
      var muhammara = await createMuhammaraWasm();
      var source = muhammara.createBlankPdf(100, 100);
      for (var options of [undefined, null]) {
        for (var output of [
          muhammara.recrypt(source, options),
          await muhammara.recryptAsync(source, options),
        ]) {
          var reader = muhammara.createReader(output);
          assert.equal(reader.isEncrypted(), false);
          reader.end();
        }
      }
    });

    it("holds no more copies of the input than recrypt", async function () {
      // Counts the copies on this thread, so recrypt on it.
      var muhammara = await createMuhammaraWasm({ recryptWorker: false });
      var writer = muhammara.createWriter({ compress: false });
      for (var index = 0; index < 40; index++) {
        var page = writer.createPage(0, 0, 595, 842);
        var context = writer.startPageContentContext(page);
        for (var row = 0; row < 120; row++) {
          context
            .q()
            .rg(0.2, 0.4, 0.6)
            .re(40, 40 + row * 6, 500, 4)
            .f()
            .Q();
        }
        writer.writePage(page);
      }
      var source = writer.end();
      var blob = new Blob([source]);
      var options = { userPassword: "view" };
      // A full collection before each reading leaves only the ArrayBuffers
      // still referenced, so the difference counts the copies a call holds.
      // Sweeping on the calling thread makes the count exact.
      v8.setFlagsFromString("--expose-gc");
      v8.setFlagsFromString("--no-concurrent-array-buffer-sweeping");
      var gc = vm.runInNewContext("gc");
      v8.setFlagsFromString("--no-expose-gc");
      var encode = TextEncoder.prototype.encode;
      /**
       * Counts the copies of the source a call holds while it recrypts.
       * @param {function(): *} run - Starts the call.
       * @returns {Promise<number>} Copies beyond those held before the call.
       */
      var copies = async function (run) {
        var during;
        try {
          // Let earlier tests' pending work release its buffers first.
          await new Promise((resolve) => setImmediate(resolve));
          gc();
          var before = process.memoryUsage().arrayBuffers;
          // Recrypt encodes its passwords after it copied the input to the
          // Wasm heap, so the first encode sees everything the call holds.
          /**
           * Measures the held buffers on the first encode, then encodes.
           * @param {...*} args - encode() arguments.
           * @returns {Uint8Array} The encoded text.
           */
          TextEncoder.prototype.encode = function (...args) {
            if (during === undefined) {
              gc();
              during = process.memoryUsage().arrayBuffers;
            }
            return encode.apply(this, args);
          };
          await run();
        } finally {
          TextEncoder.prototype.encode = encode;
        }
        assert.notEqual(during, undefined);
        return Math.round((during - before) / source.length);
      };
      try {
        var sync = await copies(() => muhammara.recrypt(source, options));
        var bytes = await copies(() => muhammara.recryptAsync(source, options));
        var fromBlob = await copies(() =>
          muhammara.recryptAsync(blob, options),
        );
      } finally {
        v8.setFlagsFromString("--concurrent-array-buffer-sweeping");
      }
      assert.ok(sync >= 1, `recrypt holds ${sync} copies`);
      assert.ok(bytes <= sync, `recryptAsync holds ${bytes}, recrypt ${sync}`);
      assert.ok(
        fromBlob <= sync,
        `recryptAsync(Blob) holds ${fromBlob}, recrypt ${sync}`,
      );
    });

    it("enforces maxInputBytes before reading a Blob", async function () {
      var muhammara = await createMuhammaraWasm({
        limits: { maxInputBytes: 16 },
      });
      await assert.rejects(
        muhammara.recryptAsync(new Blob([new Uint8Array(32)])),
        /PDF input exceeds maxInputBytes/,
      );
    });

    /**
     * Counts how often the event loop turns while a call runs.
     * @param {function(): Promise<*>} run - Starts the call.
     * @returns {Promise<{result: *, turns: number}>} Its result and the turns.
     */
    async function turnsDuring(run) {
      var turns = 0;
      var running = true;
      /**
       * Counts one turn and queues the next.
       * @returns {void}
       */
      function turn() {
        if (!running) return;
        turns++;
        setImmediate(turn);
      }
      setImmediate(turn);
      try {
        return { result: await run(), turns };
      } finally {
        running = false;
      }
    }

    /**
     * Reads whether a recrypted PDF opens with `password` and is encrypted.
     * @param {object} muhammara - The Wasm API.
     * @param {Uint8Array} pdf - The recrypted PDF.
     * @param {string} [password] - The user password.
     * @returns {{encrypted: boolean, pages: number}} What the reader sees.
     */
    function readBack(muhammara, pdf, password) {
      var reader = muhammara.createReader(
        pdf,
        password ? { password } : undefined,
      );
      try {
        return {
          encrypted: reader.isEncrypted(),
          pages: reader.getPagesCount(),
        };
      } finally {
        reader.end();
      }
    }

    it("recrypts in a worker, leaving the event loop free", async function () {
      var muhammara = await createMuhammaraWasm();
      var source = muhammara.createBlankPdf(100, 100);
      // Earlier tests may have started the shared worker already, so recrypt
      // a PDF that takes long enough for the event loop to turn many times.
      var writer = muhammara.createWriter({ compress: false });
      for (var index = 0; index < 200; index++) {
        var page = writer.createPage(0, 0, 595, 842);
        var context = writer.startPageContentContext(page);
        for (var row = 0; row < 120; row++) {
          context
            .q()
            .rg(0.2, 0.4, 0.6)
            .re(40, 40 + row * 6, 500, 4)
            .f()
            .Q();
        }
        writer.writePage(page);
      }
      var large = writer.end();
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(large, { userPassword: "view" }),
      );
      // On the calling thread the recrypt runs in one turn.
      assert.ok(turns > 10, `the event loop turned ${turns} times`);
      assert.deepEqual(readBack(muhammara, result, "view"), {
        encrypted: true,
        pages: 200,
      });
      // The worker is reused and the source stays the caller's.
      var again = await muhammara.recryptAsync(source, {
        userPassword: "edit",
      });
      assert.deepEqual(readBack(muhammara, again, "edit"), {
        encrypted: true,
        pages: 1,
      });
      assert.equal(readBack(muhammara, source).encrypted, false);
    });

    it("recrypts on the calling thread with recryptWorker: false", async function () {
      var muhammara = await createMuhammaraWasm({ recryptWorker: false });
      var source = muhammara.createBlankPdf(100, 100);
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(source, { userPassword: "view" }),
      );
      assert.ok(turns <= 2, `the event loop turned ${turns} times`);
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
    });

    it("loads the binary its locateFile found in the worker", async function () {
      var located = [];
      var muhammara = await createMuhammaraWasm({
        locateFile: (file, prefix) => {
          located.push(file);
          return prefix + file;
        },
      });
      var source = muhammara.createBlankPdf(100, 100);
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(source, { userPassword: "view" }),
      );
      assert.ok(turns > 10, `the event loop turned ${turns} times`);
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
      // The worker reused the location instead of calling locateFile.
      assert.deepEqual(located, ["muhammara-wasm.wasm"]);
    });

    it("recrypts on the calling thread with options a worker cannot receive", async function () {
      var printed = [];
      var muhammara = await createMuhammaraWasm({
        print: (text) => printed.push(text),
      });
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(muhammara.createBlankPdf(100, 100), {
          userPassword: "view",
        }),
      );
      assert.ok(turns <= 2, `the event loop turned ${turns} times`);
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
    });

    it("rejects with the errors of recrypt from its worker", async function () {
      var muhammara = await createMuhammaraWasm();
      var encrypted = muhammara.recrypt(muhammara.createBlankPdf(100, 100), {
        userPassword: "view",
      });
      for (var [source, options] of [
        [new Uint8Array([1, 2, 3]), undefined],
        [encrypted, { password: "wrong" }],
        [encrypted, { password: "view", version: 99 }],
      ]) {
        var thrown;
        try {
          muhammara.recrypt(source, options);
        } catch (error) {
          thrown = error;
        }
        assert.ok(thrown, "recrypt throws");
        await assert.rejects(
          muhammara.recryptAsync(source, options),
          (error) => {
            assert.equal(error.constructor, thrown.constructor);
            assert.equal(error.message, thrown.message);
            return true;
          },
        );
      }
      // A failed job leaves the worker usable.
      var plain = await muhammara.recryptAsync(encrypted, { password: "view" });
      assert.equal(readBack(muhammara, plain).encrypted, false);
    });

    it("runs concurrent jobs in their own order and results", async function () {
      var muhammara = await createMuhammaraWasm();
      var source = muhammara.createBlankPdf(100, 100);
      var passwords = ["one", "two", "three", "four"];
      var results = await Promise.all(
        passwords.map((userPassword) =>
          muhammara.recryptAsync(source, { userPassword }),
        ),
      );
      results.forEach((result, index) => {
        assert.equal(
          readBack(muhammara, result, passwords[index]).encrypted,
          true,
        );
      });
    });

    it("applies the instance limits in its worker", async function () {
      var source = (await createMuhammaraWasm()).createBlankPdf(100, 100);
      var muhammara = await createMuhammaraWasm({
        limits: { maxOutputBytes: source.length / 2 },
      });
      var { turns } = await turnsDuring(() =>
        assert.rejects(muhammara.recryptAsync(source), (error) => {
          assert.ok(error instanceof RangeError);
          assert.equal(error.message, "PDF output exceeds maxOutputBytes");
          return true;
        }),
      );
      assert.ok(turns > 10, `the event loop turned ${turns} times`);
    });

    /**
     * Counts the worker_threads workers recryptAsync() hosts start and stop
     * while it is installed.
     * @returns {{started: number, exited: number, restore: function(): void}}
     *   The live counts and a function that removes the counter.
     */
    function countWorkers() {
      var getBuiltinModule = process.getBuiltinModule;
      var workerThreads = getBuiltinModule("node:worker_threads");
      var counts = { started: 0, exited: 0 };
      /** A worker that counts its start and exit. */
      class CountingWorker extends workerThreads.Worker {
        constructor(...args) {
          super(...args);
          counts.started++;
          this.on("exit", () => counts.exited++);
        }
      }
      var counting = { ...workerThreads, Worker: CountingWorker };
      process.getBuiltinModule = (id) =>
        id === "node:worker_threads"
          ? counting
          : getBuiltinModule.call(process, id);
      counts.restore = () => {
        process.getBuiltinModule = getBuiltinModule;
      };
      return counts;
    }

    it("shares one worker between instances loaded the same way", async function () {
      var counts = countWorkers();
      try {
        // Limits no other test uses, so the instances get a new shared worker.
        var limits = { maxOutputBytes: 123456789 };
        var first = await createMuhammaraWasm({ limits });
        var second = await createMuhammaraWasm({ limits });
        var source = first.createBlankPdf(100, 100);
        await Promise.all([
          first.recryptAsync(source, { userPassword: "one" }),
          second.recryptAsync(source, { userPassword: "two" }),
        ]);
        await first.recryptAsync(source);
      } finally {
        counts.restore();
      }
      assert.equal(counts.started, 1);
    });

    it("keeps its own copy of a wasmBinary the caller transfers away", async function () {
      var binary = fs.readFileSync(
        new URL("../../dist/muhammara-wasm.wasm", import.meta.url),
      ).buffer;
      binary = binary.slice(0);
      var muhammara = await createMuhammaraWasm({ wasmBinary: binary });
      structuredClone(binary, { transfer: [binary] });
      assert.equal(binary.byteLength, 0, "the caller's buffer is detached");
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(muhammara.createBlankPdf(100, 100), {
          userPassword: "view",
        }),
      );
      assert.ok(turns > 10, `the event loop turned ${turns} times`);
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
    });

    it("stops the worker of a wasmBinary instance once it is collected", async function () {
      var binary = new Uint8Array(
        fs.readFileSync(
          new URL("../../dist/muhammara-wasm.wasm", import.meta.url),
        ),
      );
      var counts = countWorkers();
      v8.setFlagsFromString("--expose-gc");
      var gc = vm.runInNewContext("gc");
      v8.setFlagsFromString("--no-expose-gc");
      try {
        // Keeps the instance out of this function's scope, so it can be
        // collected.
        await (async () => {
          var muhammara = await createMuhammaraWasm({ wasmBinary: binary });
          await muhammara.recryptAsync(muhammara.createBlankPdf(100, 100));
        })();
        assert.equal(counts.started, 1);
        for (var attempt = 0; attempt < 50 && counts.exited < 1; attempt++) {
          gc();
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } finally {
        counts.restore();
      }
      assert.equal(counts.exited, 1);
    });

    it("finishes running jobs when a wasmBinary instance's worker closes", async function () {
      var muhammara = await createMuhammaraWasm();
      // Installed first: the host reads worker_threads when it is created.
      var counts = countWorkers();
      var host = recryptWorkerHost({
        wasmBinary: new Uint8Array(
          fs.readFileSync(
            new URL("../../dist/muhammara-wasm.wasm", import.meta.url),
          ),
        ),
        maxInputBytes: 1024 * 1024,
        maxOutputBytes: 1024 * 1024,
      });
      var options = {
        password: "",
        userPassword: "view",
        ownerPassword: "",
        userProtectionFlag: 4,
        version: 0,
        compress: true,
      };
      try {
        // Start the worker, then close while the next job is in it.
        await host.run(muhammara.createBlankPdf(100, 100), options);
        var running = host.run(muhammara.createBlankPdf(100, 100), options);
        await new Promise((resolve) => setImmediate(resolve));
        // What a garbage-collected instance does to its worker.
        host.close();
        var timeout;
        var result = await Promise.race([
          running,
          new Promise((resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error("the job never settled")),
              10000,
            );
          }),
        ]);
        clearTimeout(timeout);
        // Closed hosts keep later jobs on the calling thread.
        assert.equal(
          await host.run(muhammara.createBlankPdf(100, 100), options),
          null,
        );
        for (var attempt = 0; attempt < 50 && counts.exited < 1; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } finally {
        counts.restore();
      }
      assert.ok(result, "the job ran in the worker");
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
      assert.equal(counts.started, 1);
      assert.equal(counts.exited, 1);
    });

    it("keeps its own copy of a Buffer wasmBinary the caller transfers away", async function () {
      var binary = Buffer.from(
        fs.readFileSync(
          new URL("../../dist/muhammara-wasm.wasm", import.meta.url),
        ),
      );
      // A Buffer of its own, not a slice of Node's shared pool.
      binary = Buffer.from(
        binary.buffer.slice(
          binary.byteOffset,
          binary.byteOffset + binary.length,
        ),
      );
      var muhammara = await createMuhammaraWasm({ wasmBinary: binary });
      structuredClone(binary.buffer, { transfer: [binary.buffer] });
      assert.equal(binary.length, 0, "the caller's Buffer is detached");
      var { result, turns } = await turnsDuring(() =>
        muhammara.recryptAsync(muhammara.createBlankPdf(100, 100), {
          userPassword: "view",
        }),
      );
      assert.ok(turns > 10, `the event loop turned ${turns} times`);
      assert.equal(readBack(muhammara, result, "view").encrypted, true);
    });

    it("rejects a recryptWorker option that is not a boolean", async function () {
      await assert.rejects(
        createMuhammaraWasm({ recryptWorker: "no" }),
        (error) => {
          assert.ok(error instanceof TypeError);
          assert.equal(error.message, "recryptWorker must be a boolean");
          return true;
        },
      );
    });
  });
});
