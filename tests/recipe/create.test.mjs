import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import {
  annotations,
  info,
  pageCount,
  textRuns,
  pageFields,
} from "../support/pdf.mjs";
import { imagePlacements, pageGeometry } from "../support/images.mjs";

describeEnds("Recipe create", function (end) {
  it("reports active page geometry", function () {
    var recipe = end.newRecipe();
    assert.equal(recipe.getCurrentPageInfo(), null);
    recipe.createPage("letter", 90);
    assert.deepEqual(
      pageFields(recipe.getCurrentPageInfo()),
      pageFields(recipe.pageInfo(1)),
    );
    recipe.endPage();
    assert.deepEqual(
      pageFields(recipe.getCurrentPageInfo()),
      pageFields(recipe.pageInfo(1)),
    );
    var bytes = recipe.endPDF();
    writeOutput(end, "create-page-geometry", bytes);

    var reopened = end.openRecipe(bytes);
    assert.deepEqual(
      pageFields(reopened.getCurrentPageInfo()),
      pageFields(reopened.pageInfo(1)),
    );
    assert.deepEqual(pageFields(reopened.pageInfo(1)), {
      width: 792,
      height: 612,
      rotate: 0,
      pageNumber: 1,
    });
    reopened.endPDF();
  });

  it("writes a blank PDF with its info, custom entries and version", function () {
    var bytes = end
      .newRecipe({
        version: 1.6,
        author: "someone",
        title: "No title",
        subject: "Blank PDF",
        keywords: ["hummus", "js", "??", "234"],
      })
      .custom("myValue", 123)
      .createPage()
      .endPage()
      .createPage()
      .endPage()
      .endPDF();
    writeOutput(end, "create-blank", bytes);
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString(), "%PDF-1.6");
    assert.equal(pageCount(end, bytes), 2);
    var entries = info(end, bytes);
    assert.equal(entries.Author, "someone");
    assert.equal(entries.Title, "No title");
    assert.equal(entries.Subject, "Blank PDF");
    assert.equal(entries.Keywords, "hummus, js, ??, 234");
    assert.equal(entries.myValue, "123");
  });

  it("draws shapes, an image, text and a comment on new pages", function () {
    var myCats = end.image("recipe/myCats.jpg");
    var bytes = end
      .newRecipe()
      // 1st Page
      .createPage("letter")
      .circle("center", 100, 30, { stroke: "#3b7721", fill: "#eee000" })
      .polygon(
        [
          [50, 250],
          [100, 200],
          [512, 200],
          [562, 250],
          [512, 300],
          [100, 300],
          [50, 250],
        ],
        {
          lineWidth: 5,
          stroke: [0, 0, 140],
          fill: [153, 143, 32],
          opacity: 0.2,
        },
      )
      .image(myCats, "center", 450, {
        width: 250,
        height: 250,
        opacity: 0.5,
        align: "center center",
      })
      .rectangle(240, 400, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .rectangle(322, 400, 50, 50, {
        stroke: [0, 0, 140],
        width: 6,
      })
      .rectangle(240, 476, 50, 50, {
        fill: [255, 0, 0],
      })
      .rectangle(322, 476, 50, 50, {
        stroke: "#3b7721",
        fill: "#eee000",
        opacity: 0.2,
      })
      .moveTo(200, 600)
      .lineTo("center", 650)
      .lineTo(412, 600)
      .text("Welcome to Muhammara-Recipe", "center", 250, {
        color: "066099",
        fontSize: 30,
        bold: true,
        font: "arial",
        align: "center center",
      })
      .text("some text box", 450, 400, {
        color: "066099",
        fontSize: 20,
        font: "arial",
        textBox: {
          width: 150,
          lineHeight: 16,
          padding: [5, 15],
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
      })
      .comment("Feel free to open issues to help us!", "center", 100, {
        flag: "locked",
      })
      .endPage()
      // 2nd page
      .createPage("A4", 90)
      .circle(150, 150, 300, { fill: "#bbbbbb" })
      .rectangle(240, 400, 50, 50, {
        color: [255, 0, 255],
        opacity: 0.2,
      })
      .endPage()
      .endPDF();
    writeOutput(end, "create-new", bytes);
    assert.equal(pageCount(end, bytes), 2);
    assert.deepEqual(
      imagePlacements(end, bytes).filter(
        (placement) => placement.kind === "image",
      ),
      [
        {
          kind: "image",
          corners: [
            [212.25, 217],
            [399.75, 217],
            [399.75, 467],
            [212.25, 467],
          ],
          opacity: 0.5,
        },
      ],
    );
    // The text box wraps its text at its width, inside its padding.
    assert.deepEqual(textRuns(end, bytes), [
      { text: "Welcome to Muhammara-Recipe", x: 87.48, y: 534.23 },
      { text: "some text", x: 465, y: 372.44 },
      { text: "box", x: 465, y: 353.68 },
    ]);
    var [comment] = annotations(end, bytes);
    assert.equal(comment.Subtype, "Text");
    assert.equal(comment.Contents, "Feel free to open issues to help us!");
    // The locked flag is bit 8.
    assert.equal(comment.F & 128, 128);
    assert.deepEqual(pageGeometry(end, bytes, 1).media, [0, 0, 841.89, 595.28]);
  });

  it("tracks current-page rotation for named and explicit sizes", function () {
    var named = end.newRecipe().createPage("letter").rotate(90);
    assert.equal(named.getCurrentPageInfo().rotate, 90);
    named.endPage();
    assert.deepEqual(pageFields(named.pageInfo(1)), {
      width: 612,
      height: 792,
      rotate: 90,
      pageNumber: 1,
    });
    var namedBytes = named.endPDF();
    writeOutput(end, "create-rotate-named", namedBytes);

    var explicit = end.newRecipe().createPage(100, 200).rotate(90).endPage();
    assert.deepEqual(pageFields(explicit.pageInfo(1)), {
      width: 100,
      height: 200,
      rotate: 90,
      pageNumber: 1,
    });
    var explicitBytes = explicit.endPDF();
    writeOutput(end, "create-rotate-explicit", explicitBytes);

    [namedBytes, explicitBytes].forEach((bytes) => {
      assert.equal(pageGeometry(end, bytes).rotate, 90);
      assert.equal(end.openRecipe(bytes).read(bytes)[1].rotate, 90);
    });
  });

  it("tracks named-page margins and starts implicit text at them", function () {
    var recipe = end.newRecipe().createPage("letter", 90, {
      left: 40,
      right: 20,
      top: 50,
      bottom: 30,
    });
    assert.equal(recipe.pageInfo(1).width, 792);
    assert.equal(recipe.pageInfo(1).height, 612);
    assert.deepEqual(recipe.margins(), {
      left: 40,
      right: 20,
      top: 50,
      bottom: 30,
    });
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.text("margin layout", { font: "arial" });
    // Implicit text starts at the margins and moves the text cursor only;
    // the path position stays where moveTo and lineTo left it.
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    var [cursorX, cursorY] = recipe.movedown(0, true);
    assert.equal(cursorX, 40);
    assert.equal(cursorY, 50);
    var bytes = recipe.rotate(90).endPage().endPDF();
    writeOutput(end, "create-margin-layout", bytes);
    assert.equal(recipe.getCurrentPageInfo().rotate, 90);
    var [run] = textRuns(end, bytes);
    assert.equal(run.text, "margin layout");
    assert.equal(run.x, 40);
  });

  it("measures text and chains registered extensions", function () {
    var recipe = end.newRecipe();
    assert.ok(
      recipe.textDimensions("Browser Recipe", { font: "arial", fontSize: 24 })
        .width > 0,
    );
    assert.equal(
      recipe.register("createDrawSquare", function (x, y) {
        return this.rectangle(x, y, 2, 2, { fill: "#000000" });
      }),
      recipe,
    );
    assert.equal(
      recipe.register(function createDrawNamedSquare(x, y) {
        return this.rectangle(x, y, 4, 4, { fill: "#000000" });
      }),
      recipe,
    );
    assert.throws(
      () => recipe.register("createDrawNamedSquare", () => {}),
      /already exists/,
    );
    var bytes = recipe
      .createPage(100, 100)
      .createDrawSquare(50, 50)
      .createDrawNamedSquare(10, 10)
      .endPage()
      .endPDF();
    writeOutput(end, "create-extensions", bytes);
    // register() extends the class every Recipe of this end shares.
    delete Object.getPrototypeOf(recipe).createDrawSquare;
    delete Object.getPrototypeOf(recipe).createDrawNamedSquare;
    assert.deepEqual(
      imagePlacements(end, bytes).map((placement) => placement.corners[0]),
      [
        [50, 48],
        [10, 86],
      ],
    );
  });

  it("validates context transitions", function () {
    var recipe = end.newRecipe();
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.createPage(100, 100).rectangle(10, 10, 20, 20, { fill: "#000000" });
    assert.equal(recipe.pauseContext(), recipe);
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.equal(recipe.resumeContext(), recipe);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    recipe.rectangle(40, 40, 20, 20, { fill: "#000000" }).endPage();
    assert.throws(() => recipe.pauseContext(), /No active page/);
    assert.throws(() => recipe.resumeContext(), /No paused page/);
    var bytes = recipe.endPDF();
    writeOutput(end, "create-context-transitions", bytes);
    // Both rectangles survive the paused context.
    assert.deepEqual(
      imagePlacements(end, bytes).map((placement) => placement.corners[0]),
      [
        [10, 70],
        [40, 40],
      ],
    );
  });

  it("rejects rotate() on an edited page", function () {
    var recipe = end.openRecipe("Original.pdf").editPage(1);
    assert.throws(() => recipe.rotate(90), {
      name: "Error",
      message: "rotate() is only available on pages created with createPage()",
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "create-rotate-edited-page", bytes);
    assert.equal(pageGeometry(end, bytes).rotate, 0);
    assert.equal(end.openRecipe(bytes).pageInfo(1).rotate, 0);
  });

  it("validates rotate() and setPageBox() arguments", function () {
    var M = end.muhammara;
    var recipe = end.newRecipe();
    assert.throws(() => recipe.rotate(90), {
      name: "TypeError",
      message: "rotate requires an active page",
    });
    recipe.createPage("A4");
    assert.throws(() => recipe.rotate(45), {
      name: "RangeError",
      message: "Rotation must be a multiple of 90 degrees",
    });
    assert.throws(() => recipe.rotate(90n), {
      name: "TypeError",
      message: "Rotation is not set to a number",
    });
    assert.throws(
      () => recipe.setPageBox(M.ePDFPageBoxCropBox, 0, 0, 10n, 10),
      { name: "TypeError", message: "setPageBox coordinates must be numbers" },
    );
    var bytes = recipe
      .rotate(180)
      .setPageBox(M.PageBox.CROP, 10, 20, 300, 400)
      .endPage()
      .endPDF();
    writeOutput(end, "create-rotate-validation", bytes);
    var geometry = pageGeometry(end, bytes);
    assert.equal(geometry.rotate, 180);
    assert.deepEqual(geometry.crop, [10, 20, 300, 400]);
  });
});
