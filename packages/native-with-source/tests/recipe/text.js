const fs = require("fs");
const path = require("path");
const Recipe = require("@muhammara/native-with-source").Recipe;
const htmlCodes = fs.readFileSync(
  path.join(__dirname, "../TestMaterials/recipe/text.html"),
  "utf8",
);

// Each text-box and HTML test lays out a full page and takes about 1 s; on
// slow runners, such as Electron on Intel macOS, that exceeds the default.
const TEXT_BOX_TIMEOUT = 60000;

describe("Text", () => {
  it("Add watermark", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(__dirname, "../output/Add text - watermark.pdf");
    const recipe = new Recipe(src, output);

    const pages = recipe.metadata.pages;
    for (let i = 1; i <= pages; i++) {
      recipe
        .editPage(i)
        .text("WATERMARK", "center", "center", {
          bold: true,
          size: 60,
          color: "#0000FF",
          align: "center center",
          opacity: 0.3,
        })
        .endPage();
    }
    recipe.endPDF(done);
  });
  it("Add text", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(__dirname, "../output/Add text.pdf");
    const recipe = new Recipe(src, output);
    recipe
      .editPage(1)
      .circle("center", 100, 5, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Add text", "center", 100, {
        bold: true,
      })
      .text("Add text", "center", 120, {
        italic: true,
      })
      .text("Add text", "center", 160, {
        bold: true,
        italic: true,
        size: 20,
        color: "#ff0000",
      })
      .text("Add text", "center", 250, {
        font: "Arial",
        size: 20,
        color: "#ff0000",
      })
      .text("Add text", "center", 250, {
        font: "Arial",
        size: 20,
        color: "#ff0000",
      })
      .text("Add text", "center", 270, {
        font: "Courier New",
        size: 20,
        color: "#ff0000",
      })
      .text("Add text", "center", 290, {
        font: "Georgia",
        size: 20,
        color: "#ff0000",
      })
      .text(
        "Add text\nsecond line\nnext line\n\n\n\nlast line",
        "center",
        310,
        {
          font: "Roboto",
          size: 20,
          color: "#ff0000",
        },
      )
      .endPage()
      .endPDF(done);
  });

  it("Add text with html codes", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with html codes.pdf",
    );
    const recipe = new Recipe(src, output);
    recipe
      .createPage("letter")
      .text(htmlCodes, 0, 0, {
        html: true,
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with html codes inside textbox", (done) => {
    const output = path.join(
      __dirname,
      "../output/Add text with html codes inside textbox.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe
      .createPage(600, 1200)
      .text(htmlCodes, 10, 10, {
        html: true,
        textBox: {
          width: 450,
          padding: [15, 20],
          lineHeight: 10,
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        font: "Helvetica",
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
        font: "Roboto",
        color: "#000000",
        align: "right",
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with bolded text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with bolded format inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. This <b>word</b> should be bolded. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. <b>This entire sentence should be bolded.</b> <b>It was popularised in the 1960s with the release </b>of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. <b>The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English.</b> Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        html: true,
        // flow: true,
        font: "Helvetica",
        size: 14,
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        html: true,
        // flow: true,
        font: "Roboto",
        color: "#000000",
        align: "right",
        size: 12,
        opacity: 0.8,
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with italic text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with italic format inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. This <i>word</i> should have the italic format. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. <i>This entire sentence should be italicized.</i> <i>It was popularised in the 1960s with the release </i>of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. <i>The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English.</i> Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        html: true,
        // flow: true,
        font: "Helvetica",
        size: 14,
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        html: true,
        // flow: true,
        font: "Roboto",
        color: "#000000",
        align: "right",
        size: 12,
        opacity: 0.8,
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with underline inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with underline inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. This <u>word</u> should be underlined. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. <u>This entire sentence should be underlined.</u> It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        html: true,
        // flow: true,
        font: "Helvetica",
        size: 14,
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        html: true,
        // flow: true,
        font: "Roboto",
        color: "#000000",
        align: "right",
        size: 12,
        opacity: 0.8,
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with strikethrough effect inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with strikethrough effect inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. This <del>word</del> should have the strikethrough effect. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. <del>This entire sentence should have the strikethrough format.</del> The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        html: true,
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        font: "Helvetica",
        size: 14,
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        html: true,
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
        font: "Roboto",
        size: 12,
        color: "#000000",
        align: "right",
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("Add text with highlight inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with highlight inside textbox.pdf",
    );
    const recipe = new Recipe(src, output);
    const textContent =
      `${Date.now()} Lorem Ipsum is simply dummy text of the printing and typesetting industry. This <mark>word</mark> should have the highlight format. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. ` +
      `${Date.now()} It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. <mark>This entire sentence should have the highlight format.</mark> The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).`;

    recipe
      .createPage("letter")
      .circle("center", 400, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, "center", 400, {
        html: true,
        textBox: {
          width: 500,
          lineHeight: 16,
          minHeight: 300,
          textAlign: "center",
          padding: [15, 30, 30],
          style: {
            lineWidth: 5,
            fill: "#813b00",
            stroke: "#ff0000",
            opacity: 0.3,
          },
        },
        font: "Helvetica",
        size: 14,
        color: "#813b00",
        align: "center bottom",
      })
      .circle(500, 550, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text(textContent, 500, 550, {
        html: true,
        textBox: {
          width: 400,
          lineHeight: 30,
          minHeight: 300,
          padding: 15,
          textAlign: "right",
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
        font: "Roboto",
        size: 12,
        color: "#000000",
        align: "right",
      })
      .circle(350, 450, 10, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Fix height 200", 350, 450, {
        textBox: {
          width: 200,
          lineHeight: 16,
          height: 200,
          padding: [5, 15],
          textAlign: "left",
          style: {
            lineWidth: 1,
            stroke: "#00ff00",
            fill: "#ff0000",
            dash: [20, 20],
            opacity: 0.1,
          },
        },
        font: "Roboto",
        size: 30,
        color: "#000000",
      })
      .endPage()
      .endPDF(done);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("keeps hilited text on edited pages", () => {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const source = path.join(__dirname, "../output/hilite-edit-source.pdf");
    const output = path.join(__dirname, "../output/hilite-edit.pdf");
    new Recipe("new", source).createPage(200, 200).endPage().endPDF();
    // The hilite rectangle pauses the edited page, which resumes into a new
    // content context; the text must be written to that one.
    new Recipe(source, output)
      .editPage(1)
      .text("Hilited", 10, 10, { hilite: true })
      .endPage()
      .endPDF();
    const reader = muhammara.createReader(output);
    let textObjects = 0;
    for (let id = 1; id < reader.getXrefSize(); id++) {
      const object = reader.parseNewObject(id);
      if (!object || object.getType() !== muhammara.ePDFObjectStream) continue;
      const dictionary = object.toPDFStream().getDictionary();
      if (
        !dictionary.exists("Subtype") ||
        dictionary.queryObject("Subtype").value !== "Form"
      ) {
        continue;
      }
      const input = reader.startReadingFromStream(object.toPDFStream());
      const bytes = [];
      while (input.notEnded()) bytes.push(...input.read(4096));
      textObjects += (
        Buffer.from(bytes)
          .toString("latin1")
          .match(/\bBT\b/g) || []
      ).length;
    }
    assert.equal(textObjects, 1);
  });

  it("starts text without coordinates at the margins of a new page", () => {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-new-page-origin.pdf");
    const recipe = new Recipe("new", output)
      .createPage(400, 400)
      .text("first", 20, 20, { flow: true, size: 30 })
      .endPage()
      .createPage(400, 400);
    // Before any text, movedown() starts from the page origin, as in Wasm.
    assert.deepEqual(recipe.movedown(0, true), [0, 0]);
    recipe
      .text("second", { flow: true })
      .text("", { flow: false })
      .endPage()
      .endPDF();
    const reader = muhammara.createReader(output);
    const [second] = reader.extractPageText(1);
    assert.equal(second.content, "second");
    assert.equal(Math.round(second.textMatrix[4]), 72);
    // Flow options from the previous page do not carry over.
    assert.equal(second.fontSize, 14);
  });

  it("starts text without coordinates at the margins of an edited page", () => {
    const assert = require("node:assert/strict");
    const source = path.join(
      __dirname,
      "../output/text-edit-origin-source.pdf",
    );
    const output = path.join(__dirname, "../output/text-edit-origin.pdf");
    new Recipe("new", source)
      .createPage(400, 400)
      .endPage()
      .createPage(400, 400)
      .endPage()
      .endPDF();
    const recipe = new Recipe(source, output)
      .editPage(1)
      .text("first", 20, 20)
      .endPage()
      .editPage(2);
    assert.deepEqual(recipe.movedown(0, true), [72, 72]);
    recipe.text("second", { flow: false });
    assert.equal(recipe.movedown(0, true)[0], 72);
    recipe.endPage().endPDF();
  });

  it("lays out a long line without a text box in linear time", function () {
    // Measuring the whole line for every word took about 25 s for 3 000
    // characters; the mocha timeout catches a regression.
    this.timeout(10000);
    const output = path.join(__dirname, "../output/text-long-line.pdf");
    new Recipe("new", output)
      .createPage("A4")
      .text("word ".repeat(600), 10, 10, { size: 8 })
      .endPage()
      .endPDF();
    require("node:assert/strict").ok(fs.statSync(output).size > 0);
  });

  it("ends ellipsized text with the ellipsis glyph", () => {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-ellipsis.pdf");
    new Recipe("new", output, { compress: false })
      .createPage(220, 120)
      .text("alpha bravo charlie", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 70, wrap: "ellipsis" },
      })
      .endPage()
      .endPDF();

    const reader = muhammara.createReader(output);
    const stream = reader.startReadingFromStream(
      reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
        .toPDFStream(),
    );
    const chunks = [];
    while (stream.notEnded()) chunks.push(Buffer.from(stream.read(4096)));
    const content = Buffer.concat(chunks).toString("latin1");
    // U+2026 is WinAnsi byte 0x85, written as the octal escape \205.
    assert.match(content, /\(alpha brav\\205\) Tj/);
    assert.doesNotMatch(content, /\.\.\.\) Tj/);
  });

  it("keeps the space before the word that clip or ellipsis cuts", () => {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const content = (wrap) => {
      const output = path.join(__dirname, `../output/text-${wrap}-space.pdf`);
      new Recipe("new", output, { compress: false })
        .createPage(220, 120)
        .text("one two three\nfour five six seven", 10, 10, {
          font: "arial",
          size: 12,
          textBox: { width: 60, wrap },
        })
        .endPage()
        .endPDF();
      const reader = muhammara.createReader(output);
      const stream = reader.startReadingFromStream(
        reader
          .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
          .toPDFStream(),
      );
      const chunks = [];
      while (stream.notEnded()) chunks.push(Buffer.from(stream.read(4096)));
      return Buffer.concat(chunks).toString("latin1");
    };

    const clipped = content("clip");
    assert.match(clipped, /\(one two three\) Tj/);
    assert.match(clipped, /\(four five six \) Tj/);
    assert.match(content("ellipsis"), /\(one two t\\205\) Tj/);
  });

  it("rejects a miterLimit below 1 before drawing", () => {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-miter-limit.pdf");
    const error = {
      name: "RangeError",
      message: "miterLimit must be a number of at least 1",
    };
    const recipe = new Recipe("new", output).createPage(200, 200);
    assert.throws(
      () => recipe.text("alpha", 20, 20, { font: "arial", miterLimit: 0 }),
      error,
    );
    recipe.text("bravo", 20, 20, { flow: true });
    assert.throws(() => recipe.text("charlie", { miterLimit: 0.5 }), error);
    assert.throws(() => recipe.text("delta", 20, 60, { miterLimit: 0 }), error);
    recipe.text("", { flow: false }).text("echo", 20, 100, { miterLimit: 1 });
    recipe.endPage().endPDF();
    const reader = muhammara.createReader(output);
    assert.deepEqual(
      reader.extractPageText(0).map((run) => run.content),
      ["bravo", "echo"],
    );
  });

  it("ends right-aligned text at the padded right edge", function (done) {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const arial = path.join(__dirname, "../TestMaterials/fonts/arial.ttf");
    const output = path.join(__dirname, "../output/text-right-padding.pdf");
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", arial);
    recipe
      .createPage(400, 400)
      .text("hello world", 20, 20, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "right", padding: [0, 10, 0, 30] },
      })
      .text("hello world", 20, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "center" },
      })
      .endPage()
      .endPDF(() => {
        const reader = muhammara.createReader(output);
        const [rightRun, centerRun] = reader.extractPageText(0);
        reader.end();
        const font = muhammara
          .createWriter(new muhammara.PDFWStreamForBuffer())
          .getFontForFile(arial);
        const glyphsEnd = font.calculateTextDimensions("hello world", 12).xMax;
        const right = rightRun.textMatrix[4] + glyphsEnd;
        assert.ok(Math.abs(right - 210) < 0.5, String(right));
        // Centered between the text's start and where its glyphs end.
        const center = centerRun.textMatrix[4] + glyphsEnd / 2;
        assert.ok(Math.abs(center - 120) < 0.5, String(center));
        done();
      });
  });

  it("starts a new line at every mandatory line break", function (done) {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-line-breaks.pdf");
    const recipe = new Recipe("new", output);
    recipe
      .createPage(400, 400)
      .text(
        "one\ntwo\r\nthree\rfour\u2028five\u2029six\u000bseven\feight\u0085nine",
        20,
        20,
        {
          textBox: { width: 300 },
        },
      )
      .endPage()
      .endPDF(() => {
        const reader = muhammara.createReader(output);
        const lines = reader.extractPageText(0).map((element) => element.text);
        reader.end();
        assert.deepEqual(lines, [
          "one",
          "two",
          "three",
          "four",
          "five",
          "six",
          "seven",
          "eight",
          "nine",
        ]);
        done();
      });
  });

  it("keeps non-breaking spaces inside justified words", async function () {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-justify-nbsp.pdf");
    const recipe = new Recipe("new", output);
    recipe
      .createPage(400, 400)
      .text("aa bb\u00a0cc dd ee ff gg hh ii jj kk ll mm nn", 20, 20, {
        font: "Arial",
        size: 12,
        textBox: { width: 100, textAlign: "justify" },
      });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const reader = muhammara.createReader(output);
    const runs = reader.extractPageText(0).map((element) => element.text);
    reader.end();
    assert.ok(
      runs.some((text) => text.trim() === "bb\u00a0cc"),
      JSON.stringify(runs),
    );
  });

  it("ends the text markup of a right-aligned HTML line at the box edge", async function () {
    const assert = require("node:assert/strict");
    const muhammara = require("@muhammara/native-with-source");
    const output = path.join(__dirname, "../output/text-html-markup-edge.pdf");
    const recipe = new Recipe("new", output);
    recipe.createPage(400, 400).text("<p>WqWq Hello WqWq</p>", 20, 20, {
      font: "Arial",
      size: 14,
      html: true,
      underline: true,
      textBox: { width: 300, textAlign: "right" },
    });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const reader = muhammara.createReader(output);
    const rects = reader
      .parsePage(0)
      .getDictionary()
      .toJSObject()
      .Annots.toJSArray()
      .map((reference) =>
        reader
          .parseNewObject(reference.getObjectID())
          .toJSObject()
          .Rect.toJSArray()
          .map((value) => value.value),
      );
    reader.end();
    assert.equal(rects.length, 1);
    assert.ok(Math.abs(rects[0][2] - 320) < 0.05, JSON.stringify(rects));
  });
});
