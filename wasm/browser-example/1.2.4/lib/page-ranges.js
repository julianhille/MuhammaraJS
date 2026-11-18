/**
 * Validates the page range options shared by append, merge, and form creation.
 *
 * @param {PageRangeOptions} options - `type` and `specificRanges`.
 * @param {object} constants - Module constants holding the `eRangeType*` values.
 * @returns {PageRange[]} The ranges to pass to native code; empty selects every page.
 * @throws {RangeError} If `type` is not an ERangeType constant, a range is not a
 * pair of non-negative 32-bit integers in order, or `specificRanges` is empty
 * for a specific range.
 */
export function selectedPageRanges(options, constants) {
  var rangeType = options.type ?? constants.eRangeTypeAll;
  if (
    !Number.isInteger(rangeType) ||
    ![constants.eRangeTypeAll, constants.eRangeTypeSpecific].includes(rangeType)
  ) {
    throw new RangeError("A valid page range type is required");
  }
  var ranges = options.specificRanges ?? [];
  if (
    !Array.isArray(ranges) ||
    !ranges.every(
      (range) =>
        Array.isArray(range) &&
        range.length === 2 &&
        range.every(
          (index) =>
            Number.isInteger(index) && index >= 0 && index <= 0xffffffff,
        ) &&
        range[1] >= range[0],
    )
  ) {
    throw new RangeError(
      "specificRanges must contain non-negative inclusive page ranges",
    );
  }
  if (rangeType === constants.eRangeTypeSpecific && ranges.length === 0) {
    throw new RangeError("A specific page range is required");
  }
  return rangeType === constants.eRangeTypeSpecific ? ranges : [];
}
