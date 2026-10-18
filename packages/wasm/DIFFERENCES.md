# WebAssembly Differences

## Low-level API

Native low-level drawing helpers preserve legacy numeric coercions, while
Wasm requires numeric values and throws for numeric strings. Both reject
non-finite drawing values. Wasm `writeText()` additionally requires a positive
size and a font owned by the same writer. Wasm `J()`, `j()` and `Tr()` reject
operands outside the PDF ranges (0 to 2, 0 to 2, and 0 to 7); native writes
any value. These existing validation differences are retained for compatibility.
`createWriter` encrypts with native's `userPassword`, `ownerPassword`, and
`userProtectionFlag` options. Wasm throws a `TypeError` for a password that is
not a string, where native ignores it, and throws for native's `log` file
option and for encryption options on `createWriterToModify`; encrypt modified
bytes with `recrypt`.
`createReader` and a Recipe source open encrypted PDFs with native's `password`
option; Wasm throws a `TypeError` for one that is not a string. Source PDFs
for `appendPDFPagesFromPDF`, `mergePDFPagesToPage`,
`createFormXObjectsFromPDF`, `createPDFCopyingContext`, and PDF images in
`drawImage` cannot be encrypted:
a source `password` throws a `TypeError`. Decrypt the source with
`recrypt(bytes, { password })` first.
Wasm `recryptAsync()` returns a promise like native's. Native recrypts on a
libuv pool thread; Wasm has no thread pool, so it recrypts in a worker it starts
itself: `worker_threads` in Node, Deno, and Bun, and a module `Worker` in
browsers. Inside a worker, where no worker can start, with module options a worker
cannot receive, or with the Wasm-only module option `recryptWorker: false`, it
recrypts on the calling thread, as fast and as blocking as `recrypt()`. It also
rejects for an unsupported source or option, where native `recryptAsync()`
throws synchronously for wrong arguments, as every Wasm `*Async` method rejects.
Drawing helpers and `writeText` accept only `rgb`, `gray`, or `cmyk` as
`colorspace` and throw a `TypeError` otherwise, and only a numeric `color` can
use `gray` or `cmyk`, as in native. Wasm also accepts an `[r, g, b]` array as a
low-level RGB `color`, which native does not.
String writers and `PDFWStreamForBuffer.write()` accept an array of byte
values on both ends; Wasm throws a `TypeError` for an item that is not an
integer from 0 to 255, where native coerces it to a byte.
Wasm glyph text requires every glyph list item to be exactly one
`[glyphId, unicodeCodePoint]` pair of non-negative integers; native also
accepts a bare `[glyphId]` or several code points per glyph and coerces the
values.

Native `writer.getEvents()` exposes `OnPageWrite` and `OnCatalogWrite`
EventEmitter hooks that can change dictionaries while they are written. Wasm
has none, since that would need C++-to-JavaScript callbacks with live
dictionary handles. Recipe does not depend on them: Wasm writes catalog
entries and copies the annotations of appended pages in its C++ layer.

## Recipe

Native and Wasm run one Recipe implementation, `packages/shared`: the same
input gives the same PDF, return values and errors on both ends. What differs
is only how each end takes and hands over its input and output.

| Area                     | Native                                                                                                                                                 | WebAssembly                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Constructor              | `new Recipe("new" \| path \| Buffer, outputPath?, options)`                                                                                            | `new Recipe(options)` or `new Recipe(bytes, options)`, from the async `createRecipe()` factory                                                               |
| Finished PDF             | `endPDF()` writes the output path; returns the Buffer, the output path, or nothing for a path source; `endPDF(callback)` returns the callback's result | `endPDF()` returns an owned `Uint8Array`, also from `endPDF(callback)`                                                                                       |
| Fonts, images, PDFs      | file paths, the bundled font folder, `fontSrcPath`                                                                                                     | registered bytes: `Recipe.registerFont/Image/Pdf` (and `*Async` for Blob/File), `unregister*`, `disposeAssets()`; a path throws and `fontSrcPath` is ignored |
| Default font             | bundled Helvetica Neue LT with bold and italic faces, plus Arial, Courier New, Georgia, Roboto                                                         | bundled Roboto Regular, or the `defaultFont` given to `createRecipe()`; `defaultFont: false` registers none                                                  |
| Files read by path       | `chroma("!load", path)`, `attach(name, path)`, `pdfa.iccProfile` path                                                                                  | bytes only; a path throws a `TypeError` naming what reads it                                                                                                 |
| `split()`, `structure()` | `split(outputDir, prefix)` writes files; `structure(path)` writes a text file                                                                          | `split(prefix)` returns `[{name, bytes}]`; `structure(format)` returns text or JSON; static `Recipe.splitPdf(name)`                                          |
| Reading other PDFs       | `read(path \| Buffer)`                                                                                                                                 | `read(bytes)`, `readAsync(Blob)`, static `Recipe.inspectPdf(name)`                                                                                           |
| Lifecycle                | normal native lifetime                                                                                                                                 | `recipe.dispose()` and `Recipe.disposeAssets()` free the Emscripten heap                                                                                     |
| Only on one end          | `Recipe.Source`                                                                                                                                        | `Recipe.thirdPartyLicenses()`, `Recipe.StructureFormat`, static `Recipe.permission()`                                                                        |

