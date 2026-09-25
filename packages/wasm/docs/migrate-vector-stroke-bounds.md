# Migrate Vector Stroke Bounds

Recipe now keeps `circle()`, `ellipse()`, `rectangle()`, `arc()`, and `pie()`
strokes inside the requested dimensions, matching the native package. Earlier
Wasm releases centered the stroke on the requested boundary, so half the line
width extended beyond it.

Most callers need no changes. The corrected behavior makes the requested size
the complete painted size and prevents thick strokes from overlapping nearby
content unexpectedly.

## Preserve The Previous Rectangle Output

If a layout intentionally relied on the previous overshoot, draw the nominal
fill and the expanded stroke separately. Move the stroke origin outward by half
the line width and add the full line width to each dimension:

```js
var lineWidth = 10;
var halfLineWidth = lineWidth / 2;

recipe
  .rectangle(50, 50, 100, 60, { fill: "#ffffff" })
  .rectangle(
    50 - halfLineWidth,
    50 - halfLineWidth,
    100 + lineWidth,
    60 + lineWidth,
    { stroke: "#000000", lineWidth },
  );
```

This also preserves rounded-rectangle stroke placement when the stroke call
uses the same `borderRadius`.

## Preserve Center-Based Shape Output

Keep the same center and add half the line width to the stroke radius. For an
ellipse, add it to both radii:

```js
var lineWidth = 10;
var halfLineWidth = lineWidth / 2;

recipe
  .circle(100, 100, 40, { fill: "#ffffff" })
  .circle(100, 100, 40 + halfLineWidth, {
    stroke: "#000000",
    lineWidth,
  })
  .ellipse(220, 100, 60, 30, { fill: "#ffffff" })
  .ellipse(220, 100, 60 + halfLineWidth, 30 + halfLineWidth, {
    stroke: "#000000",
    lineWidth,
  });
```

Apply the same radius adjustment to stroke-only `arc()` and `pie()` calls.
When a shape uses rotation, skew, opacity, dashes, or other stroke options,
repeat those options on the separate stroke call. Set `rotationOrigin` explicitly
to the original shape's origin when expanding geometry that uses rotation.
