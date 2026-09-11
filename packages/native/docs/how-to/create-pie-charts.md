# Create A Pie Chart

Draw one closed `pie()` wedge for each value. Angles start at -90 degrees so
the first slice begins at the top of the chart; advance the start angle by each
slice's share of 360 degrees.

```javascript
var data = [
  { label: "Comedy", value: 8, fill: "#ef4444" },
  { label: "Action", value: 5, fill: "#f97316" },
  { label: "Romance", value: 6, fill: "#22c55e" },
  { label: "Drama", value: 1, fill: "#3b82f6" },
];
var total = data.reduce(function (sum, slice) {
  return sum + slice.value;
}, 0);
var startAngle = -90;
var pdfDoc = new Recipe("new", "pie-chart.pdf");

pdfDoc.createPage("letter").text("Favorite Movies", 235, 100, { size: 18 });
data.forEach(function (slice) {
  var endAngle = startAngle + (slice.value / total) * 360;
  pdfDoc.pie(306, 396, 120, startAngle, endAngle, {
    fill: slice.fill,
    stroke: "#ffffff",
  });
  startAngle = endAngle;
});
pdfDoc.endPage().endPDF();
```

`pie()` closes the arc to its center, so each slice can be filled independently.
For a fuller chart helper with percentage labels, callouts, and offset slices,
see [`tests/recipe/arcs.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/arcs.js).
