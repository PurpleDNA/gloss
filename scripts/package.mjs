// Produces the zip uploaded to the Edge Add-ons dashboard.
// The archive is written here rather than shelled out to `zip`, so packaging
// works on any machine with Node and produces byte-identical output.
import { deflateRawSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

if (!existsSync("dist/manifest.json")) {
  console.error("No build found — run `npm run build` first.");
  process.exit(1);
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Source maps leak the original tree and bloat the upload.
for (const map of walk("dist").filter((f) => f.endsWith(".map"))) {
  rmSync(map);
  console.log(`removed ${map}`);
}

const files = walk("dist")
  .map((path) => ({
    // Zip entries always use forward slashes, and must sit at the archive root:
    // a wrapper folder is rejected on upload.
    name: relative("dist", path).split(sep).join("/"),
    data: readFileSync(path),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Fixed timestamp keeps the output reproducible across builds.
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

const locals = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(file.name, "utf8");
  const compressed = deflateRawSync(file.data, { level: 9 });
  const crc = crc32(file.data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(file.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, compressed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6); // version needed
  entry.writeUInt16LE(0, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(DOS_TIME, 12);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(file.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(0o644 << 16, 38); // external attrs
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += local.length + name.length + compressed.length;
}

const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
mkdirSync("store", { recursive: true });
const out = `store/gloss-${manifest.version}.zip`;
writeFileSync(out, Buffer.concat([...locals, directory, end]));

console.log(`\n${out}  (${(statSync(out).size / 1024).toFixed(0)} KB)`);
console.log(`version ${manifest.version} · ${files.length} files`);
