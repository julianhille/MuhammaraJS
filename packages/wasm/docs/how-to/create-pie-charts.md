# Create A Pie Chart

Draw one closed `pie()` wedge for each value. Angles start at -90 degrees so
the first slice begins at the top of the chart; advance the start angle by each
slice's share of 360 degrees.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
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
var pdf = new Recipe()
  .createPage("letter")
  .text("Favorite Movies", 235, 100, { size: 18 });

data.forEach(function (slice) {
  var endAngle = startAngle + (slice.value / total) * 360;
  pdf.pie(306, 396, 120, startAngle, endAngle, {
    fill: slice.fill,
    stroke: "#ffffff",
  });
  startAngle = endAngle;
});
var bytes = pdf.endPage().endPDF();
```

`pie()` closes the arc to its center, so each slice can be filled independently.
Create a `Blob` from `bytes` to preview, download, or upload the result; see
[Preview, Download, or Upload a PDF](serve-a-pdf-response.md) for those steps.
