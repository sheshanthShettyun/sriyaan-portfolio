import { writeFile } from "node:fs/promises";
import { render } from "takumi-pdf";
import { googleFonts } from "@takumi-rs/helpers";

import { OopNotes } from "../src/components/pdf/oop-notes";

async function main() {
  const fonts = await googleFonts([
    { name: "Inter", weight: [400, 600, 700] },
    { name: "JetBrains Mono", weight: [400, 700] },
  ]);

  const pdf = await render(<OopNotes />, {
    size: "a4",
    margin: { top: 64, bottom: 64, left: 60, right: 60 },
    fonts,
    fontFamilies: ["Inter", "JetBrains Mono", "sans-serif"],
    metadata: {
      title: "Java OOP Notes",
      authors: ["Sriyaan"],
      creationDate: "2026-08-15",
    },
  });

  const out = "oop-notes.pdf";
  await writeFile(out, pdf);
  console.log(`Wrote ${out} (${pdf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
