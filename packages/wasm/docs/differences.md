# Differences And Restrictions

WebAssembly intentionally excludes Node/V8 facilities. Public APIs do not
accept filesystem paths, Node streams, Node callbacks, `InputFile`, `OutputFile`,
plugin loaders, or synchronous CommonJS loading. Emscripten filesystem support,
where used internally, is not a public storage API.

OpenSSL is excluded, but bundled RC4 and AES-128 support byte-first `recrypt`
and Recipe `encrypt()`. PDF 2.0/AES-256 encryption remains unavailable. Existing
byte-backed PDFs can be read, modified, and copied, but persistent-file
continuation, password-protected Recipe source editing, and the path-based Recipe
constructor are unavailable. Wasm `recryptAsync()` returns a promise like
native's, but recrypts on the calling thread, because Wasm has no thread pool,
so it is as fast and as blocking as `recrypt()`. It does not start a Worker of
its own yet, which is in preparation; call it from a Worker to keep a page
responsive. It also rejects for an
unsupported source or option, where native `recryptAsync()` throws
synchronously for wrong arguments, as every Wasm `*Async` method rejects. See
[Change PDF Passwords](how-to/change-pdf-passwords.md).

`Recipe.thirdPartyLicenses()` is Wasm-only: it reads the third-party notices
embedded in a `.wasm` (see [License Notices](license-notices.md)). The native
packages ship their notices as `THIRD_PARTY_NOTICES.md` and have no such
function.

Recipe bundles Roboto Regular as its default rather than native Recipe's
Helvetica family. Bold and italic fall back to regular unless their byte fonts
are registered, and the different metrics can change wrapping. The low-level
writer does not load the bundled font.

Table header styling follows native precedence and is independent of body
text styles. See [Create Multi-Page Tables](how-to/create-tables.md) for header
overrides; font metrics remain the source of typography differences.

Wasm Recipe does not support native `chroma("!load", path)` color-file loading.
Register named colors individually, including Separation colors.

The Recipe HTML subset is DOM-free and Worker-safe. It supports URL links
through `<a href>` and visual nested lists through `ul`, `ol`, and `li`, but
does not provide arbitrary DOM, general CSS inheritance, semantic tagged-PDF
lists, or plugin HTML handlers. It is also more forgiving than the XML-strict
native parser: an omitted `</li>` ends that item at its next sibling or at the
end of its list rather than throwing. Wasm `htmlToTextObjects()` returns flat
visual runs with list prefixes and `indent` values, while native returns its
nested XML-derived layout tree.

In a flowed `text()`, `highlight`, `underline`, `strikeOut`, and `squiggly`
annotate the run that sets them, as links do on both ends. Native Recipe
currently takes them from the call that ends the flow and spans each over the
whole line ([#909](https://github.com/julianhille/MuhammaraJS/issues/909)).
Its `textBox.textAlign` aligns the whole flow as the call that ends it sets
it, merged over the earlier runs' options. Native Recipe places each run by
that run's own alignment, so runs of one line that set different alignments
overlap or leave a gap.

Appending or rebuilding an existing source page does not deep-copy that page's
`/Annots` graph, although annotations created in the output are written
normally. `split()` returns named byte arrays rather than writing an output
directory, and `structure("json")` returns an in-memory summary rather than
writing a diagnostic file.

Wasm-only `Recipe.dispose()` and `Recipe.disposeAssets()` release Emscripten
allocations that JavaScript garbage collection cannot reclaim. Native objects
use normal native lifetime management. See the [Recipe topic
guides](recipe/index.md) for examples that follow these boundaries.
