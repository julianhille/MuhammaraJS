# Differences And Restrictions

WebAssembly intentionally excludes Node/V8 facilities. Public APIs do not
accept filesystem paths, Node streams, Node callbacks, `InputFile`, `OutputFile`,
plugin loaders, or synchronous CommonJS loading. Emscripten filesystem support,
where used internally, is not a public storage API.

OpenSSL is excluded, so encrypted writers, decryption, Recipe encryption, and
`recrypt` are unavailable. Existing byte-backed PDFs can be read, modified, and
copied, but persistent-file continuation and the path-based Recipe constructor
are unavailable. See [Change PDF Passwords](how-to/change-pdf-passwords.md) for
the explicit platform boundary and native alternative.

The Recipe HTML subset is DOM-free and Worker-safe. It does not provide
arbitrary DOM, CSS inheritance, links, lists, or plugin HTML handlers. Appending
or rebuilding an existing source page does not deep-copy that page's `/Annots`
graph, although annotations created in the output are written normally.

For the complete, maintained Recipe compatibility table, see
[DIFFERENCES.md](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/DIFFERENCES.md).
