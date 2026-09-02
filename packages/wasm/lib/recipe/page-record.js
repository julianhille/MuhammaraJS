export function pageRecord(pageNumber, mediaBox, rotate = 0) {
  var side1 = Math.abs(mediaBox[2] - mediaBox[0]);
  var side2 = Math.abs(mediaBox[3] - mediaBox[1]);
  var rotated = rotate % 180 !== 0;
  var width = rotated ? side2 : side1;
  var height = rotated ? side1 : side2;
  return {
    pageNumber,
    mediaBox: mediaBox.slice(),
    rotate,
    width,
    height,
    layout: width > height ? "landscape" : "portrait",
    size: [width, height].sort((left, right) => left - right),
    offsetX: mediaBox[0],
    offsetY: mediaBox[1],
  };
}
