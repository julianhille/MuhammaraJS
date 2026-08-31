# Contributing Documentation

Native documentation changes use Markdown under `packages/native/docs/` and
pass a strict combined MkDocs build.

## Local Preview

The Python dependencies in the repository `docs/requirements.txt` are needed
only when you want to preview or edit documentation. They are not required to
install, build, or use MuhammaraJS.

To edit documentation, create and activate a Python virtual environment,
install `docs/requirements.txt`, then run:

```bash
npm run docs:serve
```

Open <http://127.0.0.1:8000/>. Run `npm run docs:check` before opening a pull
request.

`npm run docs:build` and `npm run docs:check` write the generated site to the
repository-root `site/` directory. It is generated output and is ignored by
Git.

## Examples

Copyable native examples belong in `packages/native/docs/examples/`. A matching
test under `packages/native/tests/docs/` must execute each example in a temporary
directory and verify its output. Do not document behavior based only on an
untested snippet.

## Test References

When a page cites an implementation test, use a full GitHub link in this form:

```text
https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native/tests/path/to/test.js
```

This works from repository Markdown and Read the Docs. It is the convention for
the `latest` documentation, which tracks `develop`. Before a release tag is
published, replace `develop` in its documentation test links with that release
tag so its versioned site points to the matching source.

## Writing Rules

- Clearly label Recipe as the high-level API and native writer/reader APIs as
  low-level.
- Document current behavior, limitations, and supported Node.js versions.
- Use the package name `@muhammara/native` in new JavaScript examples. Mention
  `muhammara` only when documenting compatibility or migration.
- Link to, but do not copy, issue and discussion content without explicit
  permission and attribution review.
