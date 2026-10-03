# Breaking Changes

## Version 1.x

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
