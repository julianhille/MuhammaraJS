import muhammara = require("@muhammara/native");

declare const writer: muhammara.PDFWriter;

writer.end();

// @ts-expect-error Native declarations must not add a global namespace.
var leaked: Muhammara.PDFWriter;

void leaked;
