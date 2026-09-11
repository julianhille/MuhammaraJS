# Contributing Documentation

WebAssembly documentation changes use Markdown under `packages/wasm/docs/` and
pass a strict package-local MkDocs build.

## Local Preview

The Python dependencies in `packages/wasm/docs/requirements.txt` are needed
only when you want to preview or edit documentation. They are not required to
install, build, or use `@muhammara/wasm`.

To edit documentation, create and activate a Python virtual environment,
install `packages/wasm/docs/requirements.txt`, then run:

```sh
python -m venv .docs-venv
source .docs-venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r packages/wasm/docs/requirements.txt
npm run docs:check --workspace=@muhammara/wasm
mkdocs serve --config-file packages/wasm/mkdocs.yml
```

Open <http://127.0.0.1:8000/>. Run `npm run docs:check --workspace=@muhammara/wasm`
before opening a pull request. The command generates `docs/reference.md` and
writes the generated site to `packages/wasm/site/`; both are generated output
and ignored by Git.

## Examples

Copyable browser examples belong in `packages/wasm/examples/browser/`. Add a
focused test under `packages/wasm/tests/integration/` and register a browser
workflow in `examples/browser/how-tos.mjs` when it is a common browser task.
Do not document behavior based only on an untested snippet.

## Self-Contained Examples

Keep pages self-contained. Include the code required to explain a workflow
rather than linking readers to implementation tests or source files. Small
duplication is preferable to documentation that depends on a particular source
revision.

## Writing Rules

- Clearly label Recipe as the high-level API and writer, reader, and modifier
  APIs as low-level.
- Document byte-first behavior, browser and Worker support, and platform
  restrictions.
- Use the package name `@muhammara/wasm` in new JavaScript examples.
- Link to, but do not copy, issue and discussion content without explicit
  permission and attribution review.
