// Normalizes raw captures to the exact size both stores require.
//
// Captures are usually a maximized window (~1918x958, aspect 2.00) while the
// stores want 1280x800 (aspect 1.60). Stretching would distort the UI, and
// cropping to 1.60 would cut ~20% of the width off. So each image is scaled to
// fit and centred on a canvas painted with its own corner colour, which reads
// as intentional matting rather than letterboxing.
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "store/screenshots";
const OUT = join(SRC, "upload");
const W = 1280;
const H = 800;

// Filename -> listing position. The first is what most people judge the
// listing on, so the core loop leads.
const ORDER = [
  ["gloss-homepage.png", "01-core-loop.png"],
  ["gloss-followup.png", "02-follow-up.png"],
  ["gloss-settings.png", "03-providers.png"],
  ["gloss-history.png", "04-history.png"],
  ["gloss-darkmode.png", "05-dark-mode.png"],
];

mkdirSync(OUT, { recursive: true });

const known = new Set(ORDER.map(([from]) => from));
const stray = readdirSync(SRC).filter((f) => /\.png$/i.test(f) && !known.has(f));
if (stray.length) console.log(`not in ORDER, skipped: ${stray.join(", ")}\n`);

for (const [from, to] of ORDER) {
  const src = join(SRC, from);
  if (!existsSync(src)) {
    console.log(`MISSING  ${from}`);
    continue;
  }

  // Sample a corner pixel for the matte so the padding matches the theme.
  const { data } = await sharp(src).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };

  await sharp(src)
    .resize(W, H, { fit: "contain", background, kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, to));

  const meta = await sharp(join(OUT, to)).metadata();
  const rgb = `rgb(${background.r},${background.g},${background.b})`;
  console.log(`${to.padEnd(22)} ${meta.width}x${meta.height}  matte ${rgb}  <- ${from}`);
}

console.log(`\nUpload the files in ${OUT}/`);
