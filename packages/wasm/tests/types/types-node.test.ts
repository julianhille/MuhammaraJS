import { createMuhammaraWasm, createRecipe } from "../../index.js";

async function usesNodeCompatibleTypes() {
  var muhammara = await createMuhammaraWasm();
  await createRecipe({ defaultFont: Buffer.alloc(0) });
  await createRecipe({ defaultFont: false });
  var writer = muhammara.createWriter();
  var output = new muhammara.PDFWStreamForBuffer();

  output.toBlob("application/pdf").arrayBuffer();
  await muhammara.registerFontAsync("font", new Uint8Array());
  writer.end();
}

void usesNodeCompatibleTypes();
