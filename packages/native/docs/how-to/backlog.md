# Requested Workflow Backlog

The documentation team reviewed all 797 issues across MuhammaraJS, HummusJS,
and hummusRecipe. Issues are used only to identify needs; this page contains
original summaries, not copied issue content. A request becomes a guide only
after its workflow has a focused implementation test.

## Ready Or Covered

- Password changes and removal are covered by Change PDF Passwords. AES-256
  compatibility remains unverified and is not documented as supported.
- Page boxes on newly created pages are covered by Set Page Boxes.
- Fonts, text layout, watermarking, image transforms, review annotations, tables,
  text flow, streams, composition, and basic metadata already have guides.

## Needs Tests Or Implementation

- Build a table of contents with bookmarks using catalog-level PDF objects.
- Inspect AcroForm fields and widget coordinates.
- Add catalog-level viewer preferences.
- Determine whether a page is structurally empty.
- Preserve form fields, links, attachments, and annotations while composing PDFs.

## Documented Boundaries

- Additive editing is supported. General secure redaction and arbitrary existing
  content replacement are not documented as supported workflows.
- The reader exposes PDF primitives, but does not provide a tested visual or
  structural blank-page detector.
- PDF composition does not have a tested guarantee to preserve interactive
  content.
