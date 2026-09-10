# Browser Examples

The executable browser example creates PDFs on the page or in a module Worker.
Build the package, run `npm run wasm:server:browser` from the repository root,
and open <http://127.0.0.1:8080/>.

## Focused Examples

- [Add Review Annotations](how-to/add-review-annotations.md) creates markup,
  comments, and replies.
- [Add Clickable URL Links](how-to/add-url-links.md) adds link regions with
  Recipe coordinates.
- [Set Page Boxes](how-to/set-page-boxes.md) writes and visualizes page boxes.
- [Draw a Grayscale Form XObject](low-level.md) creates a reusable low-level
  form XObject and places it on a page.
- [Add Content to Rotated Pages](how-to/add-content-to-rotated-pages.md) places
  Recipe content and annotations on a rotated page.
- [Place and Transform Images](how-to/place-and-transform-images.md) accepts a
  JPEG, PNG, or TIFF upload.
- [Create Multi-Page Tables](how-to/create-tables.md) accepts a TTF or OTF font
  upload.
- [Change PDF Passwords](how-to/change-pdf-passwords.md) encrypts a PDF and
  creates a decrypted verification copy.

See [Browser Setup](browser-setup.md) for loading the package and [Byte Assets,
Blob, and File Input](byte-assets.md) for browser-safe assets.
