var muhammara = require('../muhammara');
const chai = require('chai');

describe('BasicModificationWithStreams', function() {
	it('should complete without error', function() {
		var inStream = new muhammara.PDFRStreamForFile(__dirname + '/TestMaterials/MultipleChange.pdf');
		var outStream = new muhammara.PDFWStreamForFile(__dirname + '/output/BasicModificationWithStreams.pdf');
		var pdfWriter = muhammara.createWriterToModify(inStream,outStream);
		var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);

		pageModifier.startContext().getContext().writeText('Some added Text', 75, 805, {
			font: pdfWriter.getFontForFile(__dirname + '/TestMaterials/fonts/Couri.ttf'),
			size:14,
			colorspace:'gray',
			color:0x00
		});
		pageModifier.endContext().writePage();
		pdfWriter.end();
		outStream.close();
		inStream.close();
	});

	it('null for stream should throw an error and not crash', function () {
		var res = new muhammara.PDFStreamForResponse(null)
		chai.expect(
			muhammara.createWriter.bind(undefined, res)
		).to.throw(/Cannot read propert.*(write)?.* of null/)
	})
});
