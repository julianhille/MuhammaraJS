# Breaking Changes

## Version 1.x

`@muhammara/wasm` 1.0.0 is the first stable release. The changes below land in
a 1.x release because they fix behavior that differed from native Recipe,
which Wasm follows
([#889](https://github.com/julianhille/MuhammaraJS/issues/889),
[#916](https://github.com/julianhille/MuhammaraJS/issues/916)).

- **`text()` without coordinates flows by default.** A call without
  coordinates starts a flow unless it passes `flow: false`, so the next call
  without coordinates continues its line. `text("a", {})` followed by
  `text("b", {})` drew two lines and now draws `ab` on one line. The flow is
  drawn when a call passes `flow: false`, or when a `text()` call with
  coordinates, `table()`, or `endPage()` follows. To draw a call right away,
  pass `flow: false`:

  ```js
  recipe.text("a", { flow: false }).movedown().text("b", { flow: false });
  ```

- **The text cursor stays on the last line of a text box.** After a text box,
  `movedown(0, true)` reports a position one first-line height above the
  bottom of the box's last line, without padding or vertical alignment,
  instead of the position below the box. When the lines share a height, that
  is the top of the last line. `movedown()` moves to the line right after the
  box, so `text()`, `movedown()`, `text()` no longer leaves a blank line
  between them. Call `movedown(2)` where the blank line is wanted.

- A positive Recipe `rotation` option on `text()` and the shapes
  (`rectangle()`, `circle()`, `polygon()`, `line()`, and the rest) turns
  content clockwise on the page, the same way as native Recipe and Wasm
  `image()`. Before, the same angle turned text and shapes counter-clockwise,
  so rotated content now leans the other way. Text without `rotationOrigin`
  also turns around the `x` and `y` given to `text()`, so a wrapped or aligned
  text box turns as one block instead of each line around its own baseline
  start. This corrects a parity bug in a minor release. To keep the earlier
  direction, negate the angle, for example `rotation: -30` instead of
  `rotation: 30`. Pass `rotationOrigin` to turn text around another point.
  `rotateContent()` is unchanged and still turns counter-clockwise
  [#916](https://github.com/julianhille/MuhammaraJS/issues/916)

### Recipe Information

These land in a 1.x release to fix custom Info entries that were lost or
corrupted on edit, and they bring `info()` and `custom()` in line with native
Recipe [#996](https://github.com/julianhille/MuhammaraJS/issues/996).

- `info()` reports the custom keys of a source PDF in their own spelling instead
  of lower-cased. Read `info().ReportId`, the key as the PDF spells it, instead
  of `info().reportid`.
- `info()` returns its values as text, as they are written to the PDF. A
  `keywords` array set with `info()` reads back as `"a, b"` instead of
  `["a", "b"]`, and a number as a string. Use `split(", ")` where an array is
  needed.
- `info()` and `custom()` throw a `TypeError` for `Trapped`, the
  `source-Creator`, `source-Producer` and `source-ModDate` entries and an empty
  key, which used to write custom entries. Recipe writes these itself; use
  another key. `Trapped` is only carried over from a source PDF.
- `custom()` throws a `TypeError` for a `null` or `undefined` key or value
  instead of writing the text `null` or `undefined`. Pass the text to write.
- `info({ title: "" })`, and `""` for the other standard fields, leaves the
  field as it is instead of clearing it. Pass `[]` to clear a field.
- `info(undefined)` reads the information instead of returning the Recipe.
  Pass `{}` where a call must chain.
