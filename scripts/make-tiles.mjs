// Renders the two optional Edge Add-ons promotional tiles.
//
// Both are marketing images rather than product screenshots, so they are built
// from markup here and rendered by the Chromium that Playwright already brings
// for the E2E suite — no design tool, no committed source file that drifts from
// the palette. Inter is pulled from Google Fonts at render time; if the network
// is unavailable the type falls back and the script says so rather than
// quietly shipping the wrong face.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "store/assets";
const TILES = [
  { id: "large", width: 1400, height: 560 },
  { id: "small", width: 440, height: 280 },
];

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
:root{--accent:#4f46e5;--highlight:#fbbf24;--ink:#16161a;--muted:#6b6b76;--line:#e4e4e9}
*{box-sizing:border-box;margin:0}
body{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}

.tile{position:relative;overflow:hidden;background:#fbfbfd;display:flex;align-items:center}
/* A soft bloom, so the tile is not a flat white rectangle in a grid of them. */
.tile::before{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 140% at 94% 14%, rgba(79,70,229,.20), transparent 58%),
             radial-gradient(90% 120% at 2% 98%, rgba(251,191,36,.15), transparent 60%)}
.tile>*{position:relative}

.brand{display:flex;align-items:center;gap:var(--gap)}
.brand-name{font-weight:700;letter-spacing:-.02em;color:var(--ink)}
.hero{font-weight:800;letter-spacing:-.035em;line-height:1.02;color:var(--ink)}
.hero em{font-style:normal;color:var(--accent)}
.sub{color:var(--muted);font-weight:450;letter-spacing:-.01em}

/* The mechanic shown rather than described: one word wearing the highlight. */
.mark-hl{background:linear-gradient(transparent 50%, rgba(251,191,36,.9) 50%, rgba(251,191,36,.9) 93%, transparent 93%);
  padding:0 .14em;font-weight:600;color:var(--ink)}

.card{background:#fff;border:1px solid var(--line);
  box-shadow:0 26px 60px -20px rgba(22,22,40,.30), 0 4px 12px rgba(22,22,40,.05)}
.card-bar{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line)}
.dot{width:7px;height:7px;border-radius:99px;background:#dcdce4}

/* Large: the left says what it is, the right shows the arrangement it creates —
   the page you were reading with the panel docked beside it. */
#large{width:1400px;height:560px;padding:0 76px;gap:56px}
#large .left{flex:none;width:600px}
#large .brand{--gap:14px;margin-bottom:28px}
#large .brand-name{font-size:29px}
#large .hero{font-size:80px;margin-bottom:20px}
#large .sub{font-size:24px;line-height:1.45;max-width:15.5em}
#large .stage{flex:1;display:flex;align-items:stretch;height:348px;border-radius:18px}
#large .page{flex:1;padding:24px 24px 24px 26px;font-size:15.5px;line-height:1.9;
  color:#55555f;letter-spacing:-.005em;overflow:hidden;border-right:1px solid var(--line)}
#large .panel{width:248px;flex:none;display:flex;flex-direction:column;background:#fbfbfd;border-radius:0 17px 17px 0}
#large .card-bar{padding:13px 15px}
#large .panel .body{padding:14px 15px;font-size:14.5px;line-height:1.62;color:#33333c}
#large .ask{margin:auto 15px 15px;border:1px solid var(--line);border-radius:11px;background:#fff;
  padding:9px 12px;font-size:13px;color:#9a9aa6}

#small{width:440px;height:280px;padding:0 34px;flex-direction:column;align-items:flex-start;justify-content:center}
#small .brand{--gap:9px;margin-bottom:18px}
#small .brand-name{font-size:19px}
#small .hero{font-size:44px;margin-bottom:16px}
#small .page{font-size:15px;line-height:1.7;color:#55555f;max-width:20em}
</style>

<div class="tile" id="large">
  <div class="left">
    <div class="brand">${mark(42)}<span class="brand-name">Gloss</span></div>
    <div class="hero">Understand <em>anything</em></div>
    <div class="sub">Highlight a word on any page and get it explained in context — without leaving it.</div>
  </div>

  <div class="stage card">
    <div class="page">
      Heat always flows one way. Every irreversible process drives the
      <span class="mark-hl">entropy</span> of the system upward, and none of
      that spent energy gathers itself back. It is why a broken cup never
      reassembles, why a room never tidies itself, and why the arrow of time
      points where it does. Nothing in the equations forbids the reverse; it is
      simply that the orderly arrangements are so vastly outnumbered.
    </div>
    <div class="panel">
      <div class="card-bar">
        ${mark(15, true)}
        <span style="font-weight:600;font-size:12.5px;color:#16161a">Gloss</span>
        <span class="dot" style="margin-left:auto"></span><span class="dot"></span>
      </div>
      <div class="body">Here it means the energy that can no longer do any work — the share that has spread out and cannot be gathered back.</div>
      <div class="ask">Ask a follow-up</div>
    </div>
  </div>
</div>

<div class="tile" id="small">
  <div class="brand">${mark(27)}<span class="brand-name">Gloss</span></div>
  <div class="hero">Understand <em>anything</em></div>
  <div class="page">Highlight a word like <span class="mark-hl">entropy</span> and get it explained where you are.</div>
</div>`;

/** The same mark as the extension icon; `bare` drops the two faint lines. */
function mark(size, bare = false) {
  const faint = bare
    ? ""
    : `<rect x="5.5" y="7" width="10" height="2" rx="1" fill="#fff" opacity=".55"/>
       <rect x="5.5" y="16" width="7.5" height="2" rx="1" fill="#fff" opacity=".55"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">
    <rect x="1" y="1" width="22" height="22" rx="6" fill="#4f46e5"/>${faint}
    <rect x="5.5" y="11" width="13" height="2.5" rx="1.25" fill="#fbbf24"/></svg>`;
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
// Rendered at 2x and downsampled below: supersampling gives cleaner type than
// rendering straight to the target size. The store rejects anything that is not
// EXACTLY the stated pixel dimensions, and a 2x render is silently double — so
// the check at the end reads the written file, not the element's CSS box.
const SCALE = 2;
const page = await browser.newPage({ viewport: { width: 1520, height: 1000 }, deviceScaleFactor: SCALE });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

if (!(await page.evaluate(() => document.fonts.check("800 80px Inter")))) {
  console.warn("WARNING: Inter did not load — tiles will render in a fallback face.\n");
}

for (const { id, width, height } of TILES) {
  const el = page.locator(`#${id}`);
  const box = await el.boundingBox();
  if (Math.round(box.width) !== width || Math.round(box.height) !== height) {
    throw new Error(`#${id} laid out at ${box.width}x${box.height}, expected ${width}x${height}`);
  }

  const file = `${OUT}/promo-${width}x${height}.png`;
  const shot = await el.screenshot();
  await sharp(shot).resize(width, height, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(file);

  // What the store measures is the file, so that is what gets verified.
  const { width: w, height: h } = await sharp(file).metadata();
  if (w !== width || h !== height) throw new Error(`${file} is ${w}x${h}, expected ${width}x${height}`);
  console.log(`${file}  ${w}x${h}`);
}

await browser.close();
console.log("\nBoth tiles are optional in Partner Center; the small one shows beside other extensions.");
