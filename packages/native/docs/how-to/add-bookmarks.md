# Add PDF Bookmarks

`bookmark(title, pageNumber, options)` adds an entry to the outline a viewer
shows beside the pages. Nest bookmarks through `options.children`.

```javascript
var Recipe = require("@muhammara/native").Recipe;

new Recipe("new", "bookmarks.pdf")
  .createPage("letter")
  .text("Introduction", 72, 72)
  .endPage()
  .createPage("letter")
  .text("Details", 72, 72)
  .endPage()
  .bookmark("Introduction", 1)
  .bookmark("Details", 2, {
    open: true,
    children: [
      { title: "Positioned", pageNumber: 2, x: 72, y: 144, zoom: 1.5 },
    ],
  })
  .endPDF();
```

Each bookmark opens a page. Without `x`, `y` and `zoom` the page opens fitted to
the window; with them it opens at that point, measured from the top-left corner
of the page as Recipe draws, with `zoom` 1 for 100%. Give `x` and `y` together.
On a rotated page the point is measured from the top-left corner of the page as it appears on screen, from the origin of its MediaBox.

Known limits: on a page created in the same Recipe and rotated by 270 degrees
with a width different from its height, the point lands in the wrong place (save the
PDF and bookmark it in a second Recipe), and text and shapes drawn on a rotated
page with a non-zero MediaBox origin do not follow that origin, so they can
sit offset from a bookmark placed at the same coordinates.

Page numbers are one-based and count the finished document: the pages left
after `deletePage()`, with the pages of `insertPage()` and `appendPage()` where
they land. `editPage()`, `deletePage()` and `insertPage()` count the source, so
after `deletePage(2)` the old page 3 is page 2 for `bookmark()`. A bookmark may
target a page created after the call, and `endPDF()` throws a `RangeError` for a
page the finished document does not have, before it writes an outline; the
output is then complete, without outline. `insertPage()` drops the outline of a
source PDF, as it rebuilds the document, and the bookmarks are then its only
outline.
Titles are any Unicode text and are written as PDF text strings.

Each of `x`, `y` and `zoom` is limited to 2147483647, and a title cannot
contain NUL, U+FFFE or U+FFFF or have more than 16382 UTF-16 code units (the PDF limit of
32767 bytes for a string, written as UTF-16BE). A character outside the Basic
Multilingual Plane, such as an emoji, counts as 2 units.

A bookmark starts closed; `open: true` shows its children when the viewer opens
the outline. Nesting is limited to 64 levels.

A source PDF that already has an outline keeps it: the new bookmarks follow its
last top-level bookmark, and the existing ones are untouched. The old outline
is never walked, so the new root `/Count` is only as exact as the old one (an
all-closed old outline may have none). `endPDF()` throws
an `Error` for an outline it cannot append to: a `/Outlines` entry that is no
indirect dictionary, or an outline whose root has a `/First` but no `/Last`.

The outline is not styled, and `bookmark()` does not change the page mode: a
viewer shows the outline when the user opens it. To read an outline back, see
[Read PDF Bookmarks](read-bookmarks.md).
