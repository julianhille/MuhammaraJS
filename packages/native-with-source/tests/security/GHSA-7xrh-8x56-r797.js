var assert = require("assert");
var fs = require("fs");
var muhammara = require("@muhammara/native-with-source");

function buildCryptPDF() {
  var payload = Buffer.from([0]);
  var header = "%PDF-1.4\n";
  var objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n",
  ];
  var streamHeader = `4 0 obj\n<< /Filter /Crypt /DecodeParms << >> /Length ${payload.length} >>\nstream\n`;
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

describe("GHSA-7xrh-8x56-r797", function () {
  it("does not crash for a Crypt stream without a Name parameter", function () {
    var target = __dirname + "/../output/ghsa-7xrh-8x56-r797.pdf";
    fs.writeFileSync(target, buildCryptPDF());

    var reader;
    try {
      reader = muhammara.createReader(target);
      var stream = reader.parseNewObject(4);
      assert.doesNotThrow(function () {
        reader.startReadingFromStream(stream);
      });
    } finally {
      if (reader) reader.end();
      fs.unlinkSync(target);
    }
  });
});
