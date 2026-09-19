# Breaking Changes

## Version 1.x

### Recipe tables (unreleased)

These changes affect upgrades from the earlier 1.0 prereleases
([#666](https://github.com/julianhille/MuhammaraJS/issues/666)):

- Automatic columns include fields from every record, so tables may gain
  columns. Set `order` or `columns` explicitly to keep a fixed field list.
- Header text styles are independent of body styles, matching native. Existing
  headers may change font, size, or color; explicitly set those properties in
  table-level `header` or a column's `header` object to retain the intended
  appearance. Table-level header options take precedence over column header
  options, and body-column styles no longer override them.
- Cells and headers default to native's 2pt padding, and fixed cell/header
  heights count toward row sizing. Tables can become taller or continue
  earlier. Set column `cell.padding` and `header.cell.padding` to `0` to retain
  unpadded layouts, and adjust fixed heights or continuation areas as needed.
- An `overflow` continuation that cannot fit the pending row plus its repeated
  header now throws `RangeError` before either is drawn. Return `true` to stop,
  or provide an area large enough within the table height and page bottom
  margin. Move the segment upward, choose a taller page/table area, or split an
  oversized record into multiple rows; rows are not split automatically.
- `overflow` callbacks receive the Recipe as `this`, matching native. Code
  using `this` to access the table options must capture those options in a
  closure instead; the callback's first argument remains the Recipe.

See [Create Multi-Page Tables](how-to/create-tables.md) for column styling,
renderer-controlled sizing, and continuation behavior.
