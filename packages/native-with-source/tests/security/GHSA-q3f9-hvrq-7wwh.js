var assert = require("assert");
var fs = require("fs");
var muhammara = require("@muhammara/native-with-source");

/**
 * Builds an unencrypted one-page PDF whose content stream carries a Crypt
 * filter with an empty DecodeParms dictionary.
 *
 * @param {string} filter - The stream's /Filter value.
 * @param {string} decodeParms - The stream's /DecodeParms value.
 * @returns {Buffer} The PDF bytes.
 */
function buildCryptPDF(filter, decodeParms) {
  var payload = Buffer.from([0]);
  var header = "%PDF-1.4\n";
  var objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
  ];
  var streamHeader = `4 0 obj\n<< /Filter ${filter} /DecodeParms ${decodeParms} /Length ${payload.length} >>\nstream\n`;
  var streamTail = "\nendstream\nendobj\n";
  var offsets = [];
  var position = header.length;

  objects.forEach(function (object) {
    offsets.push(position);
    position += object.length;
  });
  offsets.push(position);

  var xrefPosition =
    position + streamHeader.length + payload.length + streamTail.length;
  var formatOffset = function (offset) {
    return String(offset).padStart(10, "0");
  };
  var xref =
    "xref\n0 5\n0000000000 65535 f \n" +
    `${formatOffset(offsets[0])} 00000 n \n` +
    `${formatOffset(offsets[1])} 00000 n \n` +
    `${formatOffset(offsets[2])} 00000 n \n` +
    `${formatOffset(offsets[3])} 00000 n \n`;
  var trailer = `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  return Buffer.concat([
    Buffer.from(header),
    ...objects.map(function (object) {
      return Buffer.from(object);
    }),
    Buffer.from(streamHeader),
    payload,
    Buffer.from(streamTail),
    Buffer.from(xref),
    Buffer.from(trailer),
  ]);
}

describe("GHSA-q3f9-hvrq-7wwh", function () {
  [
    ["a single Crypt filter", "/Crypt", "<< >>"],
    ["a Crypt filter array", "[/Crypt]", "[<< >>]"],
  ].forEach(function ([name, filter, decodeParms]) {
    it(`does not crash on an encrypted PDF with ${name} without a Name parameter`, function () {
      var source = __dirname + "/../output/ghsa-q3f9-hvrq-7wwh-source.pdf";
      var target = __dirname + "/../output/ghsa-q3f9-hvrq-7wwh.pdf";
      fs.writeFileSync(source, buildCryptPDF(filter, decodeParms));
      muhammara.recrypt(source, target, {
        userPassword: "",
        ownerPassword: "owner",
        userProtectionFlag: 4,
      });

      var reader;
      try {
        reader = muhammara.createReader(target);
        assert.ok(reader.isEncrypted());
        var stream = reader.parseNewObject(4);
        assert.equal(reader.getPagesCount(), 1);
        assert.ok(reader.startReadingFromStream(stream));
      } finally {
        if (reader) reader.end();
        fs.unlinkSync(source);
        fs.unlinkSync(target);
      }
    });
  });
});
