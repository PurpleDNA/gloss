// Edge runs on the Windows side and loads unpacked extensions unreliably from
// \\wsl.localhost UNC paths, so mirror dist/ onto the Windows filesystem.
// Override the destination with GLOSS_WIN_DIR.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** C:\Users\Someone -> /mnt/c/Users/Someone */
function windowsHome() {
  try {
    const profile = execFileSync("cmd.exe", ["/c", "echo %USERPROFILE%"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const [, drive, rest] = profile.match(/^([A-Za-z]):\\(.*)$/) ?? [];
    return drive ? `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}` : null;
  } catch {
    return null;
  }
}

/** Optional gitignored override, so a personal path never enters the repo. */
function localOverride() {
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("GLOSS_WIN_DIR="));
  return line?.slice("GLOSS_WIN_DIR=".length).trim() || undefined;
}

const home = windowsHome();
const dest =
  process.env.GLOSS_WIN_DIR ?? localOverride() ?? (home ? join(home, "gloss-extension") : null);

if (!dest) {
  console.error("Could not locate a Windows home directory.");
  console.error("Set GLOSS_WIN_DIR to where the built extension should be copied.");
  process.exit(1);
}

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
