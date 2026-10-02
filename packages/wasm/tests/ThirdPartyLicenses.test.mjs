import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

    it("reads the notices from the binary's bytes, Blob or File", async function () {
      var bytes = new Uint8Array(await readFile(wasmUrl));
      var expected = await readFile(licensesUrl, "utf8");
      var Recipe = await createRecipe({
        wasmBinary: bytes,
        defaultFont: false,
      });
      for (var source of [
        bytes,
        bytes.buffer,
        new Blob([bytes]),
        new File([bytes], "muhammara-wasm.wasm"),
      ]) {
        assert.equal(await Recipe.thirdPartyLicenses(source), expected);
      }
    });

    it("fetches the binary from a URL", async function () {
      var bytes = await readFile(wasmUrl);
      var expected = await readFile(licensesUrl, "utf8");
      var Recipe = await createRecipe({ defaultFont: false });
      var dataUrl = `data:application/wasm;base64,${bytes.toString("base64")}`;
      assert.equal(await Recipe.thirdPartyLicenses(dataUrl), expected);
      assert.equal(await Recipe.thirdPartyLicenses(new URL(dataUrl)), expected);
      // Node's fetch() cannot load file: URLs.
      for (var fileSource of [wasmUrl, wasmUrl.href]) {
        await assert.rejects(Recipe.thirdPartyLicenses(fileSource), (error) => {
          assert.ok(error instanceof TypeError);
          assert.ok(error.cause instanceof Error);
          assert.equal(
            error.message,
            `Recipe.thirdPartyLicenses() could not fetch ${wasmUrl.href}; where fetch() cannot load file: URLs, as in Node, read the file and pass its bytes`,
          );
          return true;
        });
      }

      var fetchFunction = globalThis.fetch;
      var requests = [];
      try {
        globalThis.fetch = async (url, init) => {
          requests.push([url, init]);
          return String(url).endsWith("/missing.wasm")
            ? new Response(null, { status: 404 })
            : new Response(bytes);
        };
        assert.equal(
          await Recipe.thirdPartyLicenses("/assets/muhammara-wasm.wasm"),
          expected,
        );
        await assert.rejects(
          Recipe.thirdPartyLicenses("/assets/missing.wasm"),
          /^Error: Failed to load \/assets\/missing\.wasm: HTTP 404$/,
        );
        assert.deepEqual(requests, [
          ["/assets/muhammara-wasm.wasm", { credentials: "same-origin" }],
          ["/assets/missing.wasm", { credentials: "same-origin" }],
        ]);
        // An Electron renderer can fetch file: URLs, so they are not rejected,
        // and a failure there keeps the request's error as its cause.
        assert.equal(await Recipe.thirdPartyLicenses(wasmUrl), expected);
        var missingFile = new URL("missing.wasm", packageRoot);
        var fetchFailure = new TypeError("Failed to fetch");
        globalThis.fetch = async () => {
          throw fetchFailure;
        };
        await assert.rejects(
          Recipe.thirdPartyLicenses(missingFile),
          (error) => {
            assert.ok(error instanceof TypeError);
            assert.equal(error.cause, fetchFailure);
            assert.equal(
              error.message,
              `Recipe.thirdPartyLicenses() could not fetch ${missingFile.href}; where fetch() cannot load file: URLs, as in Node, read the file and pass its bytes`,
            );
            return true;
          },
        );
        // Other failed requests reject with fetch()'s own error.
        await assert.rejects(
          Recipe.thirdPartyLicenses("https://example.com/muhammara-wasm.wasm"),
          (error) => error === fetchFailure,
        );
      } finally {
        globalThis.fetch = fetchFunction;
      }
    });

    it("rejects a binary without a license section or that is not wasm", async function () {
      var Recipe = await createRecipe({ defaultFont: false });
      var stripped = stripSection(
        new Uint8Array(await readFile(wasmUrl)),
        "license",
      );
      await assert.rejects(
        Recipe.thirdPartyLicenses(stripped),
        /no "license" section; a tool such as wasm-strip.*THIRD_PARTY_LICENSES\.md/,
      );
      await assert.rejects(
        Recipe.thirdPartyLicenses(new TextEncoder().encode("not wasm")),
        /Not a version-1 WebAssembly module/,
      );
    });

    it("rejects a source that is not a URL, bytes, Blob or File", async function () {
      var Recipe = await createRecipe({ defaultFont: false });
      for (var source of [
        undefined,
        42,
        new Uint16Array(4),
        {},
        await WebAssembly.compile(minimalModule),
      ]) {
        await assert.rejects(
          Recipe.thirdPartyLicenses(source),
          new TypeError(
            "Recipe.thirdPartyLicenses() source must be a URL, a Uint8Array or ArrayBuffer, or a Blob or File",
          ),
        );
      }
    });
  });

  describe("loading through Emscripten", function () {
    it("passes locateFile the package's dist directory", async function () {
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
      assert.ok(new Recipe().createPage("A4").endPage().endPDF().length > 0);
    });

    it("loads the binary next to the glue when bundled without dist/", async function () {
      // A bundler that does not rewrite import.meta.url puts the glue and the
      // binary next to the bundle; the runtime must not look in a dist/ folder.
      var bundle = await mkdtemp(path.join(tmpdir(), "muhammara-wasm-bundle-"));
      try {
        var packagePath = fileURLToPath(packageRoot);
        for (var name of ["lib", "fonts"]) {
          await cp(path.join(packagePath, name), path.join(bundle, name), {
            recursive: true,
          });
        }
        for (var name of ["muhammara-wasm.js", "muhammara-wasm.wasm"]) {
          await cp(
            path.join(packagePath, "dist", name),
            path.join(bundle, name),
          );
        }
        var index = await readFile(new URL("index.js", packageRoot), "utf8");
        assert.ok(index.includes('from "./dist/muhammara-wasm.js"'));
        await writeFile(
          path.join(bundle, "index.js"),
          index.replace(
            'from "./dist/muhammara-wasm.js"',
            'from "./muhammara-wasm.js"',
          ),
        );
        var bundled = await import(
          pathToFileURL(path.join(bundle, "index.js")).href
        );
        var prefixes = [];
        var Recipe = await bundled.createRecipe({
          defaultFont: false,
          locateFile(file, prefix) {
            prefixes.push(prefix);
            return prefix + file;
          },
        });
        assert.deepEqual(prefixes, [bundle + path.sep]);
        assert.ok(new Recipe().createPage("A4").endPage().endPDF().length > 0);
        var Default = await bundled.createRecipe({ defaultFont: false });
        assert.ok(new Default().createPage("A4").endPage().endPDF().length > 0);
      } finally {
        await rm(bundle, { recursive: true, force: true });
      }
    });

    it("fails to load through onAbort and printErr", async function () {
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

    it("lets a caller's instantiateWasm hook load the module", async function () {
      var bytes = await readFile(wasmUrl);
      var hooked = 0;
      var Hooked = await createRecipe({
        defaultFont: false,
        instantiateWasm(imports, receiveInstance) {
          hooked += 1;
          WebAssembly.instantiate(bytes, imports).then(({ instance }) =>
            receiveInstance(instance),
          );
          return {};
        },
      });
      assert.equal(hooked, 1);
      assert.ok(new Hooked().createPage("A4").endPage().endPDF().length > 0);
    });
  });
});
