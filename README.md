# Welcome to MuhammaraJS

[![NPM version](http://img.shields.io/npm/v/muhammara.svg?style=flat)](https://www.npmjs.org/package/muhammara)
[![Build status](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml)

Welcome to MuhammaraJS.
A Fast NodeJS Module for creating, parsing and manipulating PDF files and streams.

Original Project (CPP base version)
Project site is [here](http://www.pdfhummus.com).

If you are looking for a C++ library go [here](https://github.com/galkahana/PDF-Writer).

## Hummus JS is the base

This is a drop in replacement for hummusJS originally made by Galkahana.
He did an awesome job, but discontinued hummusjs.

The documentation for MuhammaraJS / HummusJS is still located at the
hummusJS github wiki: available [here](https://github.com/galkahana/HummusJS/wiki)

## muhammara-recipe (formerly known as hummus-recipe) as been added

Muhammara-recipe and hummus-recipe has been integrated, dependencies updated
and is now shipped along with muhammara itself.

It serves as a drop in replacement.

# Caution

## Breaking changes

### Version 2.x

will be incompatible with some older node and
electron versions because we needed to upgrade node-pre-gyp.

### Version 3.x

- Node < 11 and Electron < 11 removed the prebuilts
- Renamed typo exported value from eTokenSeprator to eTokenSeparator

This won't affect a lot of you but still.

### Version 4.x

- Node < 15 and electron < 15 pre-builts have been removed
- Ubuntu 18.04 has been removed from github actions and so it is unable to build on 18.04.
  This means the glibc has been raised to 2.31 which might break pre-builts for you.
  It is still possible to build for older glibc version.

### Version 5.x

- ~You may need to update your base linux distro where you use this as muhammara now needs GLIBCXX_3.4.31
  Github removed ubuntu 18.04 runners and so we build on 20.04 now.~
  ~Ubuntu 20.04 comes with newer libstdc++6 and this brings newer glibc with it.~
  This has been tackled by building inside of docker using a gcc bookworm build.
  That means it lowers the needed glibc version to GLIBCXX_3.4.30 and so official node:20 docker should work again.
- Node <= 16 pre-builts have been removed
- Electron <= 23 pre-builts have been removed
- GCC 13 needed / std ++ 20 (only needed if you compile yourself)

# Installation

```
npm install muhammara

```

# Replace hummusJS with MuhammaraJS for hummus

Replace:

```
let hummus = require('hummus')
```

With:

```
let muhammara = require('muhammara')
```

# Replace hummus-recipe or muhammara-recipe with MuhammaraJS

Replace:

`const HummusRecipe = require('hummus-recipe');`

With:

```
const HummusRecipe = require('muhammara').Recipe;
```

# Documentation

## Muhammara

You can find samples and documentation [here](./docs/Home.md)

### Muhammara Recipe:

To generate the documentation you could clone this repo and execute:

`npm run recipe-jsdoc`

## Recipe

### Instructions

- [GetStarted](#getstarted)
- [Coordinate System](#coordinate-system)
- [Create a new PDF](#create-a-new-pdf)
- [Modify an existing PDF](#modify-an-existing-pdf)
- [PDF Pages/Info/Structure](#page-info)
- [Append PDF](#append-pdf)
- [Insert PDF](#insert-pdf)
- [Overlay PDF](#overlay-pdf)
- [Split PDF](#split-pdf)
- [Encryption](#encryption)

### GetStarted

```bash
const Recipe = require('muhammara').Recipe
```

### Coordinate System

In order to make things easier, I use `Left-Top` as center `[0,0]` instead of `Left-Bottom`.
You may write and edit the pdf like you write things on papers from the left top corner.
It is similar to the [Html Canvas](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)

```javascript
pdfDoc
    .text('start from here', 0, 0)
    .text('next line', 0, 20)
    .text('some other texts', 100, 100)
    ...
```

### Create a new PDF

```javascript
const Recipe = require("muhammara").Recipe;

const pdfDoc = new Recipe("new", "output.pdf", {
  version: 1.6,
  author: "John Doe",
  title: "Hummus Recipe",
  subject: "A brand new PDF",
});

pdfDoc.createPage("letter-size").endPage().endPDF();
```

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("new", "output.pdf");

pdfDoc
  // 1st Page
  .createPage("letter-size")
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
      color: [153, 143, 32],
      stroke: [0, 0, 140],
      fill: [153, 143, 32],
      lineWidth: 5,
    },
  )
  .rectangle(240, 400, 50, 50, {
    stroke: "#3b7721",
    fill: "#eee000",
    lineWidth: 6,
    opacity: 0.3,
  })
  .moveTo(200, 600)
  .lineTo("center", 650)
  .lineTo(412, 600)
  .text("Welcome to Hummus-Recipe", "center", 250, {
    color: "#066099",
    fontSize: 30,
    bold: true,
    font: "Helvatica",
    align: "center center",
    opacity: 0.8,
    rotation: 180,
  })
  .text("some text box", 450, 400, {
    color: "#066099",
    fontSize: 20,
    font: "Courier New",
    strikeOut: true,
    highlight: {
      color: [255, 0, 0],
    },
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
  .comment("Feel free to open issues to help us!", "center", 100)
  .endPage()
  // 2nd page
  .createPage("A4", 90)
  .circle(150, 150, 300)
  .endPage()
  // end and save
  .endPDF(() => {
    /* done! */
  });
```

#### Create a new PDF as a Buffer

```javascript
const Recipe = require("muhammara").Recipe;

const pdfDoc = new Recipe(Buffer.from("new"), null, {
  version: 1.6,
  author: "John Doe",
  title: "Hummus Recipe",
  subject: "A brand new PDF",
});

const pdfBuffer = pdfDoc.createPage("letter-size").endPage().endPDF();
```

### Modify an existing PDF

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  // edit 1st page
  .editPage(1)
  .text("Add some texts to an existing pdf file", 150, 300)
  .rectangle(20, 20, 40, 100)
  .comment("Add 1st comment annotation", 200, 300)
  .image("/path/to/image.jpg", 20, 100, { width: 300, keepAspectRatio: true })
  .endPage()
  // edit 2nd page
  .editPage(2)
  .comment("Add 2nd comment annotation", 200, 100)
  .endPage()
  // end and save
  .endPDF();
```

### Page Info

```javascript
const pdfDoc = new Recipe("input.pdf", "output.pdf");
console.log(pdfDoc.pageInfo(1));
```

#### Print the pdf structure

```javascript
const pdfDoc = new Recipe("input.pdf", "output.pdf");

recipe.structure("pdf-structure.txt").endPDF(done);
```

### Append PDF

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf", "output.pdf");
const longPDF = "/longPDF.pdf";

pdfDoc
  // just page 10
  .appendPage(longPDF, 10)
  // page 4 and page 6
  .appendPage(longPDF, [4, 6])
  // page 1-3 and 6-20
  .appendPage(longPDF, [
    [1, 3],
    [6, 20],
  ])
  // all pages
  .appendPage(longPDF)
  .endPDF();
```

### Insert PDF

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  // insert page3 from longPDF to current page 2
  .insertPage(2, "/longPDF.pdf", 3)
  .endPDF();
```

### Overlay PDF

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc.overlay("/overlayPDF.pdf").endPDF();
```

### Split PDF

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf");
const outputDir = path.join(__dirname, "output");

pdfDoc.split(outputDir, "prefix").endPDF();
```

### Encryption

```javascript
const Recipe = require("muhammara").Recipe;
const pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .encrypt({
    userPassword: "123",
    ownerPassword: "123",
    userProtectionFlag: 4,
  })
  .endPDF();
```
