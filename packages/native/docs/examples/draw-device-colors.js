var muhammara = require("@muhammara/native");

// Low level: a gray or CMYK color is a number. Gray is one byte, from 0x00
// (black) to 0xff (white); CMYK packs four bytes as 0xCCMMYYKK. A color name
// or #rrggbb string is always RGB, so it cannot use the gray or CMYK colorspace.
function drawDeviceColors(outputPath) {
  var writer = muhammara.createWriter(outputPath);
  var page = writer.createPage(0, 0, 595, 842);

  writer
    .startPageContentContext(page)
    .drawRectangle(72, 700, 100, 50, {
      type: "fill",
      colorspace: muhammara.DeviceColorSpace.GRAY,
      color: 0x80,
    })
    .drawRectangle(200, 700, 100, 50, {
      type: "fill",
      colorspace: muhammara.DeviceColorSpace.CMYK,
      color: 0x00ff0000,
    })
    .drawRectangle(328, 700, 100, 50, { type: "fill", color: "teal" });

  writer.writePage(page);
  writer.end();
}

// Recipe: the length of a hex color, or of a color array, picks the color
// space: two digits or one number are gray, eight digits or four numbers CMYK.
function drawRecipeDeviceColors(outputPath) {
  new muhammara.Recipe("new", outputPath)
    .createPage(595, 842)
    .rectangle(72, 72, 100, 50, { fill: "#80" })
    .rectangle(200, 72, 100, 50, { fill: "#00ff0000" })
    .rectangle(328, 72, 100, 50, { fill: [0, 0, 0, 255] })
    .endPage()
    .endPDF();
}

module.exports = { drawDeviceColors, drawRecipeDeviceColors };
