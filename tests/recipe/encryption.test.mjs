import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { info, withReader } from "../support/pdf.mjs";
import {
  encryption,
  infoWith,
  opens,
  permissionsEntry,
} from "../support/metadata.mjs";

// The encryption a PDF 1.7 document gets: AES-128.
var AES_128 = { V: 4, R: 4, Length: 128 };
// The encryption a PDF 1.3 source gets: RC4 with a 40-bit key.
var RC4_40 = { V: 1, R: 2 };
// The encryption a PDF 2.0 document gets: AES-256.
var AES_256 = { V: 5, R: 6, Length: 256 };
// The flag permission() returns by default, and PDFWriter uses without one.
var PRINT = 4;

/**
 * Assert the encryption dictionary of a PDF, read with a password that opens
 * it.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {string|undefined} password - A password that opens it.
 * @param {object} expected - The expected /V, /R and /Length.
 * @param {number} [flag=PRINT] - The expected user protection flag.
 * @returns {void}
 */
function assertEncrypted(end, bytes, password, expected, flag = PRINT) {
  var { pages, ...dictionary } = encryption(end, bytes, password);
  assert.ok(pages > 0, `the password ${password} opens the PDF`);
  assert.deepEqual(dictionary, {
    encrypted: true,
    ...expected,
    P: permissionsEntry(flag),
  });
}

