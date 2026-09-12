# Differences And Restrictions

WebAssembly intentionally excludes Node/V8 facilities. Public APIs do not
accept filesystem paths, Node streams, Node callbacks, `InputFile`, `OutputFile`,
plugin loaders, or synchronous CommonJS loading. Emscripten filesystem support,
where used internally, is not a public storage API.

OpenSSL is excluded, but bundled RC4 and AES-128 support byte-first `recrypt`
and Recipe `encrypt()`. PDF 2.0/AES-256 encryption remains unavailable. Existing
byte-backed PDFs can be read, modified, and copied, but persistent-file
continuation, password-protected Recipe source editing, and the path-based Recipe
constructor are unavailable. See [Change PDF Passwords](how-to/change-pdf-passwords.md).

Recipe bundles Roboto Regular as its default rather than native Recipe's
Helvetica family. Bold and italic fall back to regular unless their byte fonts
are registered, and the different metrics can change wrapping. The low-level
writer does not load the bundled font.

Wasm Recipe does not support native `chroma("!load", path)` color-file loading
or Recipe-created Separation colors. Register named colors individually; use
the byte-safe low-level resource API for Separation colors.

The Recipe HTML subset is DOM-free and Worker-safe. It supports URL links
through `<a href>` and visual nested lists through `ul`, `ol`, and `li`, but
does not provide arbitrary DOM, general CSS inheritance, semantic tagged-PDF
lists, or plugin HTML handlers. It is also more forgiving than the XML-strict
native parser: an omitted `</li>` ends that item at its next sibling or at the
end of its list rather than throwing. Its ellipsis mode writes three ASCII periods
(`...`) rather than the Unicode ellipsis used by native Recipe.

On new pages, a text run's `opacity` option is scoped to that text in the PDF
graphics state, but also becomes the default opacity for subsequent Recipe
vector drawing. Call `opacity(1)` before later vectors when they should be fully
opaque. The text option is ignored while editing an existing page.

Appending or rebuilding an existing source page does not deep-copy that page's
`/Annots` graph, although annotations created in the output are written
normally. `split()` returns named byte arrays rather than writing an output
directory, and `structure("json")` returns an in-memory summary rather than
writing a diagnostic file.

Wasm-only `Recipe.dispose()` and `Recipe.disposeAssets()` release Emscripten
allocations that JavaScript garbage collection cannot reclaim. Native objects
use normal native lifetime management. See the [Recipe topic
guides](recipe/index.md) for examples that follow these boundaries and the
[package compatibility table](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/DIFFERENCES.md)
for the complete maintained list.
