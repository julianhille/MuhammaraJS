# Migrate From v6 To v7

v7 replaces the single unscoped `muhammara` package with packages published
under the `@muhammara` organization on npm:

| Package                         | Contents                                                              |
| ------------------------------- | --------------------------------------------------------------------- |
| `@muhammara/native`             | Prebuilt native addon only                                            |
| `@muhammara/native-with-source` | Native addon plus the C++ source tree for local and Electron builds   |
| `@muhammara/native-core`        | Shared JavaScript layer; a dependency of both, never installed direct |

For Node.js applications the migration is a dependency rename, an import rename,
a page-box constant update, a TypeScript Recipe declaration update, and a check
that a prebuilt binary still exists for your platform.

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
native packages install as a dependency. Paths under `muhammara/lib/` were never
public API and have no direct v7 equivalent. Do not import
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

Code that relied on the ambient declaration being visible without importing the
package fails to compile and needs an explicit import.

## 5. Confirm Prebuilt Coverage

Node.js version support is unchanged: `20 || 22 || 24 || >=25` in both v6 and
v7.

Check that your platform, architecture, and runtime are listed in the
[prebuilt support matrix](installation.md#prebuilt-support-matrix). Install
`@muhammara/native-with-source` for any combination that is not.

## 6. Rebuild Electron Applications

Electron applications must install the source-capable package before running
`@electron/rebuild`, because the rebuild tool runs `node-gyp` directly and needs
the bundled source tree. See the
[Electron support policy](installation.md#electron-support-policy).

## 7. Update Recipe Page Boxes

`Recipe.setPageBox()` no longer accepts string box names. Replace each name with
its matching `ePDFPageBox*` constant:

```javascript
// v6
recipe.setPageBox("crop", 18, 18, 577, 824);

// v7
recipe.setPageBox(muhammara.ePDFPageBoxCropBox, 18, 18, 577, 824);
```

Use `ePDFPageBoxMediaBox`, `ePDFPageBoxCropBox`, `ePDFPageBoxBleedBox`,
`ePDFPageBoxTrimBox`, or `ePDFPageBoxArtBox` for the respective page box.

## 8. Replace `Recipe.fillOpacity()`

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

## 9. Reactivate Pages After `endPage()`

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

## 10. Update Recipe Types

v7 replaces several broad native Recipe declarations with types that describe
the values accepted by the runtime. These declaration changes do not alter
JavaScript behavior, but existing TypeScript can fail to compile in the
following cases.

### Type Registered Extensions

`Recipe.register()` no longer accepts the unspecific `Function` type. Give the
callback a callable signature, or use `Recipe.ExtensionCallback` when the
extension uses its Recipe `this` context:

```typescript
var drawMarker: muhammara.Recipe.ExtensionCallback<
  [number, number],
  muhammara.Recipe
> = function (x, y) {
  return this.moveTo(x, y).lineTo(x + 10, y + 10);
};

recipe.register("drawMarker", drawMarker);
```

One-argument registration still requires a function with a non-empty runtime
`name`. TypeScript cannot distinguish named and anonymous functions, so use the
two-argument overload when the callback is anonymous.

### Type Layouts And Tables

`Recipe.layout()` and `Recipe.table()` now declare their supported options.
Use `LayoutOptions` and `TableOptions<Row>` so object literals are checked. A
variable typed only as `object` can still bypass structural checking, but it
provides no option validation. A table column name must identify a non-empty
field of `Row`, and each array-form `order` entry must identify a field of
`Row`. A renderer receives the value type for its specific key, the complete
row, the column-name literal, and a one-based row number:

```typescript
type ScoreRow = { name: string; score: number };

var tableOptions: muhammara.Recipe.TableOptions<ScoreRow> = {
  columns: [
    {
      name: "score",
      renderer: (score, row, field) => {
        var value: number = score;
        var column: "score" = field;
        return { bold: row.name === "Ada" && value > 5 && column === "score" };
      },
    },
  ],
  row: { nth: "odd" },
  overflow: (currentRecipe) => {
    currentRecipe.endPage().createPage("letter");
    return { position: [40, 40] };
  },
};

recipe.table(40, 40, [{ name: "Ada", score: 10 }], tableOptions);
```

Replace unknown option fields, table column names that are not present in the
row type, `row.nth` values other than `"even"` or `"odd"`, truthy renderer
return values other than text options, and overflow return values other than a
boolean or `{ position: [x, y] }`. A renderer can return `false`, `null`, or
`undefined`, as well as `0` or an empty string, when it has no overrides. Use
`cell` rather than `textBox` for a column's box options. These values were
previously accepted by the broad declaration but are not supported table
instructions.

An empty array-form `order` is populated from `columns` at runtime and must be
mutable. A non-empty readonly tuple remains accepted because Recipe only reads
it.

Text overflow callbacks now receive the active `Recipe` and must return `true`
to stop, `false` to continue, or an object selecting the next `layout` and/or
`column`. A column can be an index or an `[x, y]` position:

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

### Type Text Markup Options

Objects passed through `highlight`, `underline`, `strikeOut`, and `squiggly` may
set `text`, `color`, annotation `opacity`, and `replies`. Put shared annotation
metadata such as `title`, `open`, `richText`, `flag`, `icon`, `date`, and
`subject` on the outer text options, where the runtime reads it:

```typescript
recipe.text("Reviewed", 40, 40, {
  title: "Reviewer",
  underline: { text: "Approved", color: "green", opacity: 0.8 },
});
```

### Type Colorspaces

Recipe constructor, text, and drawing options accept `"rgb"`, `"gray"`,
`"cmyk"`, or `"separation"`. Annotate reusable values with `Colorspace`, or
with `DeviceColorspace` when separation colors are not appropriate, instead of
widening them to `string`:

```typescript
var documentColorspace: muhammara.Recipe.Colorspace = "separation";
var drawingColorspace: muhammara.Recipe.Colorspace = "separation";

var options: muhammara.Recipe.RecipeOptions = {
  colorspace: documentColorspace,
};
recipe.chroma("spotBlue", [23, 119, 209], "separation");
recipe.text("Spot color", 40, 40, {
  color: "spotBlue",
  colorspace: drawingColorspace,
});
```

`Recipe.chroma()` continues to accept dynamic strings for compatibility, but
known invalid literals such as `"lab"` now fail `tsc` because the runtime throws
for them. Use `"rgb"`, `"gray"`, `"cmyk"`, or `"separation"`.

### Type Arrows And Triangles

`Recipe.arrow()` now uses `ArrowOptions`. Replace broad string or number
variables with finite runtime values, and represent `head` and `shaft` arrays as
one-to-three and one-to-two value tuples respectively:

```typescript
var arrow: muhammara.Recipe.ArrowOptions = {
  type: "dart", // 0, 1, 2, "triangle", "dart", or "kite"
  at: "head", // "head" or "tail"
};
var triangle: muhammara.Recipe.TriangleMeasurementOptions = {
  traitID: "sas", // "sss", "sas", "asa", or "vtx"
  position: "centroid",
};

recipe.arrow(100, 100, arrow);
recipe.triangle(200, 100, [50, 60, 70], triangle);
```

The runtime historically tolerated unsupported arrow types and anchors by
using default geometry. Omit the option when that fallback is intended.

Triangle positions are `"a"`, `"b"`, `"c"`, `"centroid"`, `"circumcenter"`,
or `"incenter"`. Trait identifiers and positions are case-insensitive. Measured
triangles use exactly three numbers with `TriangleMeasurementOptions`; `"vtx"`
triangles use exactly three `[x, y]` pairs with `TriangleVertexOptions`:

```typescript
recipe.triangle(
  200,
  100,
  [
    [0, 0],
    [50, 0],
    [0, 60],
  ],
  { traitID: "vtx" },
);
```

Vertex tuples may be readonly when `position`, `flipX`, and `flipY` are omitted.
Positioning or flipping translates coordinates in place, so those vertex tuples
must be mutable.

### Type Vector Options

Reusable path options now check `lineCap`, `lineJoin`, and `rotationOrigin`.
Annotate widened variables and use a two-number tuple for the origin. Use
`PathOptions` for shared line styling and a shape-specific type when configuring
fills or transforms:

```typescript
var polygonOptions: muhammara.Recipe.PolygonOptions = {
  fill: "#000000",
  lineCap: "round",
  lineJoin: "bevel",
  rotationOrigin: [100, 100],
};
```

The `debug` option belongs to `ShapeOptions`, `NGonOptions`, `ArrowOptions`, and
`TriangleOptions`; direct `polygon()` calls ignore it.

Direct `rectangle()` calls accept `borderRadius` as a number or a tuple of one
to four corner radii. Text-box styles additionally accept `true`, which uses the
Recipe default radius.

`circle()` supports shared drawing fields such as color, width, opacity, and
dashes, plus `skewX` and `skewY`; it does not consistently support rotation.
`ellipse()`, `arc()`, and `pie()` additionally use `EllipseOptions` for all
transforms. Rectangles support transforms but do not apply line-cap/join fields.
Use `PolygonOptions` for transformed paths with cap, join, and miter controls.

The more precise `Recipe.read()` metadata and `Recipe.htmlToTextObjects()`
result types and reusable `Color` and permission types are additive and require
no migration.

### Type Recipe Metadata

`Recipe.metadata` now reflects the two counters used by the runtime: a document
read from a file has `pages`, while a document created from scratch has
`pageCount`. Both fields are optional on `Metadata`, so
`recipe.metadata.pages` is `number | undefined`, not always `number`. Check the
counter before using it:

```typescript
if (recipe.metadata.pages !== undefined) {
  var total: number = recipe.metadata.pages;
}
```

Or use the return value of `read()`, which is typed `ReadMetadata` directly
and always has `pages: number`:

```typescript
var total: number = recipe.read("in.pdf").pages;
```

## 11. Trim Boundary Non-Breaking Spaces From `charSpace` Text

v7 Recipe character-spacing measurements now count leading and trailing
non-breaking spaces (`U+00A0`), matching Wasm. Text using `charSpace` can
measure wider or wrap earlier than it did in v6. If boundary non-breaking
spaces should not contribute to spacing, replace them with regular spaces
before measuring or rendering:

```javascript
var nbsp = String.fromCharCode(160); // U+00A0 non-breaking space
var text = (nbsp + "Indented label" + nbsp).split(nbsp).join(" ");
recipe.text(text, 72, 72, { charSpace: 2 });
```

## 12. Choose Table Columns Explicitly

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
Tables with empty contents or no discovered columns preserve the cursor.

## 13. Pass A Text Size Greater Than Zero

v7 Recipe `text()` and `textDimensions()` require a `size`, or its `fontSize`
alias, greater than zero and throw `RangeError` naming the option and the value
otherwise. In v6, a negative size was clamped to 1pt while drawing and measured
as given, so `textDimensions("Hello", { size: -5 })` reported a width of
2147483645.5, and zero or `NaN` quietly fell back to the 14pt default.

A computed size is the usual source of these values. Guard it, or leave the
option out to keep the 14pt default:

```javascript
var size = scale * base; // may compute 0 or NaN
recipe.text("Hello", 72, 72, size > 0 ? { size: size } : {});
```

`null` and `undefined` still select the default, so an optional property that
is simply absent needs no change.

## 14. Update Native Binary Tooling

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

## 15. Check Low-Level Clipping Options

The `drawPath`, `drawCircle`, `drawSquare`, and `drawRectangle` helpers now
interpret `type: "clip"` as clipping without painting. Previously that spelling
did not apply a clip, while unknown strings incorrectly entered the clip branch.
Replace misspelled or unsupported types with `"clip"` when clipping is intended,
or `"stroke"`/`"fill"` when drawing an outline or filled shape is intended.

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

## 16. Accept Buffers In Custom Streams

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
a `Uint8Array` or `Buffer` is now also accepted and faster.

## What Does Not Change

- Supported Node.js versions.
- The public JavaScript API and package entry points.
- The `node-pre-gyp` install flow for native prebuilds.

## Version 6 Status

The unscoped `muhammara` package is deprecated and receives no further releases.
Existing v6 installations keep working; it is simply a different package from
`@muhammara/native`.

For the full list of compatibility changes, see
[Breaking Changes](../breaking-changes.md).
