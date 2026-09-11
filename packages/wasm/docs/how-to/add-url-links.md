# Add Clickable URL Links

Recipe adds URL actions using top-left coordinates. Use `link()` when the
clickable region is independent of its content, such as a custom drawing:

```javascript
var outputBytes = new Recipe()
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
  .image("logo", 65, 290, {
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

The low-level API uses PDF bottom-left rectangle coordinates. Pause an active
page content context before attaching the link:

```javascript
var context = writer.startPageContentContext(page);
context.drawRectangle(88, 694, 112, 26, { color: 0xdbeafe });

writer
  .pausePageContentContext(context)
  .attachURLLinktoCurrentPage("https://example.com", 88, 694, 200, 720)
  .writePage(page);

var outputBytes = writer.end();
```

The PDF viewer decides how link regions are indicated and whether navigation
requires confirmation.
