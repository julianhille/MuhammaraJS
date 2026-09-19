import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

function readAnnotations(reader) {
  var page = reader.parsePage(0).getDictionary();
  return reader
    .queryDictionaryObject(page, "Annots")
    .toPDFArray()
    .toJSArray()
    .map(function (reference) {
      var id = reference.toPDFIndirectObjectReference().getObjectID();
      return {
        id: id,
        dictionary: reader.parseNewObject(id).toPDFDictionary().toJSObject(),
      };
    });
}

describe("Recipe annotation parity", function () {
  var Recipe;
  var muhammara;
  var reader;

  before(async function () {
    Recipe = await createRecipe();
    muhammara = await createMuhammaraWasm();
  });

  afterEach(function () {
    if (reader) reader.end();
    reader = undefined;
  });

  function finish(recipe) {
    reader = muhammara.createReader(recipe.endPage().endPDF());
    return readAnnotations(reader);
  }

  it("writes non-ASCII annotation text on new pages", function () {
    var recipe = new Recipe().createPage(595, 842);
    recipe.comment("Größe ✓", 50, 50, { title: "Jürgen", subject: "Prüfung" });
    var annotations = finish(recipe);
    assert.equal(annotations[0].dictionary.Contents.toText(), "Größe ✓");
    assert.equal(annotations[0].dictionary.T.toText(), "Jürgen");
    assert.equal(annotations[0].dictionary.Subj.toText(), "Prüfung");
  });

  ["new", "edited"].forEach(function (mode) {
    // Edited pages write annotations through the low-level modifier API,
    // which has no Subj support at all yet; only title is checked there.
    it(`preserves falsy annotation titles on ${mode} pages`, function () {
      var source = new Recipe().createPage(595, 842).endPage().endPDF();
      var recipe =
        mode === "new"
          ? new Recipe().createPage(595, 842)
          : new Recipe(source).editPage(1);
      recipe.comment("x", 50, 100, { title: 0, subject: false });
      recipe.comment("y", 50, 150, { title: null });
      var annotations = finish(recipe);
      assert.equal(annotations[0].dictionary.T.toText(), "0");
      if (mode === "new")
        assert.equal(annotations[0].dictionary.Subj.toText(), "false");
      assert.equal(annotations[1].dictionary.T, undefined);
    });
  });

  it("writes fractional and zero opacity while keeping the opaque default", function () {
    var recipe = new Recipe().createPage(595, 842);
    var opacities = [0.45, 0, 1, undefined];
    opacities.forEach(function (opacity, index) {
      recipe.annot(100, 200 + index * 30, "Highlight", {
        width: 200,
        height: 14,
        color: "#ffff00",
        opacity: opacity,
      });
    });
    var annotations = finish(recipe);
    assert.equal(annotations.length, opacities.length);
    annotations.forEach(function (annotation, index) {
      var dictionary = annotation.dictionary;
      assert.equal(dictionary.Subtype.toString(), "Highlight");
      assert.equal(
        dictionary.CA ? dictionary.CA.toNumber() : 1,
        opacities[index] ?? 1,
      );
      assert.deepEqual(
        dictionary.C.toPDFArray()
          .toJSArray()
          .map(function (value) {
            return value.toNumber();
          }),
        [1, 1, 0],
      );
    });
  });

  it("links every comment and annot reply to its own parent dictionary", function () {
    var recipe = new Recipe().createPage(595, 842);
    var options = {
      title: "Review",
      replies: [
        { text: "Confirmed.", title: "Reviewer" },
        { text: "Ready to publish.", title: "Editor" },
      ],
    };
    recipe.comment("Please review.", 300, 100, options);
    recipe.annot(300, 200, "Text", { ...options, text: "Please review." });
    recipe.comment("No replies.", 300, 300);
    recipe.comment("Empty replies.", 300, 400, { replies: [] });
    var annotations = finish(recipe);
    assert.equal(annotations.length, 8);
    [0, 3].forEach(function (index) {
      var parent = annotations[index];
      assert.equal(parent.dictionary.Contents.toText(), "Please review.");
      assert.equal(parent.dictionary.T.toText(), "Review");
      assert.equal(parent.dictionary.IRT, undefined);
      options.replies.forEach(function (reply, replyIndex) {
        var dictionary = annotations[index + replyIndex + 1].dictionary;
        assert.equal(dictionary.Subtype.toString(), "Text");
        assert.equal(dictionary.Contents.toText(), reply.text);
        assert.equal(dictionary.T.toText(), reply.title);
        assert.equal(
          dictionary.IRT.toPDFIndirectObjectReference().getObjectID(),
          parent.id,
        );
        assert.equal(dictionary.RT.toString(), "R");
      });
    });
    assert.equal(annotations[0].dictionary.Name.toString(), "Comment");
    assert.equal(annotations[6].dictionary.Contents.toText(), "No replies.");
    assert.equal(annotations[7].dictionary.Contents.toText(), "Empty replies.");
  });
});
