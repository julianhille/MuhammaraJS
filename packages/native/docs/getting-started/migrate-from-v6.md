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

## 9. Update Recipe Types

v7 replaces several broad native Recipe declarations with types that describe
the values accepted by the runtime. JavaScript behavior is unchanged, but
existing TypeScript can fail to compile in the following cases.

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

Named-function registration still requires a function with a runtime `name` and
is represented by `Recipe.NamedExtensionCallback`. Use the two-argument
overload when the callback is anonymous.

### Type Layouts And Tables

`Recipe.layout()` and `Recipe.table()` no longer accept arbitrary `object`
options. Use `LayoutOptions<Row>` and `TableOptions<Row>`. A table column name
must be a string key of `Row`; its renderer receives the value type for that
specific key, the complete row, the column-name literal, and a one-based row
number:

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
row type, `row.nth` values other than `"even"` or `"odd"`, and overflow return
values other than a boolean or `{ position: [x, y] }`. These values were
previously accepted by the broad declaration but are not supported table
instructions.

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

`Recipe.arrow()` and `Recipe.triangle()` now use `ArrowOptions` and
`TriangleOptions`. Replace broad string or number variables with their finite
runtime values:

```typescript
var arrow: muhammara.Recipe.ArrowOptions = {
  type: "dart", // 0, 1, 2, "triangle", "dart", or "kite"
  at: "head", // "head" or "tail"
};
var triangle: muhammara.Recipe.TriangleOptions = {
  traitID: "sas", // "sss", "sas", "asa", or "vtx"
  position: "centroid",
};

recipe.arrow(100, 100, arrow);
recipe.triangle(200, 100, [50, 60, 70], triangle);
```

Triangle positions are `"a"`, `"b"`, `"c"`, `"centroid"`, `"circumcenter"`,
or `"incenter"`. Trait identifiers and positions are case-insensitive.

The more precise `Recipe.read()` metadata and `Recipe.htmlToTextObjects()`
result types, reusable `Color` and permission types, and newly declared option
fields are additive and require no migration.

## What Does Not Change

- The low-level API and native Recipe runtime behavior.
- Supported Node.js versions.
- Native binary metadata and the `node-pre-gyp` install flow.

## Version 6 Status

The unscoped `muhammara` package is deprecated and receives no further releases.
Existing v6 installations keep working; it is simply a different package from
`@muhammara/native`.

For the full list of compatibility changes, see
[Breaking Changes](../breaking-changes.md).
