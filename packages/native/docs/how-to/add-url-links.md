# Add Clickable URL Links

Recipe adds URL actions using top-left coordinates. Use `link()` when the
clickable region is independent of its content, such as a custom drawing:

```javascript
var recipe = new Recipe("new", "links.pdf")
  .createPage(595, 842)
  .rectangle(65, 100, 465, 120, { fill: "#dbeafe" })
  .link("https://example.com", 65, 100, 465, 120)
  .endPage()
  .endPDF();
```

Text, images, and supported shapes can instead calculate their clickable
rectangle from their rendered bounds:

```javascript
recipe
  .text("Visit our site", 65, 250, {
    color: "#0563c1",
    underline: true,
    link: "https://example.com",
  })
  .image("logo.png", 65, 290, {
    width: 120,
    link: "https://example.com",
  })
  .rectangle(65, 450, 180, 48, {
    fill: "#dbeafe",
    link: "https://example.com",
  });
```

With `html: true`, `<a href="https://example.com">Visit our site</a>` creates
a link over the rendered text. PDF link annotations are rectangular; use
`link()` to select the clickable region for complex drawings.

The low-level API attaches a URL to a rectangle on the current page. Pause the
active content context before adding links, then write the page.

```javascript
var context = pdfWriter.startPageContentContext(page);
context.writeText("Visit our site", 90, 710, textOptions);

pdfWriter
  .pausePageContentContext(context)
  .attachURLLinktoCurrentPage("https://example.com", 88, 694, 200, 720)
  .writePage(page)
  .end();
```

The rectangle values are PDF coordinates: left, bottom, right, and top. See
[`tests/LinksTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/LinksTest.js) for text and image link examples.
