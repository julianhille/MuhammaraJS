# Add Clickable URL Links

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
`tests/LinksTest.js` for text and image link examples.
