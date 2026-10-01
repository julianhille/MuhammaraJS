# Migrate From v6 To v7

v7 replaces the single unscoped `muhammara` package with packages published
under the `@muhammara` organization on npm:

| Package                         | Contents                                                              |
| ------------------------------- | --------------------------------------------------------------------- |
| `@muhammara/native`             | Prebuilt native addon only                                            |
| `@muhammara/native-with-source` | Native addon plus the C++ source tree for local and Electron builds   |
| `@muhammara/native-core`        | Shared JavaScript layer; a dependency of both, never installed direct |

For most Node.js applications the migration is a dependency rename, an import
rename, a supported Node.js version, and a check that a prebuilt binary exists
for your platform (steps 1–7). Steps 8–16 cover Recipe behavior, step 17
TypeScript declarations, and steps 18–20 the low-level API; each affects only
code that uses those features. The
[Breaking Changes](../breaking-changes.md#version-7x) page lists every change
and the step that covers it.

!!! note "Upgrading from 5.x or older"

    This guide starts from 6.x. Read the
    [Breaking Changes](../breaking-changes.md) sections for every major version
    after yours first, for example [Version 6.x](../breaking-changes.md#version-6x)
    when you come from 5.x, and then follow the steps below.

## Why Upgrade

v7 passes PDF bytes between the native addon and JavaScript as `Buffer` chunks
instead of arrays of numbers
[#324](https://github.com/julianhille/MuhammaraJS/issues/324). Workflows that
keep PDFs in memory or write through JavaScript streams become much faster and
use far less memory. Workflows that read and write file paths are unchanged.

Editing a 48 MB PDF:

| Operation                                               | `muhammara` 6.0.6 | `@muhammara/native` 7 |
| ------------------------------------------------------- | ----------------- | --------------------- |
| Buffer-mode `Recipe`: edit every page, then `endPDF()`  | 6.4 s, 656 MB     | 0.40 s, 258 MB        |
| `createWriterToModify()` from a Buffer into a JS stream | 7.3 s, 559 MB     | 0.10 s, 255 MB        |
| File-path `Recipe`: edit every page, then `endPDF()`    | 0.21 s, 92 MB     | 0.21 s, 117 MB        |
| `recrypt()` between file paths                          | 0.35 s, 69 MB     | 0.33 s, 71 MB         |

Encrypting with `recrypt()` from a `PDFRStreamForBuffer` into a
`PDFWStreamForBuffer` grew quadratically with file size in v6, because RC4
output reached JavaScript one byte at a time:

| PDF size | `muhammara` 6.0.6            | `@muhammara/native` 7 |
| -------- | ---------------------------- | --------------------- |
| 0.48 MB  | 13.4 s, 172 MB               | 0.01 s, 72 MB         |
| 0.96 MB  | 60.4 s, 201 MB               | 0.01 s, 75 MB         |
| 4.8 MB   | did not finish in 10 minutes | 0.06 s, 90 MB         |

Measured on Linux x64 with Node.js 25 against generated, uncompressed PDFs.
Times and peak resident memory are the median of three runs.

## 1. Choose The Replacement Package

| v6 usage                                                                                  | v7 package                      |
| ----------------------------------------------------------------------------------------- | ------------------------------- |
| `npm install muhammara` on a platform with a matching prebuilt binary                     | `@muhammara/native`             |
| Installs that compiled locally, Electron rebuilds, or platforms without a prebuilt binary | `@muhammara/native-with-source` |

Both native packages expose the same API, the same TypeScript declarations, and
the same native binary metadata. They differ only in whether the C++ source is
included.

v6 shipped the prebuilt binaries and the C++ source in one package, so an
install without a matching prebuilt binary compiled from source. v7 separates
the two. `@muhammara/native` fails installation with a pointer to
`@muhammara/native-with-source` when no prebuilt binary matches; it never
compiles.

## 2. Replace The Dependency

```sh
npm uninstall muhammara
npm install @muhammara/native
```

Use the source-capable package instead when a matching prebuilt binary is
unavailable or Electron must rebuild the addon:

```sh
npm install @muhammara/native-with-source
```

To keep the scoped import name while using the source-capable package, use an
npm alias:

```sh
npm install @muhammara/native@npm:@muhammara/native-with-source@<version>
```

## 3. Update Imports

```javascript
// v6
var muhammara = require("muhammara");
var Recipe = require("muhammara").Recipe;

// v7
var muhammara = require("@muhammara/native");
var Recipe = require("@muhammara/native").Recipe;
```

`Recipe` remains bundled, so no separate `hummus-recipe` or `muhammara-recipe`
package is needed.

The shared JavaScript layer now lives in `@muhammara/native-core`, which both
native packages install as a dependency. Paths under `muhammara/lib/`, such as
`require("muhammara/lib/Recipe")`, were never public API and no longer resolve,
also under the npm alias below; import from the package root instead. Do not import
`@muhammara/native-core` from an application; it needs an addon supplied by an
implementation package.

### Stage The Rename

To postpone the import changes, alias the old package name. Existing
`require("muhammara")` calls keep working while the dependency is already v7:

```sh
npm install muhammara@npm:@muhammara/native@<version>
```

Treat this as a temporary step. The alias hides the package name from the
dependency tree and makes future upgrades harder to reason about.

## 4. Update TypeScript Imports

v6 shipped an ambient `declare module "muhammara"` block. v7 attaches the
declarations to each package, exports them with `export =`, and defines no
global namespace:

```typescript
import muhammara = require("@muhammara/native");

declare const writer: muhammara.PDFWriter;
declare const recipe: muhammara.Recipe;
```

Only the module name changes: `import`, `import = require()`, and module
augmentation forms that named `"muhammara"` compile once they name the new
package, or unchanged under the npm alias.

## 5. Confirm Prebuilt Coverage

v7 supports Node.js `20 || 22 || 24 || >=25`. 6.x declared `>=17` and shipped
prebuilds for Node.js 19 to 24, so Node.js 17, 18, 19, 21, and 23 are no longer
supported. Move to a supported Node.js release before upgrading.

Windows win32 (32-bit) prebuilds and build tooling were removed; use Windows
x64. Check that your platform, architecture, and runtime are listed in the
[prebuilt support matrix](installation.md#prebuilt-support-matrix). Install
`@muhammara/native-with-source` for any combination that is not.

## 6. Update Native Binary Tooling

v7 uses one Node-API 8 binary across all supported Node.js and Electron
versions. An ordinary npm install and public package import need no change beyond
the package rename described above. The native binary metadata, archive name,
and installed path do change:

|                   | v6                                                | v7                                        |
| ----------------- | ------------------------------------------------- | ----------------------------------------- |
| Prebuild archive  | `node-v{abi}-{platform}-{arch}-{libc}.tar.gz`     | `napi-v8-{platform}-{arch}-{libc}.tar.gz` |
| Installed addon   | `binding/muhammara.node`                          | `binding/napi-v8/muhammara.node`          |
| Runtime selection | Separate archive for each Node.js or Electron ABI | One archive for every Node-API 8+ runtime |

Update custom binary mirrors and direct-download deployment scripts to carry
the `napi-v8-*` archives. Stop copying or importing the addon through a
hard-coded `binding/muhammara.node` path; import the package so `node-pre-gyp`
resolves its declared module path. Tooling that intentionally inspects the
binary can read `binary.module_path`, `binary.package_name`, and
`binary.napi_versions` from the selected package's `package.json` rather than
duplicating these values.

The real `napi_versions: [8]` metadata also allows package analyzers such as
Turbopack to identify the addon as Node-API compatible.

## 7. Rebuild Electron Applications

Electron applications must install the source-capable package before running
`@electron/rebuild`, because the rebuild tool runs `node-gyp` directly and needs
the bundled source tree. See the
[Electron support policy](installation.md#electron-support-policy).

## 8. Reactivate Pages After `endPage()`

In v7, `Recipe.endPage()` clears the completed page and its content context.
Calls that draw on or configure a page must follow `createPage()` or
`editPage()` rather than relying on the completed page remaining active:

```javascript
recipe.endPage();

// Create another page before adding more content.
recipe.createPage("letter");
recipe.text("Next page", 72, 72);
```

When modifying a PDF, call `editPage()` with the one-based page number before
resuming page operations:

```javascript
recipe.endPage();
recipe.editPage(2);
recipe.text("More content", 72, 72);
```

After `endPage()`, shapes, `image()`, and `link()` throw
`TypeError: No page is active; call createPage() or editPage() first`, and
`table()`, `overlay()`, `setPageBox()`, `rotate()`, and `pauseContext()` throw
their own errors. `text()` draws nothing, and `comment()` or `annot()` make
`endPDF()` fail.

### Check The Recipe Lifecycle

Other Recipe lifecycle calls that 6.x tolerated now throw or behave
differently:

- `endPDF()` finishes the document once. A repeated call leaves the completed
  PDF unchanged instead of finalizing it again, which could crash 6.x; a
  repeated `endPDF(callback)` still receives the completed output. Create a
  new Recipe for changes made after `endPDF()`.
- A failed `endPDF()` retires the Recipe: its writer is aborted, its source
  file is released, and later calls rethrow the original error. Fix the cause
  and build the document again with a new Recipe instead of retrying.
- `pauseContext()` throws without an active page content context, and
  `resumeContext()` throws without a paused one. Call `pauseContext()` only
  after `createPage()` or `editPage()`, and `resumeContext()` once after each
  successful pause.
- `appendPage()` rejects zero, negative, fractional, reversed, and malformed
  page selections instead of clamping them. Pass positive one-based integers
  or ascending two-value ranges such as `[2, 5]`; integer endpoints beyond the
  source still clamp to its last page.
- `insertPage(afterPageNumber, pdfSrc, srcPageNumber)` throws a `TypeError`
  right away when `pdfSrc` or `srcPageNumber` is missing, where 6.x queued
  nothing or failed in `endPDF()`. Pass all three arguments.

## 9. Replace `Recipe.fillOpacity()`

`Recipe.fillOpacity()` was removed. Replace it with `Recipe.opacity()`, which
sets both fill and stroke alpha:

```javascript
// v6
recipe.fillOpacity(0.5);

// v7
recipe.opacity(0.5);
// Restore opaque drawing after translucent content.
recipe.opacity(1);
```

The undocumented `ANNOTATION_PREFIX`, `appendPDFPageFromPDFWithAnnotations()`,
and `appendPDFPagesFromPDFWithAnnotations()` members of the `Recipe` prototype
were internal helpers and are gone too. Copy pages with `appendPage()`,
`insertPage()`, or `split()` instead.

## 10. Rename Recipe Plugins That Collide With New Methods

v7 adds these Recipe methods: `deletePage`, `getCurrentPageInfo`,
`lineStyle`, `link`, `opacity`, `pie`, `removeText`, `replaceText`, `rotate`,
`rotateContent`, and `setPageBox`. `register()` refuses to replace an existing
method, so registering a plugin with one of these names now throws
`Found conflict in Recipe prototypes. <name> already exists.`
[#829](https://github.com/julianhille/MuhammaraJS/issues/829).

Rename the plugin, or use the built-in method if it does what your plugin did:

```javascript
// v6: a plugin named pie.
recipe.register("pie", drawPie);

// v7: register it under a name Recipe does not use.
recipe.register("drawPieChart", drawPie);
```

## 11. Pass Valid Recipe Options

v7 Recipe checks numeric options before it draws anything and throws where 6.x
wrote invalid PDF operators, drew nothing, or failed halfway through a call.
The Recipe stays usable after such an error. A computed value is the usual
source of these errors; guard it, or leave the option out to keep its default.

| Option                             | v7 throws for                                                       | 6.x behavior                                                  |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Text `size` or `fontSize`          | anything but a finite number greater than zero (`RangeError`)       | clamped negatives to 1pt, fell back to 14pt, or wrote `inf`   |
| Text `charSpace`                   | `NaN`, `Infinity`, or a non-number (`TypeError`)                    | wrote `inf Tc`, ignored `NaN`, or threw after drawing started |
| `rotation` of shapes, text, images | a value that is neither a number nor a numeric string (`TypeError`) | wrote `NaN` matrices, so the shape was missing or broken      |
| `miterLimit` of shapes and images  | a value below 1 or not a number (`RangeError`)                      | wrote the invalid limit, or ignored a non-number              |
| `n_gon()` sides, `star()` points   | `NaN`, `Infinity`, a non-number, or more than 100000 (`RangeError`) | ran out of memory and aborted, or drew nothing                |

`null` and `undefined` still select the default for each option: 14pt for
`size`, no spacing for `charSpace`, no rotation, and a miter limit of 1.414.

```javascript
var size = scale * base; // may compute 0 or NaN
recipe.text("Hello", 72, 72, size > 0 ? { size: size } : {});
```

In v6, `textDimensions("Hello", { size: -5 })` reported a width of
2147483645.5; it now throws like `text()` does.

### Check Annotation Flags

`annot()` and `comment()` now throw `Error: Unknown annotation flag (<name>)`
for a `flag` that is not a `Recipe.AnnotFlag` value, where 6.x wrote the
annotation without flags. Fix a misspelled name, use a `Recipe.AnnotFlag`
value, or pass a numeric bit mask, which 7.x also accepts.

### Check Annotation And Link Options

`annot()`, `comment()`, and the `highlight`, `underline`, `strikeOut`, and
`squiggly` options of `text()` throw `TypeError: Invalid annotation options`
before anything is queued or drawn when:

- `x` or `y` is neither a finite number nor `"center"`;
- `width` or `height` is not a finite number of at least zero;
- `opacity`, also on a reply, is outside 0 to 1;
- a border width is not finite, or `borderDash` contains non-numbers;
- `quadPoints` are not finite numbers in groups of eight.

6.x wrote such values into the PDF: a string size such as `"40"` into a corrupt
`/Rect`, a negative size as a reversed rectangle, `NaN` as `nan` or zero,
`opacity: 2` as an invalid `/CA 2`, and a numeric string such as `"50"` joined
into the coordinate (`5000`). Pass numbers in range, or omit the option.

`link()` and the `link` option of text, shapes, and images, new in v7, throw
`TypeError: URL link requires a URL and valid PDF rectangle` the same way for a
URL that is not a string or a rectangle that is not finite.

## 12. Check Recipe Colors

Recipe resolves colors more strictly, as `@muhammara/wasm` does:

- Annotation colors in `annot()`, `comment()`, and the `underline`,
  `strikeOut`, and `highlight` options of `text()` must be known. An unknown
  name, a gray `#rr` or CMYK `#ccmmyykk` string, or a number throws
  `TypeError: Unknown annotation color (<value>)`, where 6.x wrote the default
  color. Known colors are `#rrggbb`, `%r,g,b`, names registered with
  `chroma()`, and CSS color names in any case; a CSS name such as `"navy"` now
  writes that color instead of the default.
- An annotation `color` array with one number is a gray and one with four
  numbers a CMYK color. 6.x read both as RGB, so `[128]` wrote dark blue. Other
  lengths and values outside 0 to 255 throw a `TypeError`; three-number arrays
  are unchanged.
- Colors registered with `chroma()` belong to the Recipe that registered them.
  In 6.x every Recipe in the process shared one color table. Register the color
  on each Recipe that uses it; otherwise text and shape colors fall back to the
  default color, and annotation colors throw.
- Recipe no longer reads the undocumented `colour` alias. Rename `colour` to
  `color`, or the shape or text is drawn in the default color.
- An unknown colorspace in `chroma()`, text, or drawing options throws
  `TypeError: Unknown colorspace: <name>`; see [Type Colorspaces](#type-colorspaces).

```javascript
var first = new Recipe("new", "first.pdf");
first.chroma("brand", "#003366");

var second = new Recipe("new", "second.pdf");
// v7: register the color again on every Recipe that uses it.
second.chroma("brand", "#003366");
```

## 13. Check Recipe Shape And Annotation Placement

### Move Recipe Annotations To Their Top-Left Corner

`annot(x, y, subtype, { width, height })` now places the annotation
rectangle with (x, y) as its top-left corner, like `rectangle()` and `link()`
[#808](https://github.com/julianhille/MuhammaraJS/issues/808). In v6, (x, y) was the bottom-left corner, so the rectangle extended
`height` points up from `y`. A Square, Circle, FreeText, or other annotation
with a `height` now appears `height` points lower.

To keep the v6 position, subtract the height from `y`:

```javascript
// v6: the Square spans y 70..100.
recipe.annot(50, 100, "Square", { width: 120, height: 30 });

// v7: pass the top edge to cover the same area.
recipe.annot(50, 100 - 30, "Square", { width: 120, height: 30 });
```

Highlight, Underline, StrikeOut, and Squiggly annotations need no change. In
v6 their `QuadPoints`, which viewers draw, already hung down from `y`, while
their `Rect` lay above them. Both now cover the same area below `y`. Annotations
without a `height`, such as a 6.x `comment()`, and the `highlight`, `underline`,
`strikeOut`, and `squiggly` options of `text()` stay where they were.

### Stroke Recipe Lines As One Path

`line()` strokes all of its points as one path instead of one path per
segment [#799](https://github.com/julianhille/MuhammaraJS/issues/799).
Segments now meet at the `lineJoin` instead of overlapping their caps, so
corners drawn with `butt` caps are closed, and a translucent line no longer
darkens where segments overlap. To keep separate segments, draw each one on
its own:

```javascript
// v7: one path through every point.
recipe.line(
  [
    [50, 50],
    [150, 50],
    [150, 150],
  ],
  { color: "#003366", lineWidth: 4 },
);

// Separate segments, as v6 drew them.
recipe.moveTo(50, 50).lineTo(150, 50, { color: "#003366", lineWidth: 4 });
recipe.moveTo(150, 50).lineTo(150, 150, { color: "#003366", lineWidth: 4 });
```

## 14. Check Recipe Images

### Move Bottom-Aligned Images Back Where v6 Drew Them

`image()` with `align: "left bottom"`, `"center bottom"`, or `"right bottom"`
now moves the image down by half its height from its top-left placement, as
the option has always been documented [#857](https://github.com/julianhille/MuhammaraJS/issues/857). v6 moved it up by 1.5 times its
height instead, so the image now appears twice its drawn height lower.

To keep the v6 position, subtract twice the drawn height from `y`. With both
`width` and `height` given, the drawn height is `height` unless
`keepAspectRatio` fits the image into a smaller one:

```javascript
// v6: this image appeared with its top edge 150 points above y = 400.
recipe.image("photo.jpg", 100, 400, {
  width: 200,
  height: 100,
  keepAspectRatio: false,
  align: "left bottom",
});

// v7: move y up by twice the drawn height to draw it at the same place.
recipe.image("photo.jpg", 100, 400 - 2 * 100, {
  width: 200,
  height: 100,
  keepAspectRatio: false,
  align: "left bottom",
});
```

When only `width` or `scale` is given, compute the drawn height from the image
size, which `writer.getImageDimensions()` returns.

### Check Recipe Image And Color Options

`image()` now uses `fill`, `stroke`, and `color`, which 6.x ignored for images:
`fill` paints the image box beneath the image, and `stroke` or `color` outlines
it [#857](https://github.com/julianhille/MuhammaraJS/issues/857). If you pass
one options object to both shapes and images, leave these options out of the
`image()` call to keep the 6.x output:

```javascript
var style = { color: "#003366", opacity: 0.8 };
recipe.rectangle(50, 50, 100, 40, style);

// v7: without color, the image is drawn without an outline, as in v6.
var { color, ...imageStyle } = style;
recipe.image("photo.jpg", 50, 120, { ...imageStyle, width: 100 });
```

### Size Rotated And Placed PDF Pages

A PDF page used as an image is measured as its media box width by height
[#856](https://github.com/julianhille/MuhammaraJS/issues/856). 6.x swapped the
two: for a 595×842 portrait page, `getImageDimensions()` returned
`{ width: 842, height: 595 }`, `drawImage()` with
`transformation: { width, height }` scaled each axis by the other's size, and
Recipe `image()` drew the page at the wrong size and position. Remove code that
swapped the values back.

Recipe `image()` also turns a PDF page by its `/Rotate` entry, as viewers
display it, and measures a page turned by 90 or 270 degrees with its width and
height swapped [#857](https://github.com/julianhille/MuhammaraJS/issues/857).
6.x drew such a page unturned. Pass the `width`, `height`, or `scale` for the
displayed page.

## 15. Check Recipe Text Layout

### Trim Boundary Whitespace From `charSpace` Text

v7 Recipe character-spacing measurements count every character of the text,
including leading and trailing whitespace such as spaces, tabs and non-breaking
spaces (`U+00A0`), matching Wasm. v6 trimmed boundary whitespace before
counting, so text with `charSpace` can now measure wider, wrap earlier, or
align differently: `" Label "` adds two more `charSpace` gaps than in v6.
Characters outside the Basic Multilingual Plane, such as emoji, now count once
instead of twice.

If boundary whitespace should not add spacing, trim the text before passing
it, and move `x` where the indent must stay visible:

```javascript
var label = "  Indented label  ";
recipe.text(label.trim(), 72, 72, { charSpace: 2 });
```

### Wrap Recipe HTML Text Explicitly

Recipe text with `html: true` keeps text outside any element on one line with
its neighboring inline elements, with one space between them:
`x <b>a</b> y` renders as the single line `x a y`, as it already did inside
`<p>` [#667](https://github.com/julianhille/MuhammaraJS/issues/667). In v6 each
top-level text run and inline element started its own line and lost its
leading space. Wrap content in `<p>` elements, or add `<br>`, where separate
lines are intended:

```javascript
recipe.text("<p>First line</p><p>Second line</p>", 72, 72, { html: true });
```

`htmlToTextObjects()` returns a `<br>` as an object with `lineBreak: true`
instead of a `p` object holding placeholder text.

## 16. Choose Table Columns Explicitly

v7 `Recipe.table()` builds its columns from every record instead of only the
first one, keeps `order` and `columns` entries even when no record has that
field, and uses exactly the listed `columns` when there is no `order`. In v6, a
field missing from the first record was dropped, and a `columns` list longer
than the first record's fields was ignored in favor of those fields. A column
`renderer` result now also sizes its row. Tables can therefore gain columns,
change column order, or get taller rows. A misspelled `order` or `columns` name
now draws an empty column instead of being dropped silently; check the names
against your records.

To keep a fixed set of columns, list them with `order` or `columns`:

```javascript
recipe.table(50, 52, people, {
  order: ["name", "city"],
  columns: [
    { name: "name", text: "Name", width: 180 },
    { name: "city", text: "City", width: 160 },
  ],
});
```

Row and header sizing now includes vertical padding, `minHeight`, fixed
`height`, and rendered HTML rather than just unpadded plain text. A default
cell's 2pt top and bottom padding therefore adds 4pt to its row height. To make
rows more compact, set column `cell.padding` and `header.cell.padding`
explicitly; remove or reduce any unnecessary `minHeight`/`height`. HTML cells
reserve the space their rendered lines need.

Review overflow callbacks after adjusting sizing. The callback receives the
Recipe as `this` and its first argument, and is called once per pending row.
If it continues, the destination must fit both the repeated header and the
entire row within the table height and page bottom margin. Otherwise `table()`
throws `RangeError` before drawing that header or row. Return `true` to stop,
move the next segment upward, choose a taller page/table area, or split an
oversized record into multiple rows. See [Create Multi-Page Tables](../how-to/create-tables.md).

Array-form `order` preserves exact field names, including whitespace and
empty-string keys; the comma-separated form trims surrounding whitespace.

A column `renderer` now receives `""` for a `null` value; in 6.x a `null` value
made the table fail with an internal `TypeError`. After drawing, `table()` leaves the text cursor
at the table's left edge and bottom, where 6.x left it after the last cell, so
pass coordinates to a following `text()` call. Tables with empty contents or no
discovered columns preserve the cursor.

## 17. Update TypeScript Declarations

v7 declares the native API more precisely. A few 6.x declarations were broader
than what the runtime accepts, so TypeScript code written against them can fail
to compile in the following cases. Recipe members that 6.x did not declare at
all, such as `register()`, `table()`, `chroma()`, and `metadata`, are new
declarations and need no migration.

### Type Text Overflow Callbacks

Text overflow callbacks were typed `() => void` in 6.x, but a callback that
returns nothing already failed at runtime. They now receive the active `Recipe`
and must return `true` to stop, `false` to continue, or an object selecting the
next `layout` and/or `column`. A column can be an index or an `[x, y]` position:

```typescript
recipe.layout("article", 72, 72, 468, 600, { columns: 2, gap: 18 });
recipe.text(longText, {
  layout: "article",
  overflow: (currentRecipe) => {
    currentRecipe.endPage().createPage("letter");
    return { layout: "article", column: 0 };
  },
});
```

### Type Vector Options

`rectangle()` `rotationOrigin` is a two-number tuple instead of `number[]`.
Annotate a reusable origin as `[number, number]`:

```typescript
var origin: [number, number] = [100, 100];
recipe.rectangle(50, 50, 100, 40, { rotation: 30, rotationOrigin: origin });
```

`lineTo()` options no longer declare `fill`, which 6.x declared but ignored.
Remove it; fill a closed path with `polygon()` instead.

### Type Colorspaces

The low-level `ColorOptions.colorspace` no longer accepts a value typed
`string`, and an unknown colorspace such as `"lab"` throws a `TypeError` at
runtime: `Unknown colorspace: lab` from Recipe, and
`colorspace must be rgb, gray, or cmyk` from the low-level drawing and
`writeText()` options. Use `muhammara.DeviceColorSpace` values:

```typescript
context.drawRectangle(10, 10, 100, 40, {
  type: "fill",
  color: 0xff000000,
  colorspace: muhammara.DeviceColorSpace.CMYK,
});
```

### Type Low-Level Declarations

These low-level declarations are narrower than in 6.x:

- `PDFReader#getXrefPosition()` takes no argument; 6.x required one and
  ignored it. Drop the argument.
- `InfoDictionary#getAdditionalInfoEntries()` takes no `key`; the call always
  returned every entry. Drop the argument and read the key from the result.
- `DocumentCopyingContext#getSourceDocumentParser()` takes no arguments; it
  always returned the parser of the copying context's source document.
- `WriteTextOptions` no longer declares `strikeOut` and `lineWidth`, which
  `writeText()` never read. Remove them, draw the line with `drawPath()`, or use
  the Recipe `text()` `strikeOut` option.
- `toPDF*()` and `toNumber()` on PDF objects may return `undefined`, which
  they do for a different object type. Check the result, or `getType()`, before
  using it.
- `PDFWStreamForBuffer#buffer` may be `null`; check it before use.
- `InfoDictionary#trapped` and the `J()` and `j()` arguments take `0`, `1`,
  or `2` instead of any `number`; pass a literal, or a `LineCapStyle` constant
  for `J()`.
- `eTokenSeparatorSpace`, `eTokenSeparatorEndLine`, and `eTokenSeparatorNone`
  are constants only, no longer types; write
  `typeof muhammara.eTokenSeparatorSpace` where a type is needed.
- `ReadStream#read()` is declared as returning `Uint8Array | number[]`; see
  [step 19](#19-accept-buffers-in-custom-streams).

## 18. Check Low-Level Drawing Options

The `drawPath`, `drawCircle`, `drawSquare`, and `drawRectangle` helpers now
interpret `type: "clip"` as clipping without painting. Previously that spelling
did not apply a clip, while unknown strings incorrectly entered the clip branch.
Any other `type`, including misspellings such as `"fil"` and falsy values such
as `false`, `0`, or `""`, now throws
`TypeError: Unknown drawing type; use "stroke", "fill", "clip" or null`. Replace
it with `"clip"` when clipping is intended, `"stroke"`/`"fill"` when drawing an
outline or filled shape is intended, or `null` to end the path unpainted.
`type: undefined` strokes, as an omitted `type` does; in 6.x it clipped too.

Clipping now ends the path (`W n`). Do not rely on a later painting operator to
paint that same path: draw the shape again with a painting type if necessary.
Save graphics state with `q()` before the clip, draw the content that should be
clipped, then restore it with `Q()` so later content is unaffected. See
[Draw Primitives](../low-level/drawing-primitives.md).

Drawing helpers and `writeText()` also convert their inputs before emitting
operators. If an option getter or numeric conversion throws, correct the input
and retry; failed calls no longer leave partial drawing output in the stream.

Coordinates, dimensions, stroke widths, and `writeText()` font sizes must
convert to finite numbers. Replace `NaN` and infinities with finite values and
reduce values whose circle or underline calculations overflow. Finite numeric
coercions remain supported. Supply at least two complete coordinate pairs to
`drawPath()`; malformed pairs and extra arguments now throw instead of silently
drawing a prefix. A failed call emits no operators and can be retried after
correcting the input.

Colors are checked too:

- A string `color` must be a CSS color name or a `#rrggbb` string. 6.x drew
  every string color black, including valid `#rrggbb` values, so such shapes
  now appear in their color. Other strings, such as hex without the `#`,
  throw a `TypeError`; pass a CSS name, `#rrggbb`, or a 24-bit number such as
  `0xff0000`.
- A gray or CMYK color must be a number. A color name or `#rrggbb` string is
  RGB, so v7 throws `only a numeric color can use the gray or cmyk colorspace`
  where 6.x drew it in RGB; drop `colorspace` for such a color. See
  [Draw in Gray and CMYK](../how-to/draw-in-gray-and-cmyk.md).

Text operators and measurements are stricter:

- `Tj()`, `Quote()`, `DoubleQuote()`, and `TJ()` throw a `TypeError` for a
  glyph list item that is not a `[glyphId, unicodeCodePoint]` array, where 6.x
  skipped it. Pass `TJ` items as separate arguments: `TJ("ab", -100, "c")`
  instead of `TJ(["ab", -100, "c"])`. `TJ()` with text items also throws when
  a glyph list comes last instead of dropping it as if it were options.
- `UsedFont#calculateTextDimensions()` throws a `TypeError` for a font size
  that is not a finite number greater than zero. 6.x measured `0`, `NaN`, and
  infinite sizes as zero and wrapped a negative size to a huge integer. Pass a
  size greater than zero, or omit it to measure at size 1.

## 19. Accept Buffers In Custom Streams

Custom write streams passed to `createWriter`, `createWriterToModify`,
`recrypt`, or the `log` option now receive each chunk as a `Buffer` instead of
an array of numbers. The built-in `PDFRStreamForFile` and `PDFRStreamForBuffer`
also return `Buffer` chunks from `read()`, and so do the byte readers returned
by `startReadingFromStream()`, `startReadingFromStreamForPlainCopying()`,
`getParserStream()`, and `getSourceDocumentStream()`. This makes large in-memory and
Buffer-mode `Recipe` work several times faster and far smaller
[#324](https://github.com/julianhille/MuhammaraJS/issues/324).

Streams that only read `bytes.length`, index bytes, or pass the chunk to
`Buffer.from()` keep working. Code that relies on array methods does not:

```javascript
// v6: bytes was an array of numbers.
write: function (bytes) {
  this.data = this.data.concat(bytes);
  return bytes.length;
},

// v7: bytes is a Buffer, which may be kept after write() returns.
write: function (bytes) {
  this.chunks.push(bytes);
  return bytes.length;
},
```

Output is batched into chunks of up to 64 KiB, and the final chunk is delivered
when the writer ends, `recrypt()` returns, or the writer is shut down or
aborted. Read the collected output after those calls rather than while pages
are still being written.

`write` must return the full length of the chunk it received. In v6 a smaller
return value was ignored; now it fails the writer: creating it, later writes,
`end()`, and `shutdown()` throw. Return `bytes.length` once the chunk is
accepted, and throw from `write` to report a real failure.

Replace `concat`, `push(...bytes)`, `splice`, and `Array.isArray` checks with
Buffer operations, or call `Array.from(bytes)` where an array is still needed.
TypeScript implementations of `WriteStream` or the `log` option must declare
`write(bytes: Buffer)`. Custom read streams may keep returning arrays; returning
a `Uint8Array` or `Buffer` is now also accepted and faster. `ReadStream#read()`
is declared as returning `Uint8Array | number[]`, so code that types its result
as `number[]` needs `Array.from()` or a wider type.

`getCurrentPosition()` of a custom stream must return a finite byte position
within `[-2^63, 2^63)`. A result that converts to `NaN`, an infinity, or a
value outside that range throws a `TypeError` instead of writing corrupt PDF
offsets; numeric strings and other finite coercions still work. See the
[stream contract](../low-level/custom-streams.md).

## 20. Handle Writer And Reader Errors

The low-level writer and reader stop on errors that 6.x passed over:

- Stateful `PDFWriter` calls after `end()` or `shutdown()`, including after a
  failed finalization, throw `Error("PDF writer has ended")` instead of
  touching closed resources or crashing. Create a new writer with
  `createWriter()` or `createWriterToModify()`, or resume a saved state with
  `createWriterToContinue()`; a bare `new PDFWriter()` is not active. Repeated
  `end()` remains a no-op. See [Writer lifecycle](../api/writer.md#lifecycle).
- `end()` throws
  `Error: End the active objects context operation before ending the PDF`
  while a dictionary started with `startDictionary()` is still open. 6.x wrote
  the cross-reference table and trailer inside it and damaged the PDF. End the
  dictionary and call `end()` again; the writer stays usable.
- `appendPDFPagesFromPDF()` ends its writer when copying pages fails, because
  the document may already be partly written. Create a fresh writer and retry
  with a valid source. A source that cannot be opened, parsed, or decrypted,
  and a page range outside the source, throw before anything is written and
  leave the writer usable.
- `PDFReader` methods that take a page index or object ID — `parseNewObject()`,
  `getPageObjectID()`, `parsePageDictionary()`, `parsePage()`, and
  `getXrefEntry()` — accept only a non-negative integer below 2^32 and
  otherwise throw `TypeError: Page index must be a non-negative integer` (or
  `Object ID must be a non-negative integer`). In 6.x `reader.parsePage(1.5)` read the
  second page and `NaN` read index 0. Round or validate the value first,
  bounding page indices with `getPagesCount()` and object IDs with
  `getObjectsCount()`.

## What Does Not Change

- The entry points `createWriter()`, `createReader()`, `createWriterToModify()`,
  and `new Recipe()` keep their names. Changes to individual methods and
  options that can affect existing code are listed on the
  [Breaking Changes](../breaking-changes.md#version-7x) page; the steps above
  cover the ones that need a code change.
- Prebuilt binaries still install through `node-pre-gyp`; only their archive
  names change, as described in step 6.

## Version 6 Status

The unscoped `muhammara` package (1.x to 6.x) is deprecated on npm. Its
deprecation message points to `@muhammara/native` and to this guide, and it
receives no further releases. Existing v6
installations keep working; it is simply a different package from
`@muhammara/native`.

For the full list of compatibility changes, including those of 5.x and older,
see [Breaking Changes](../breaking-changes.md).
