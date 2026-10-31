import { normalizeBytesAsync } from "../bytes.js";
import { customSections, licenseSectionName } from "../wasm-sections.js";

var licensesFileName = "@muhammara/wasm/THIRD_PARTY_LICENSES.md";

/**
 * Loads the bytes of a `muhammara-wasm.wasm` given by URL.
 * @param {string|URL} url - Location of the binary, fetched with `fetch()`.
 * @returns {Promise<Uint8Array>} The binary.
 * @throws {TypeError} If the request fails, naming the remedy for a `file:`
 * URL, which Node's `fetch()` cannot load.
 * @throws {Error} If the response is not successful.
 */
async function fetchBinary(url) {
  var response;
  try {
    response = await fetch(url, { credentials: "same-origin" });
  } catch (error) {
    var protocol;
    try {
      protocol = new URL(url).protocol;
    } catch {
      // A relative URL, resolved by fetch() against the page.
    }
    if (protocol !== "file:") throw error;
    // Node cannot fetch file: URLs; an Electron renderer can, so the request
    // may also have failed for a missing or unreadable file.
    throw new TypeError(
      `Recipe.thirdPartyLicenses() could not fetch ${url}; where fetch() cannot load file: URLs, as in Node, read the file and pass its bytes`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Reads byte or Blob/File input.
 * @param {AsyncByteSource} source - The binary.
 * @returns {Promise<Uint8Array>} A copy of the bytes.
 * @throws {TypeError} If `source` is no supported source.
 */
async function readBytes(source) {
  try {
    return await normalizeBytesAsync(source);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new TypeError(
      "Recipe.thirdPartyLicenses() source must be a URL, a Uint8Array or ArrayBuffer, or a Blob or File",
    );
  }
}

/**
 * Returns the third-party license notices embedded in a `muhammara-wasm.wasm`
 * as its `license` custom section. The runtime does not keep the binary it
 * was loaded from, so pass the same binary: a URL, which is fetched, or its
 * bytes or a Blob/File. The section is read from the bytes without compiling
 * them.
 *
 * @name thirdPartyLicenses
 * @function
 * @memberof Recipe
 * @async
 * @param {ThirdPartyLicensesSource} source -
 * The binary whose notices to return.
 * @returns {Promise<string>} The notices, Markdown, identical to
 * `@muhammara/wasm/THIRD_PARTY_LICENSES.md`.
 * @throws {TypeError} If `source` is not a URL, bytes, or a Blob/File, or a
 * `file:` URL cannot be fetched.
 * @throws {Error} If the URL cannot be loaded, the bytes are not a
 * WebAssembly module, or it has no `license` section (for example after
 * `wasm-strip`).
 */
export async function thirdPartyLicenses(source) {
  var bytes =
    typeof source === "string" || source instanceof URL
      ? await fetchBinary(source)
      : await readBytes(source);
  var sections = customSections(bytes, licenseSectionName);
  if (sections.length === 0) {
    throw new Error(
      `The WebAssembly module has no "${licenseSectionName}" section; a tool such as wasm-strip may have removed it. The same notices ship as ${licensesFileName}`,
    );
  }
  return new TextDecoder().decode(sections[0]);
}
