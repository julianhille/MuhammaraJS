/**
 * Creates a tracker that disposes owned child resources together.
 * @returns {{track: Function, untrack: Function, hasChildren: Function, disposeChildren: Function}} The tracker.
 */
export function createChildLifecycle() {
  var children = new Set();
  return {
    /**
     * Registers a child cleanup.
     * @param {function(): void} cleanup - Releases the child.
     * @returns {void}
     */
    track: function (cleanup) {
      children.add(cleanup);
    },
    untrack: function (cleanup) {
      children.delete(cleanup);
    },
    hasChildren: function () {
      return children.size !== 0;
    },
    disposeChildren: function () {
      [...children].forEach((cleanup) => cleanup());
      children.clear();
    },
  };
}
