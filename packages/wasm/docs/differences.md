# Differences And Restrictions

Differences fall into three groups: Wasm platform bounds that will not change,
Wasm gaps that could be closed, and native behavior that is itself the defect.
Gaps and native defects are tracked in [#971](https://github.com/julianhille/MuhammaraJS/issues/971).

## Wasm bounds (by design)

WebAssembly intentionally excludes Node/V8 facilities. Public APIs do not
accept filesystem paths, Node streams, Node callbacks, `InputFile`, `OutputFile`,
plugin loaders, or synchronous CommonJS loading. Emscripten filesystem support,
where used internally, is not a public storage API.

Wasm `recryptAsync()` returns a promise like native's. Native recrypts on a
libuv pool thread; Wasm has no thread pool, so it recrypts in a worker it starts
itself: `worker_threads` in Node, Deno, and Bun, and a module `Worker` in
browsers. Inside a worker, where no worker can start, with module options a
worker cannot receive, or with the Wasm-only module option `recryptWorker:
false`, it recrypts on the calling thread, as fast and as blocking as
`recrypt()`. It also rejects for an unsupported source or option, where native
`recryptAsync()` throws synchronously for wrong arguments, as every Wasm
`*Async` method rejects. See
[Change PDF Passwords](how-to/change-pdf-passwords.md).

`Recipe.thirdPartyLicenses()` is Wasm-only: it reads the third-party notices
embedded in a `.wasm` (see [License Notices](license-notices.md)). The native
packages ship their notices as `THIRD_PARTY_NOTICES.md` and have no such
function.

Wasm-only `Recipe.dispose()` and `Recipe.disposeAssets()` release Emscripten
allocations that JavaScript garbage collection cannot reclaim. Native objects
use normal native lifetime management. See the [Recipe topic
guides](recipe/index.md) for examples that follow these boundaries.

`split()` returns named byte arrays rather than writing an output directory, and
`structure("json")` returns an in-memory summary rather than writing a
diagnostic file.

The Recipe HTML subset is DOM-free and Worker-safe. It supports URL links
through `<a href>` and visual nested lists through `ul`, `ol`, and `li`, but
does not provide arbitrary DOM, general CSS inheritance, semantic tagged-PDF
lists, or plugin HTML handlers. Wasm `htmlToTextObjects()` returns flat visual
runs with list prefixes and `indent` values, while native returns its nested
XML-derived layout tree.

## Wasm gaps (tracked)

Existing byte-backed PDFs can be read, modified, and copied, but persistent-file
continuation, password-protected Recipe source editing, and the path-based Recipe
constructor are unavailable.

Appending or rebuilding an existing source page does not deep-copy that page's
`/Annots` graph, although annotations created in the output are written
normally.

Recipe bundles Roboto Regular as its default rather than native Recipe's
Helvetica family. Bold and italic fall back to regular unless their byte fonts
are registered, and the different metrics can change wrapping. The low-level
writer does not load the bundled font.

Table header styling follows native precedence and is independent of body
text styles. See [Create Multi-Page Tables](how-to/create-tables.md) for header
overrides; font metrics remain the source of typography differences.

Wasm Recipe does not support native `chroma("!load", path)` color-file loading.
Register named colors individually, including Separation colors.

The Recipe HTML parser is more forgiving than the XML-strict native parser: an
omitted `</li>` ends that item at its next sibling or at the end of its list
rather than throwing.

Native Recipe HTML sizes `h1`–`h3` and `small` text, which Wasm does not
recognize, and Wasm breaks lines around `div`, which native treats as inline.

## Native defects (tracked)

In a flowed `text()`, `highlight`, `underline`, `strikeOut`, and `squiggly`
annotate the run that sets them, as links do on both ends. Native Recipe
currently takes them from the call that ends the flow and spans each over the
whole line ([#909](https://github.com/julianhille/MuhammaraJS/issues/909)).
Its `textBox.textAlign` aligns the whole flow as the call that ends it sets
it, merged over the earlier runs' options. Native Recipe places each run by
that run's own alignment, so runs of one line that set different alignments
overlap or leave a gap.
