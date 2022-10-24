var muhammara = require("../muhammara");
const { expect } = require("chai");

describe("SigSegv test", function () {
  it("should read fields correctly", function () {
    expect(() =>
      muhammara.createReader(
        __dirname + "/TestMaterials/BrokenPdfBadHeader.txt"
      )
    ).to.throw();
  });
});
