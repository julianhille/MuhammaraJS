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
for your platform (steps 1–6). Steps 7–17 cover API and type changes that
affect only code using those features; the
[Breaking Changes](../breaking-changes.md#version-7x) page lists every change.

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

Check that your platform, architecture, and runtime are listed in the
[prebuilt support matrix](installation.md#prebuilt-support-matrix). Install
`@muhammara/native-with-source` for any combination that is not.

## 6. Rebuild Electron Applications

Electron applications must install the source-capable package before running
`@electron/rebuild`, because the rebuild tool runs `node-gyp` directly and needs
the bundled source tree. See the
[Electron support policy](installation.md#electron-support-policy).

## 7. Replace `Recipe.fillOpacity()`

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

## 9. Update Recipe Options And Types

v7 declares native Recipe options more precisely. A few 6.x declarations were
broader than what the runtime accepts, so TypeScript code written against them
can fail to compile in the following cases. Recipe members that 6.x did not
declare at all, such as `register()`, `table()`, `chroma()`, and `metadata`,
are new declarations and need no migration.

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

### Check Annotation Flags

`annot()` and `comment()` now throw `Error: Unknown annotation flag (<name>)`
for a `flag` that is not a `Recipe.AnnotFlag` value, where 6.x wrote the
annotation without flags. Fix a misspelled name, use a `Recipe.AnnotFlag`
value, or pass a numeric bit mask, which 7.x also accepts.

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

A gray or CMYK color must be a number. A color name or `#rrggbb` string is RGB,
so 7.x throws `only a numeric color can use the gray or cmyk colorspace` where
6.x drew it in RGB; drop `colorspace` for such a color. See
[Draw in Gray and CMYK](../how-to/draw-in-gray-and-cmyk.md).

### Type Vector Options

`rectangle()` `rotationOrigin` is a two-number tuple instead of `number[]`.
Annotate a reusable origin as `[number, number]`:

```typescript
var origin: [number, number] = [100, 100];
recipe.rectangle(50, 50, 100, 40, { rotation: 30, rotationOrigin: origin });
```

`lineTo()` options no longer declare `fill`, which 6.x declared but ignored.
Remove it; fill a closed path with `polygon()` instead.

## 10. Trim Boundary Whitespace From `charSpace` Text

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

## 11. Choose Table Columns Explicitly

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

## 12. Pass A Text Size Greater Than Zero

v7 Recipe `text()` and `textDimensions()` require a `size`, or its `fontSize`
alias, greater than zero and throw `RangeError` naming the option and the value
otherwise. In v6, a negative size was clamped to 1pt while drawing and measured
as given, so `textDimensions("Hello", { size: -5 })` reported a width of
2147483645.5, zero or `NaN` quietly fell back to the 14pt default, and
`Infinity` wrote an invalid `inf` font size into the page. Pass a finite size.

A computed size is the usual source of these values. Guard it, or leave the
option out to keep the 14pt default:

```javascript
var size = scale * base; // may compute 0 or NaN
recipe.text("Hello", 72, 72, size > 0 ? { size: size } : {});
```

`null` and `undefined` still select the default, so an optional property that
is simply absent needs no change.

## 13. Update Native Binary Tooling

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

## 14. Check Low-Level Clipping Options

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

## 15. Accept Buffers In Custom Streams

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

## 16. Move Recipe Annotations To Their Top-Left Corner

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

## 17. Rename Recipe Plugins That Collide With New Methods

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

## What Does Not Change

- The entry points `createWriter()`, `createReader()`, `createWriterToModify()`,
  and `new Recipe()` keep their names. Changes to individual methods and
  options that can affect existing code are listed on the
  [Breaking Changes](../breaking-changes.md#version-7x) page; the steps above
  cover the ones that need a code change.
- Prebuilt binaries still install through `node-pre-gyp`; only their archive
  names change, as described in step 13.

## Version 6 Status

The unscoped `muhammara` package is deprecated and receives no further releases.
Existing v6 installations keep working; it is simply a different package from
`@muhammara/native`.

For the full list of compatibility changes, see
[Breaking Changes](../breaking-changes.md).
