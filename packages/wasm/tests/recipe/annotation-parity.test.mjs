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

  ["new", "edited"].forEach(function (mode) {
    [false, true].forEach(function (html) {
      it(`clips ${html ? "HTML" : "plain"} text links to the box on ${mode} pages`, function () {
        var source = new Recipe().createPage(300, 300).endPage().endPDF();
        var recipe =
          mode === "new"
            ? new Recipe().createPage(300, 300)
            : new Recipe(source).editPage(1);
        ["left", "center", "right"].forEach(function (alignment, index) {
          recipe.text(
            "OverlongClickableWordWithoutSpaces".repeat(3),
            50,
            40 + index * 70,
            {
              size: 14,
              html,
              opacity: index === 1 ? 0.5 : 1,
              link: `https://example.test/${index}`,
              textBox: {
                width: 100,
                height: 24,
                lineHeight: 24,
                wrap: "clip",
                textAlign: `${alignment} top`,
              },
            },
          );
        });
        var annotations = finish(recipe);
        assert.deepEqual(
          annotations.map(function (annotation) {
            return annotation.dictionary.Subtype.toString();
          }),
          ["Link", "Link", "Link"],
        );
        annotations.forEach(function (annotation, index) {
          var top = 300 - (40 + index * 70);
          var rect = annotation.dictionary.Rect.toPDFArray()
            .toJSArray()
            .map(function (value) {
              return value.toNumber();
            });
          assert.ok(
            rect[0] >= 49.99 && rect[2] <= 150.01 && rect[2] > rect[0],
            `horizontal bounds: ${rect}`,
          );
          assert.ok(
            rect[1] >= top - 24.01 && rect[3] <= top + 0.01,
            `vertical bounds: ${rect}`,
          );
        });
      });
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
