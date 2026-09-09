// Edge runs on the Windows side and loads unpacked extensions unreliably from
// \\wsl.localhost UNC paths, so mirror dist/ onto the Windows filesystem.
// Override the destination with GLOSS_WIN_DIR.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const dest = process.env.GLOSS_WIN_DIR ?? "/mnt/c/Users/HP/Desktop/purple/gloss";

if (!existsSync("dist")) {
  console.error("No dist/ — run `npm run build` first.");
  process.exit(1);
}

if (existsSync(dest)) {
  // Only ever clear a directory we recognise as our own output.
  const entries = readdirSync(dest);
  const manifest = join(dest, "manifest.json");
  const ours =
    entries.length === 0 ||
    (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "Gloss");

  if (!ours) {
    console.error(`Refusing to overwrite ${dest} — it does not look like a Gloss build.`);
    console.error("Set GLOSS_WIN_DIR to a different path.");
    process.exit(1);
  }
  rmSync(dest, { recursive: true, force: true });
}

cpSync("dist", dest, { recursive: true });

const windowsPath = dest.replace(/^\/mnt\/([a-z])\//, (_m, d) => `${d.toUpperCase()}:\\`).replaceAll("/", "\\");
console.log(`Synced to ${dest}`);
console.log(`\nLoad unpacked from:\n  ${windowsPath}\n`);
