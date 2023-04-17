const fs = require("fs");
const path = require("path");
const HummusRecipe = require("../../lib").Recipe;
const htmlCodes = fs.readFileSync(
  path.join(__dirname, "../TestMaterials/recipe/text.html"),
  "utf8",
);

describe("Text", () => {
  it("Add watermark", (done) => {
    const src = path.join(__dirname, "../TestMaterials/recipe/test.pdf");
    const output = path.join(__dirname, "../output/Add text - watermark.pdf");
    const recipe = new HummusRecipe(src, output);

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
    const recipe = new HummusRecipe(src, output);
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
    const recipe = new HummusRecipe(src, output);
    recipe
      .createPage("letter")
      .text(htmlCodes, 0, 0, {
        html: true,
      })
      .endPage()
      .endPDF(done);
  });

  it("Add text with html codes inside textbox", (done) => {
    const output = path.join(
      __dirname,
      "../output/Add text with html codes inside textbox.pdf",
    );
    const recipe = new HummusRecipe("new", output);
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
  });

  it("Add text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text inside textbox.pdf",
    );
    const recipe = new HummusRecipe(src, output);
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
  });

  it("Add text with bolded text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with bolded format inside textbox.pdf"
    );
    const recipe = new HummusRecipe(src, output);
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
  });

  it("Add text with italic text inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with italic format inside textbox.pdf"
    );
    const recipe = new HummusRecipe(src, output);
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
  });

  it("Add text with underline inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with underline inside textbox.pdf"
    );
    const recipe = new HummusRecipe(src, output);
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
  });

  it("Add text with strikethrough effect inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with strikethrough effect inside textbox.pdf"
    );
    const recipe = new HummusRecipe(src, output);
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
  });

  it("Add text with highlight inside textbox", (done) => {
    const src = "new"; //path.join(__dirname, '../TestMaterials/recipe/test.pdf');
    const output = path.join(
      __dirname,
      "../output/Add text with highlight inside textbox.pdf"
    );
    const recipe = new HummusRecipe(src, output);
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
  });
});
