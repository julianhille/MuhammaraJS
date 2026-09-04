# Create Multi-Page Tables

Pass records and column definitions to `table`. Define an `overflow` callback
to start a new page when the table needs more space.

```javascript
var columns = [
  { text: "Name", name: "name", width: 180 },
  { text: "City", name: "city", width: 160 },
];
var nextPage = function (recipe) {
  recipe.endPage().createPage("letter");
  return { position: [50, 52] };
};

pdfDoc.createPage("letter").table(50, 52, people, {
  columns: columns,
  header: true,
  border: true,
  overflow: nextPage,
});
```

Columns can set widths, alignment, and renderers; table options support header,
border, row styling, sorting, and overflow behavior. `table()` is implemented
and tested but is not currently represented in `muhammara.d.ts`. See
[`tests/recipe/table.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/table.js).