describeEnds("Recipe encryption", function (end) {
  it("opens a source that needs its user password", function () {
    var recipe = end.openRecipe("ProtectedAES256.pdf", { password: "user" });
    assert.equal(recipe.pageInfo(1).width, 200);
    assert.equal(recipe.pageInfo(1).height, 300);
    // the Info of a source that needs its user password is not read
    assert.deepEqual(recipe.info(), {});
    assert.equal(recipe.xmp(), undefined);
    // the writer would encrypt new entries with a key that does not match
    assert.throws(() => recipe.endPDF(), {
      message:
        "Editing a password-protected source is unsupported; decrypt it with recrypt() first",
    });
  });

  // GH-1003: an encrypted source is read only with its password.
  it("reads an encrypted source only with its password", function () {
    // each end words it as it always has
    var pages0 = {
      name: "Error",
      message:
        (end.name === "native" ? "HummusJS: " : "") +
        "Unable to read/edit PDF file (pages=0)",
    };
    assert.throws(() => end.openRecipe("PDFWithPassword.PDF"), pages0);
    assert.throws(
      () => end.openRecipe("PDFWithPassword.PDF", { password: "wrong" }),
      pages0,
    );
    var recipe = end.openRecipe("PDFWithPassword.PDF", { password: "user" });
    assert.equal(recipe.pageInfo(1).width, 595);
    assert.equal(recipe.pageInfo(1).height, 842);
    var aes = new Uint8Array(readFileSync(fixture("ProtectedAES256.pdf")));
    assert.throws(() => end.openRecipe("recipe/test2.pdf").read(aes), pages0);
    assert.equal(recipe.read(aes)[1].width, 200);
    var aesRecipe = end.openRecipe(aes, { password: "user" });
    assert.equal(aesRecipe.pageInfo(1).height, 300);
    // Editing stays unsupported, so no output is written over the encryption.
    assert.throws(
      () => aesRecipe.info({ title: "T" }).endPDF(),
      /Editing a password-protected source is unsupported/,
    );
  });

  it("edits a source only an owner password protects without a password", function () {
    var ownerOnly = end
      .newRecipe({ ownerPassword: "own" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    var edited = end
      .openRecipe(ownerOnly)
      .editPage(1)
      .text("Edited", 10, 10, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "encryption-owner-only-edited", edited);
    assertEncrypted(end, edited, undefined, AES_128);
  });

  it("reads and edits the Info of a source only an owner password protects", function () {
    var created = end
      .newRecipe({ password: "owner", title: "Original" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    [
      { source: created, title: "Original", fromRecipe: true },
      { source: "recipe/xmp-plain-metadata.pdf", title: "Plain" },
    ].forEach(({ source, title, fromRecipe }) => {
      var recipe = end.openRecipe(source, { password: "owner" });
      assert.equal(recipe.info().title, title);
      var edited = recipe.info({ author: "A" }).endPDF();
      writeOutput(end, `encryption-owner-only-info-${title}`, edited);
      // read without a password, which decrypts an owner-only PDF with the
      // right key
      var entries = info(end, edited);
      assert.equal(entries.Title, title);
      assert.equal(entries.Author, "A");
      if (fromRecipe) assert.match(entries["source-Producer"], /^MuhammaraJS/);
    });
  });

  it("encrypts a new PDF with the constructor passwords", function () {
    var recipe = end
      .newRecipe({ userPassword: "view", ownerPassword: "edit" })
      .createPage(100, 100)
      .endPage();
    var encrypted = recipe.endPDF();
    writeOutput(end, "encryption-user-owner-passwords", encrypted);
    // a repeated endPDF() hands out the same result
    assert.strictEqual(recipe.endPDF(), encrypted);
    assert.equal(opens(end, encrypted), false);
    assertEncrypted(end, encrypted, "view", AES_128);
    assert.equal(opens(end, encrypted, "edit"), true);
  });

  // The annotation and insert passes reopen the output, which a writer
  // encrypted at creation could not give them.
  it("encrypts a new PDF with comments and inserted pages", function () {
    var bytes = end
      .newRecipe({ userPassword: "view", ownerPassword: "edit" })
      .createPage(100, 100)
      .comment("encrypted", 10, 10)
      .endPage()
      .insertPage(1, end.pdf("Original.pdf"), 1)
      .endPDF();
    writeOutput(end, "encryption-new-comment-insert", bytes);
    assertEncrypted(end, bytes, "view", AES_128);
    var counts = withReader(
      end,
      bytes,
      (reader) => [
        reader.getPagesCount(),
        reader
          .queryDictionaryObject(reader.parsePageDictionary(0), "Annots")
          .toPDFArray()
          .toJSArray().length,
      ],
      { password: "view" },
    );
    assert.deepEqual(counts, [2, 1]);
  });

  it("encrypts a new PDF with a constructor permission password", function () {
    var bytes = end
      .newRecipe({ password: "123" })
      .createPage("letter")
      .text("an empty view password opens it", 150, 300, { font: "arial" })
      .endPage()
      .endPDF();
    writeOutput(end, "encryption-new-permission-password", bytes);
    assertEncrypted(end, bytes, undefined, AES_128);
  });

  it("encrypts a new PDF with a constructor edit password and flag", function () {
    var bytes = end
      .newRecipe({ ownerPassword: "123", userProtectionFlag: 3900 })
      .createPage("letter")
      .endPage()
      .endPDF();
    writeOutput(end, "encryption-new-edit-password", bytes);
    assertEncrypted(end, bytes, undefined, AES_128, 3900);
  });

  it("encrypts a new PDF with encrypt()", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text("encrypt() also works for a new PDF", 150, 300, { font: "arial" })
      .endPage()
      .encrypt({ userPassword: "123", ownerPassword: "456" })
      .endPDF();
    writeOutput(end, "encryption-new-encrypt", bytes);
    assert.equal(opens(end, bytes), false);
    assertEncrypted(end, bytes, "123", AES_128);
    assert.equal(opens(end, bytes, "456"), true);
  });

  // GH-446: a byte source used to skip encrypt() and only log a message.
  it("encrypts an edited source with a view password", function () {
    var recipe = end
      .openRecipe("recipe/test2.pdf")
      .editPage(1)
      .text("Encrypted from a byte source", 150, 300, { font: "arial" })
      .endPage()
      .encrypt({ userPassword: "123" });
    var encrypted = recipe.endPDF();
    writeOutput(end, "encryption-source-view-password", encrypted);
    assert.equal(opens(end, encrypted), false);
    assertEncrypted(end, encrypted, "123", RC4_40);
    // A repeated endPDF() hands out the same encrypted bytes.
    assert.strictEqual(recipe.endPDF(), encrypted);
  });

  it("encrypts a source with an edit or permission password", function () {
    [
      { ownerPassword: "123" },
      { password: "123" },
      { ownerPassword: "123", userProtectionFlag: PRINT },
    ].forEach((options, index) => {
      var bytes = end.openRecipe("recipe/test2.pdf").encrypt(options).endPDF();
      writeOutput(end, `encryption-source-edit-password-${index}`, bytes);
      assertEncrypted(end, bytes, undefined, RC4_40);
      assert.equal(opens(end, bytes, "123"), true);
    });
  });

  it("returns the recipe from encrypt() and takes the password alias", function () {
    var recipe = end.newRecipe().createPage(100, 100).endPage();
    assert.strictEqual(recipe.encrypt({ password: "edit" }), recipe);
    var bytes = recipe.endPDF();
    writeOutput(end, "encryption-password-alias", bytes);
    assertEncrypted(end, bytes, undefined, AES_128);
    assert.equal(opens(end, bytes, "edit"), true);
  });

  it("leaves a source unencrypted for an empty encrypt()", function () {
    var bytes = end.openRecipe("recipe/test2.pdf").encrypt({}).endPDF();
    assert.deepEqual(encryption(end, bytes), { encrypted: false, pages: 2 });
  });

  it("rejects encrypt() options that are not an object on Wasm only", function () {
    var recipe = end.newRecipe().createPage(100, 100).endPage();
    if (end.name === "wasm") {
      ["u", []].forEach((options) =>
        assert.throws(() => recipe.encrypt(options), {
          name: "TypeError",
          message: "encrypt options must be an object",
        }),
      );
      return;
    }
    // Native ignores them, as it always has, and writes the PDF unencrypted.
    assert.strictEqual(recipe.encrypt("u"), recipe);
    assert.equal(encryption(end, recipe.endPDF()).encrypted, false);
  });

  it("replaces the constructor password with the encrypt() one", function () {
    var bytes = end
      .newRecipe({ userPassword: "first" })
      .createPage("letter")
      .text("encrypt() replaces the constructor password", 150, 300, {
        font: "arial",
      })
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF();
    writeOutput(end, "encryption-constructor-then-encrypt", bytes);
    assert.equal(opens(end, bytes), false);
    assert.equal(opens(end, bytes, "first"), false);
    assertEncrypted(end, bytes, "second", AES_128);
    // an empty encrypt() keeps the constructor password
    var kept = end
      .newRecipe({ userPassword: "first" })
      .createPage(100, 100)
      .endPage()
      .encrypt({})
      .endPDF();
    assert.equal(opens(end, kept), false);
    assertEncrypted(end, kept, "first", AES_128);
  });

  // GH-975: a userProtectionFlag alone encrypts a new PDF with an empty user
  // password, which endPDF() used to open with the encrypt() password.
  it("re-encrypts a PDF a constructor userProtectionFlag encrypted", function () {
    var bytes = end
      .newRecipe({ userProtectionFlag: 4 })
      .createPage("letter")
      .endPage()
      .encrypt({ userPassword: "second" })
      .endPDF();
    writeOutput(end, "encryption-constructor-flag-then-encrypt", bytes);
    assert.equal(opens(end, bytes), false);
    assertEncrypted(end, bytes, "second", AES_128);
  });

  it("encrypts a PDF 2.0 document with AES-256", function () {
    var created = end
      .newRecipe({ version: 2.0, userPassword: "view", ownerPassword: "edit" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    writeOutput(end, "encryption-pdf20-aes256", created);
    var encrypted = end
      .newRecipe({ version: 2.0 })
      .createPage(100, 100)
      .endPage()
      .encrypt({ userPassword: "view", ownerPassword: "edit" })
      .endPDF();
    writeOutput(end, "encryption-pdf20-aes256-encrypt", encrypted);
    [created, encrypted].forEach((bytes) => {
      assert.equal(opens(end, bytes), false);
      assertEncrypted(end, bytes, "view", AES_256);
      assert.equal(opens(end, bytes, "edit"), true);
      assert.equal(
        withReader(end, bytes, (reader) => reader.getPDFLevel(), {
          password: "view",
        }),
        2,
      );
    });
  });

  it("opens an edited source with the constructor passwords without encrypting it", function () {
    // as on develop: constructor passwords encrypt a new PDF; a source they
    // only open
    [
      { userPassword: "view" },
      { password: "x" },
      { ownerPassword: "o", userProtectionFlag: PRINT | 16 },
    ].forEach((options, index) => {
      var bytes = end
        .openRecipe("recipe/test2.pdf", options)
        .editPage(1)
        .text("Edited", 10, 10, { font: "arial" })
        .endPage()
        .endPDF();
      writeOutput(
        end,
        `encryption-source-constructor-password-${index}`,
        bytes,
      );
      assert.deepEqual(encryption(end, bytes), { encrypted: false, pages: 2 });
    });
  });

  it("keeps the Info entries when encrypt() encrypts the output", function () {
    [
      end.newRecipe({ title: "T" }).createPage(100, 100).endPage(),
      end.openRecipe("TrappedTrue.pdf").info({ author: "A" }),
    ].forEach((recipe, index) => {
      var bytes = recipe.encrypt({ userPassword: "123" }).endPDF();
      writeOutput(end, `encryption-keeps-info-${index}`, bytes);
      var entries = infoWith(end, bytes, "123");
      assert.ok(entries, "the encrypted PDF has an Info dictionary");
      assert.equal(entries.Title, index === 0 ? "T" : "Trapped True");
      assert.match(entries.Producer, /^MuhammaraJS/);
      if (index === 1) assert.equal(entries.Author, "A");
    });
  });
});