### Kept for compatibility

Where the two Recipes behaved differently before they became one, each end
keeps its own behavior until a major release unifies it. Each platform turns
it on with a flag or an override in `native-core/lib/Recipe.js` or
`wasm/lib/recipe.js`.

| Behavior                                  | Native                                                                             | WebAssembly                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `text()` without an active page           | draws nothing and returns the Recipe                                               | throws `Error: A page is required for coordinates`                                                      |
| Drawing without an active page            | `TypeError: No page is active; …`                                                  | `Error: A page is required for coordinates`                                                             |
| A `font` that is not registered           | draws in Helvetica                                                                 | throws `Unknown font: <name>`                                                                           |
| A missing bold or italic face             | Helvetica's face of that style                                                     | the family's regular face                                                                               |
| `split()`                                 | splits the source PDF                                                              | finishes the Recipe and splits what it produced                                                         |
| `htmlToTextObjects()`                     | the nested layout tree                                                             | flat styled runs                                                                                        |
| `pageInfo()`                              | `{ width, height, rotate, pageNumber }`; unknown page throws                       | the page record with media box, layout, size and offsets; unknown page is `null`                        |
| `image()` with `index`                    | ignored                                                                            | throws a `TypeError` pointing to `page`                                                                 |
| `endPDF(callback)` returns                | the callback's result                                                              | the PDF bytes                                                                                           |
| `editPage()` on a new PDF                 | `…constructed from an existing PDF`                                                | `…constructed from PDF bytes`                                                                           |
| `editPage()` of a missing page            | `TypeError: context not created, …`                                                | `RangeError: pageNumber must identify an existing page`                                                 |
| `metadata` of a new PDF                   | `{ pageCount }`, counting the pages created                                        | `undefined`                                                                                             |
| Writer log                                | writes `muhammara-error.log`, as before                                            | none                                                                                                    |
| `Recipe.prototype.Column`, `Line`, `Word` | present                                                                            | absent                                                                                                  |
| `image()` of an unknown source            | `Unknown image: expected an image path, …`                                         | `Unknown image: expected a registered name, …`                                                          |
| `register()` errors                       | throws strings: `Cannot register unnamed…`, `Found conflict in Recipe prototypes…` | `TypeError: Register requires a named callback function`, `Error: Recipe method already exists: <name>` |

bidi-js, which the `direction` option reorders right-to-left text with, is a
dependency of the native packages and bundled into the Wasm build. Wasm still
accepts its former `bidi` option, which is ignored, and `loadBidi()`, which
resolves at once.

`Recipe.thirdPartyLicenses()` reads the notices embedded in
`muhammara-wasm.wasm`, which bundlers copy without the package's other files.
The native packages keep theirs in `THIRD_PARTY_NOTICES.md` next to the
`.node` binary.

## Lifecycle

Wasm-only `writer.dispose()`, `PDFByteReader.dispose()`, `Recipe.dispose()`, and
`Recipe.disposeAssets()` release Emscripten heap allocations that JavaScript
garbage collection cannot reclaim. Native objects use normal native lifetime
management, so they have no corresponding methods. Disposing a PDF byte reader
does not end its parent PDF reader.

Stateful low-level writer methods reject use after cleanup on both ends with
`Error("PDF writer has ended")`. Native `end()` is idempotent and returns the
writer; Wasm `end()` returns bytes once and rejects subsequent calls. Use Wasm
`dispose()` for idempotent cleanup. Native `shutdown()` retires the writer and
requires `createWriterToContinue()` to resume; filesystem continuation is not
available in Wasm.
