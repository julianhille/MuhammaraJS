import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createMuhammaraWasm, createRecipe } from "../index.js";
import { checkLicenses } from "../scripts/check-licenses.mjs";
import { extractLicenses } from "../scripts/generate-licenses.mjs";
import { components, extractPiece } from "../scripts/third-party-licenses.mjs";
import {
  customSections,
  encodeCustomSection,
  insertLicenseSection,
  readSections,
} from "../scripts/wasm-section.mjs";

var packageRoot = new URL("../", import.meta.url);
var licensesUrl = new URL("dist/THIRD_PARTY_LICENSES.md", packageRoot);
var wasmUrl = new URL("dist/muhammara-wasm.wasm", packageRoot);
// A module with only a type section declaring one () -> () function type.
var minimalModule = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00,
  0x00,
]);

/**
 * Removes every custom section with the given name, like wasm-strip.
 * @param {Uint8Array} bytes - Module bytes.
 * @param {string} name - Section name.
 * @returns {Uint8Array} The stripped module.
 */
function stripSection(bytes, name) {
  var kept = readSections(bytes).filter((section) => section.name !== name);
  var parts = [
    bytes.subarray(0, 8),
    ...kept.map((s) => bytes.subarray(s.start, s.end)),
  ];
  var output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  var offset = 0;
  for (var part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/**
 * Counts non-overlapping occurrences of a string.
 * @param {string} text - Text to search.
 * @param {string} search - Searched string.
 * @returns {number} The count.
 */
function count(text, search) {
  return text.split(search).length - 1;
}

describe("Third-party licenses", function () {
  describe("custom section", function () {
    it("inserts the license section directly after the header", function () {
      var text = "# Licenses\n\nÄ ✓\n";
      var output = insertLicenseSection(minimalModule, text);
      var sections = readSections(output);
      assert.equal(sections[0].name, "license");
      assert.equal(sections[0].start, 8);
      assert.deepEqual(
        output.subarray(sections[1].start),
        minimalModule.subarray(8),
      );
      var module = new WebAssembly.Module(output);
      var embedded = WebAssembly.Module.customSections(module, "license");
      assert.equal(embedded.length, 1);
      assert.equal(new TextDecoder().decode(embedded[0]), text);
    });

    it("stores the text as plain UTF-8 readable from the start of the file", function () {
      var text = "x".repeat(300);
      var output = insertLicenseSection(minimalModule, text);
      // id, two-byte size, name length, "license"
      var start = 8 + 1 + 2 + 1 + "license".length;
      assert.equal(
        new TextDecoder().decode(output.subarray(start, start + 300)),
        text,
      );
    });

    it("refuses a module that already has a license section anywhere", function () {
      var trailing = new Uint8Array([
        ...minimalModule,
        ...encodeCustomSection("license", new Uint8Array([0x61])),
      ]);
      assert.throws(
        () => insertLicenseSection(trailing, "again"),
        /already has a "license" section/,
      );
      assert.throws(
        () =>
          insertLicenseSection(insertLicenseSection(minimalModule, "a"), "b"),
        /already has a "license" section/,
      );
    });

    it("refuses bytes that are not a version-1 wasm module", function () {
      var version2 = minimalModule.slice();
      version2[4] = 2;
      for (var bytes of [
        new Uint8Array(),
        new TextEncoder().encode("not wasm"),
        version2,
      ]) {
        assert.throws(
          () => insertLicenseSection(bytes, "text"),
          /Not a version-1 WebAssembly module/,
        );
      }
      assert.throws(
        () => insertLicenseSection(minimalModule.subarray(0, 12), "text"),
        /Truncated/,
      );
    });
  });

  describe("generated notices", function () {
    /**
     * Returns one component's section of the notices.
     * @param {string} text - The notices.
     * @param {string} name - Component name.
     * @returns {string} The section.
     */
    function section(text, name) {
      var heading = `\n## ${name}\n`;
      var start = text.indexOf(heading);
      var next = text.indexOf("\n## ", start + heading.length);
      return text.slice(start, next === -1 ? undefined : next);
    }

    it("passes the build output check against the current sources", async function () {
      assert.deepEqual(await checkLicenses(), []);
    });

    it("lists every component in the table and gives each its own section", async function () {
      var text = await readFile(licensesUrl, "utf8");
      var table = text.slice(0, text.indexOf("\n## "));
      var extracted = await extractLicenses({ skipEmscripten: true });
      for (var component of components) {
        assert.equal(
          count(table, `\n| ${component.name} | `),
          1,
          component.name,
        );
        assert.equal(count(text, `\n## ${component.name}\n`), 1);
        if (extracted.has(component.name)) {
          assert.ok(
            section(text, component.name).includes(
              extracted.get(component.name),
            ),
            component.name,
          );
        }
      }
    });

    it("repeats a license text for every component that uses it", async function () {
      var text = await readFile(licensesUrl, "utf8");
      var apache =
        "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION";
      for (var name of [
        "PDFWriter",
        "Roboto Regular",
        "libc++",
        "libc++abi",
        "compiler-rt",
      ]) {
        assert.equal(count(section(text, name), apache), 1, name);
      }
      assert.equal(count(text, apache), 5);
    });

    it("fails loudly when a license source or marker is missing", async function () {
      await assert.rejects(
        extractPiece({ file: "packages/wasm/missing-license.txt" }),
        /missing-license\.txt cannot be read/,
      );
      await assert.rejects(
        extractPiece({
          file: "packages/wasm/package.json",
          start: "no such start marker",
          end: "}",
        }),
        /Start of the license text not found/,
      );
      await assert.rejects(
        extractPiece({
          file: "packages/wasm/package.json",
          start: '"name"',
          end: "no such end marker",
        }),
        /End of the license text not found/,
      );
      await assert.rejects(
        extractPiece({ file: "LICENSE", emscripten: true }),
        /--emscripten-root/,
      );
    });
  });

  describe("built module", function () {
    it("carries the notices as its first and only license section", async function () {
      var bytes = new Uint8Array(await readFile(wasmUrl));
      var sections = readSections(bytes);
      assert.equal(sections[0].name, "license");
      assert.equal(sections[0].start, 8);
      assert.equal(customSections(bytes, "license").length, 1);
      var embedded = WebAssembly.Module.customSections(
        await WebAssembly.compile(bytes),
        "license",
      );
      assert.equal(embedded.length, 1);
      assert.deepEqual(
        new Uint8Array(embedded[0]),
        new Uint8Array(await readFile(licensesUrl)),
      );
    });
  });

  describe("Recipe.thirdPartyLicenses()", function () {
    it("is no longer a top-level export or part of the low-level API", async function () {
      var exports = await import("../index.js");
      assert.equal("thirdPartyLicenses" in exports, false);
      assert.equal(
        "thirdPartyLicenses" in (await createMuhammaraWasm()),
        false,
      );
    });

    it("returns the embedded notices of the loaded module", async function () {
      var Recipe = await createRecipe({ defaultFont: false });
      assert.equal(
        Recipe.thirdPartyLicenses(),
        await readFile(licensesUrl, "utf8"),
      );
    });

    it("reads the module compiled from wasmBinary", async function () {
      var bytes = new Uint8Array(await readFile(wasmUrl));
      var Recipe = await createRecipe({
        wasmBinary: bytes.buffer,
        defaultFont: false,
      });
      assert.ok(new Recipe().createPage("A4").endPage().endPDF().length > 0);
      assert.equal(
        Recipe.thirdPartyLicenses(),
        await readFile(licensesUrl, "utf8"),
      );
    });

    it("reads each runtime's own module", async function () {
      var stripped = stripSection(
        new Uint8Array(await readFile(wasmUrl)),
        "license",
      );
      var Stripped = await createRecipe({
        wasmBinary: stripped,
        defaultFont: false,
      });
      var Full = await createRecipe({ defaultFont: false });
      assert.throws(
        () => Stripped.thirdPartyLicenses(),
        /no "license" section; a tool such as wasm-strip.*THIRD_PARTY_LICENSES\.md/,
      );
      assert.equal(
        Full.thirdPartyLicenses(),
        await readFile(licensesUrl, "utf8"),
      );
    });

    it("passes locateFile the package's dist directory, as Emscripten does", async function () {
      var calls = [];
      var Recipe = await createRecipe({
        defaultFont: false,
        locateFile(path, prefix) {
          calls.push([path, prefix]);
          return prefix + path;
        },
      });
      assert.deepEqual(calls, [
        ["muhammara-wasm.wasm", fileURLToPath(new URL("dist/", packageRoot))],
      ]);
      assert.equal(
        Recipe.thirdPartyLicenses(),
        await readFile(licensesUrl, "utf8"),
      );
    });

    it("fails to load through onAbort and printErr, as Emscripten does", async function () {
      // Imports x.y, which the runtime does not provide.
      var unlinkable = new Uint8Array([
        ...minimalModule,
        0x02,
        0x07,
        0x01,
        0x01,
        0x78,
        0x01,
        0x79,
        0x00,
        0x00,
      ]);
      for (var [options, reason] of [
        [
          {
            locateFile: () =>
              fileURLToPath(new URL("missing.wasm", packageRoot)),
          },
          /ENOENT/,
        ],
        [{ wasmBinary: new TextEncoder().encode("not wasm") }, /CompileError/],
        [{ wasmBinary: unlinkable }, /LinkError|TypeError/],
      ]) {
        var aborted = [];
        var printed = [];
        var error = await createRecipe({
          ...options,
          defaultFont: false,
          onAbort: (what) => aborted.push(what),
          printErr: (message) => printed.push(message),
        }).catch((caught) => caught);
        assert.ok(error instanceof WebAssembly.RuntimeError);
        assert.match(error.message, /^Aborted\(/);
        assert.match(error.message, reason);
        assert.equal(aborted.length, 1);
        assert.match(String(aborted[0]), reason);
        assert.equal(printed.length, 2);
        assert.equal(
          printed[0],
          `failed to asynchronously prepare wasm: ${aborted[0]}`,
        );
        assert.equal(printed[1], `Aborted(${aborted[0]})`);
      }
    });

    it("reports a failed streaming compile before falling back, as Emscripten does", async function () {
      var bytes = await readFile(wasmUrl);
      var fetchFunction = globalThis.fetch;
      var processType = process.type;
      var requests = 0;
      var printed = [];
      // Run the browser loader: Emscripten's own test treats an Electron
      // renderer as a browser.
      process.type = "renderer";
      try {
        globalThis.fetch = async () => {
          requests += 1;
          return new Response(bytes, {
            headers: { "Content-Type": "application/octet-stream" },
          });
        };
        var Recipe = await createRecipe({
          defaultFont: false,
          printErr: (message) => printed.push(message),
        });
        assert.equal(requests, 2);
        assert.equal(printed.length, 2);
        assert.match(printed[0], /^wasm streaming compile failed: TypeError/);
        assert.equal(printed[1], "falling back to ArrayBuffer instantiation");
        assert.equal(
          Recipe.thirdPartyLicenses(),
          await readFile(licensesUrl, "utf8"),
        );

        globalThis.fetch = async () => new Response(null, { status: 404 });
        printed = [];
        var error = await createRecipe({
          defaultFont: false,
          printErr: (message) => printed.push(message),
        }).catch((caught) => caught);
        assert.ok(error instanceof WebAssembly.RuntimeError);
        assert.match(error.message, /^Aborted\(Error: 404 : /);
        assert.equal(printed.at(-1), "Aborted(Error: 404 : )");
      } finally {
        globalThis.fetch = fetchFunction;
        if (processType === undefined) delete process.type;
        else process.type = processType;
      }
    });

    it("keeps the module from a caller's instantiateWasm hook", async function () {
      var bytes = await readFile(wasmUrl);
      var hooked = 0;
      var Hooked = await createRecipe({
        defaultFont: false,
        instantiateWasm(imports, receiveInstance) {
          hooked += 1;
          WebAssembly.instantiate(bytes, imports).then(({ instance, module }) =>
            receiveInstance(instance, module),
          );
          return {};
        },
      });
      assert.equal(hooked, 1);
      assert.equal(
        Hooked.thirdPartyLicenses(),
        await readFile(licensesUrl, "utf8"),
      );
    });

    it("throws when the WebAssembly module is not loaded", async function () {
      var bytes = await readFile(wasmUrl);
      var Unloaded = await createRecipe({
        defaultFont: false,
        instantiateWasm(imports, receiveInstance) {
          WebAssembly.instantiate(bytes, imports).then(({ instance }) =>
            receiveInstance(instance),
          );
          return {};
        },
      });
      assert.throws(
        () => Unloaded.thirdPartyLicenses(),
        /The WebAssembly module is not loaded.*THIRD_PARTY_LICENSES\.md/,
      );
    });
  });
});
