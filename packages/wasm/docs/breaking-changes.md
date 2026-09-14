# Breaking Changes

## Version 1.x

- Recipe `appendPage()` rejects zero, negative, and fractional page selections
  before upper-bound clamping. These values previously clamped to a source page;
  pass positive one-based integers or ascending two-value ranges instead.

For the browser runtime's supported APIs and deliberate differences from the
native packages, see [Compatibility](differences.md).
