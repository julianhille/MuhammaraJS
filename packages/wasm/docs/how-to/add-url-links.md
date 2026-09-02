# Add Clickable URL Links

Recipe adds a URL action to a rectangular region using top-left `x`, `y`,
`width`, and `height` values:

```javascript
var outputBytes = new Recipe()
  .createPage(595, 842)
  .rectangle(65, 100, 465, 120, { fill: "#dbeafe" })
  .link("https://example.com", 65, 100, 465, 120)
  .endPage()
  .endPDF();
```

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
