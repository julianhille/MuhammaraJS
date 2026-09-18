/** Creates a tracker that disposes owned child resources together. */
export function createChildLifecycle() {
  var children = new Set();
  return {
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
