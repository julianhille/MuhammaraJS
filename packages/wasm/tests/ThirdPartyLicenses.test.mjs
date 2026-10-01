import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  createMuhammaraWasm,
  createRecipe,
  thirdPartyLicenses,
} from "../index.js";
import {
  generateLicenses,
  readManifest,
} from "../scripts/generate-licenses.mjs";
import {
  customSections,
  encodeCustomSection,
  insertLicenseSection,
  readSections,
} from "../scripts/wasm-section.mjs";

var packageRoot = new URL("../", import.meta.url);
var licensesUrl = new URL("THIRD_PARTY_LICENSES.md", packageRoot);
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
    it("matches the committed THIRD_PARTY_LICENSES.md", async function () {
      assert.equal(
        await readFile(licensesUrl, "utf8"),
        await generateLicenses(),
      );
    });

    it("lists every component in the table and gives each its own section", async function () {
      var text = await readFile(licensesUrl, "utf8");
      var { components } = await readManifest();
      var table = text.slice(0, text.indexOf("\n## "));
      for (var component of components) {
        assert.equal(
          count(table, `\n| ${component.name} | `),
          1,
          component.name,
        );
        var heading = `\n## ${component.name}\n`;
        assert.equal(count(text, heading), 1, component.name);
        var start = text.indexOf(heading);
        var next = text.indexOf("\n## ", start + heading.length);
        var section = text.slice(start, next === -1 ? undefined : next);
        for (var file of component.files) {
          var license = (
            await readFile(new URL(file, packageRoot), "utf8")
          ).replace(/\n+$/, "");
          assert.ok(section.includes(license), `${component.name}: ${file}`);
        }
      }
    });

    it("repeats each license text for every component that uses it", async function () {
      var text = await readFile(licensesUrl, "utf8");
      var { components } = await readManifest();
      var bodies = await Promise.all(
        components.map(async (component) =>
          (
            await Promise.all(
              component.files.map((file) =>
                readFile(new URL(file, packageRoot), "utf8"),
              ),
            )
          ).join("\n"),
        ),
      );
      for (var phrase of [
        "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION",
        "Permission is hereby granted, free of charge, to any person obtaining",
        "The FreeType Project LICENSE",
      ]) {
        var expected = bodies.reduce(
          (sum, body) => sum + count(body, phrase),
          0,
        );
        assert.ok(expected > 0, phrase);
        assert.equal(count(text, phrase), expected, phrase);
      }
      var apacheUsers = bodies.filter((body) =>
        body.includes(
          "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION",
        ),
      ).length;
      assert.ok(apacheUsers >= 5);
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

  describe("thirdPartyLicenses()", function () {
    it("throws before a module is initialized", async function () {
      var fresh = await import("../index.js?third-party-licenses-before-init");
      assert.throws(
        () => fresh.thirdPartyLicenses(),
        /await createMuhammaraWasm\(\) or createRecipe\(\) first.*THIRD_PARTY_LICENSES\.md/,
      );
    });

    it("returns the embedded notices of the loaded module", async function () {
      var expected = await readFile(licensesUrl, "utf8");
      await createMuhammaraWasm();
      assert.equal(thirdPartyLicenses(), expected);
      await createRecipe({ defaultFont: false });
      assert.equal(thirdPartyLicenses(), expected);
    });

    it("reads the module compiled from wasmBinary", async function () {
      var bytes = new Uint8Array(await readFile(wasmUrl));
      var muhammara = await createMuhammaraWasm({ wasmBinary: bytes.buffer });
      assert.equal(
        new TextDecoder().decode(
          muhammara.createBlankPdf(10, 10).subarray(0, 5),
        ),
        "%PDF-",
      );
      assert.equal(thirdPartyLicenses(), await readFile(licensesUrl, "utf8"));
    });

    it("throws when the loaded module has no license section", async function () {
      var stripped = stripSection(
        new Uint8Array(await readFile(wasmUrl)),
        "license",
      );
      await createMuhammaraWasm({ wasmBinary: stripped });
      assert.throws(
        () => thirdPartyLicenses(),
        /no "license" section; a tool such as wasm-strip.*THIRD_PARTY_LICENSES\.md/,
      );
    });

    it("passes locateFile the package's dist directory, as Emscripten does", async function () {
      var calls = [];
      await createMuhammaraWasm({
        locateFile(path, prefix) {
          calls.push([path, prefix]);
          return prefix + path;
        },
      });
      assert.deepEqual(calls, [
        ["muhammara-wasm.wasm", fileURLToPath(new URL("dist/", packageRoot))],
      ]);
      assert.equal(thirdPartyLicenses(), await readFile(licensesUrl, "utf8"));
    });

    it("rejects when the binary cannot be loaded", async function () {
      await assert.rejects(
        createMuhammaraWasm({
          locateFile: () => fileURLToPath(new URL("missing.wasm", packageRoot)),
        }),
        /ENOENT/,
      );
    });

    it("keeps the module from a caller's instantiateWasm hook", async function () {
      var bytes = await readFile(wasmUrl);
      var hooked = 0;
      await createMuhammaraWasm({
        instantiateWasm(imports, receiveInstance) {
          hooked += 1;
          WebAssembly.instantiate(bytes, imports).then(({ instance, module }) =>
            receiveInstance(instance, module),
          );
          return {};
        },
      });
      assert.equal(hooked, 1);
      assert.equal(thirdPartyLicenses(), await readFile(licensesUrl, "utf8"));

      await createMuhammaraWasm({
        instantiateWasm(imports, receiveInstance) {
          WebAssembly.instantiate(bytes, imports).then(({ instance }) =>
            receiveInstance(instance),
          );
          return {};
        },
      });
      assert.throws(
        () => thirdPartyLicenses(),
        /custom instantiateWasm hook did not pass it/,
      );
    });
  });
});
