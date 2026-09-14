# Flow Text Into Columns

Create a named layout with columns, then send text to it. An overflow callback
can end the current page and create the next page.

```javascript
var nextPage = function (recipe) {
  recipe.endPage().createPage("letter");
  return { layout: "article" };
};

pdfDoc
  .createPage("letter")
  .layout("article", 72, 72, 468, 600, { columns: 2, gap: 18 })
  .text(article, {
    layout: "article",
    flow: false,
    overflow: nextPage,
    textBox: { textAlign: "justify" },
  });
```
