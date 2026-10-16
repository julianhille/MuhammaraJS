import assert from "node:assert/strict";
import { describeEnds, ends } from "../support/ends.mjs";

// Every member of the shared Recipe prototype, which both ends inherit. A
// name here that one end lacks, or a member one end adds to it, is an API
// difference; a recipe module export that leaks onto the prototype shows up
// as an unexpected name.
var SHARED_PROTOTYPE = [
  "_annot",
  "_attachNonMarkupAnnot",
  "_calibrateCoordinate",
  "_calibrateCoordinateForAnnots",
  "_centrify",
  "_compression",
  "_colorNumberToRGB",
  "_createExtGStates",
  "_createWriter",
  "_deletePages",
  "_devicePathOptions",
  "_drawObject",
  "_endPDFResult",
  "_encrypt",
  "_endDictionary",
  "_flushTextFlow",
  "_getDistance",
  "_getEncryptOptions",
  "_getFont",
  "_getImgOffset",
  "_getPathOptions",
  "_getReader",
  "_getTextBoxOffset",
  "_getTextMarkupAnnotationSubtype",
  "_getTransformParams",
  "_getVersion",
  "_insertPages",
  "_layoutText",
  "_lineCap",
  "_lineJoin",
  "_loadFonts",
  "_openOptions",
  "_makeTextBox",
  "_makeTextObject",
  "_merge",
  "_readInfo",
  "_registerFont",
  "_releaseReader",
  "_resumePageRotation",
  "_reverseCoordinate",
  "_rotatePoints",
  "_setLineStyle",
  "_setParameters",
  "_setRotationContext",
  "_setScalingTransform",
  "_setSeparationColor",
  "_setSkewContext",
  "_startDictionary",
  "_strokePolyline",
  "_transformColor",
  "_validateAnnot",
  "_writeAnnotation",
  "_writeAnnotations",
  "_writeInfo",
  "annot",
  "appendPage",
  "arc",
  "arrow",
  "attach",
  "chroma",
  "circle",
  "comment",
  "constructor",
  "createPage",
  "custom",
  "deletePage",
  "editPage",
  "ellipse",
  "encrypt",
  "endPDF",
  "endPage",
  "fill",
  "fillAndStroke",
  "getCurrentPageInfo",
  "getPageInfo",
  "htmlToTextObjects",
  "image",
  "info",
  "insertPage",
  "knownColors",
  "layout",
  "line",
  "lineStyle",
  "lineTo",
  "lineWidth",
  "link",
  "margins",
  "mediumSizes",
  "moveTo",
  "movedown",
  "n_gon",
  "opacity",
  "overlay",
  "pageInfo",
  "pauseContext",
  "permission",
  "pie",
  "polygon",
  "position",
  "read",
  "rectangle",
  "register",
  "registerFont",
  "removeText",
  "replaceText",
  "resumeContext",
  "rotate",
  "rotateContent",
  "setPageBox",
  "split",
  "star",
  "stroke",
  "structure",
  "table",
  "text",
  "textDimensions",
  "triangle",
  "xmp",
];

// The named values for string options, static on both ends.
var SHARED_CONSTANTS = [
  "AFRelationship",
  "AnnotFlag",
  "AnnotIcon",
  "AnnotSubtype",
  "ArrowAt",
  "ArrowType",
  "ChromaCommand",
  "Colorspace",
  "Coordinate",
  "FontStyle",
  "HorizontalAlign",
  "LineCap",
  "LineJoin",
  "PageLayout",
  "PageSize",
  "PdfA",
  "Permission",
  "TableRowNth",
  "TextAlign",
  "TextDirection",
  "TextWrap",
  "TrianglePosition",
  "TriangleTrait",
  "VerticalAlign",
];

/**
 * The prototype every end's Recipe class inherits from.
 * @param {object} end - The end.
 * @returns {object} The shared Recipe prototype.
 */
function sharedPrototype(end) {
  return Object.getPrototypeOf(end.Recipe.prototype);
}

/**
 * The kind of a prototype member without reading it, as getters such as
 * `position` need an instance: a getter, a method with its arity, or the
 * type of a plain value.
 * @param {object} prototype - The prototype.
 * @param {string} name - The member name.
 * @returns {object} The member's shape.
 */
function memberShape(prototype, name) {
  var descriptor = Object.getOwnPropertyDescriptor(prototype, name);
  if (descriptor.get || descriptor.set) {
    return { get: Boolean(descriptor.get), set: Boolean(descriptor.set) };
  }
  return typeof descriptor.value === "function"
    ? { function: descriptor.value.length }
    : { value: typeof descriptor.value };
}

describeEnds("Recipe prototype", function (end) {
  it("inherits exactly the shared Recipe API", function () {
    var shared = sharedPrototype(end);
    assert.deepEqual(
      Object.getOwnPropertyNames(shared).sort(),
      [...SHARED_PROTOTYPE].sort(),
    );
    assert.equal(Object.getPrototypeOf(shared), Object.prototype);
    assert.equal(end.Recipe.name, "Recipe");
  });

  it("binds the Recipe class to its own low-level API", function () {
    assert.equal(typeof end.Recipe.prototype.muhammara, "object");
    assert.equal(typeof end.Recipe.prototype.platform, "object");
    assert.equal(
      typeof end.Recipe.prototype.muhammara.createReader,
      "function",
    );
  });

  it("exposes the shared named option values as frozen statics", function () {
    SHARED_CONSTANTS.forEach((name) => {
      assert.ok(Object.isFrozen(end.Recipe[name]), name);
      assert.equal(end.Recipe[name], Object.getPrototypeOf(end.Recipe)[name]);
    });
  });
});

describe("Recipe prototype parity", function () {
  before(async function () {
    if (ends.length < 2) this.skip();
    await Promise.all(ends.map((end) => end.load()));
  });

  it("gives both ends the same named option values", function () {
    var [native, wasm] = ends;
    SHARED_CONSTANTS.forEach((name) =>
      assert.deepEqual(native.Recipe[name], wasm.Recipe[name], name),
    );
  });

  it("gives every shared member the same kind and arity on both ends", function () {
    var [native, wasm] = ends;
    SHARED_PROTOTYPE.forEach((name) =>
      assert.deepEqual(
        memberShape(sharedPrototype(native), name),
        memberShape(sharedPrototype(wasm), name),
        name,
      ),
    );
  });
});
