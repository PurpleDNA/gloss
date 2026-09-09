// Regenerates the published privacy page from PRIVACY.md, so the hosted copy
// can never drift from the one in the repo. GitHub Pages renders the Markdown.
import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync("PRIVACY.md", "utf8");
const front = ["---", "layout: default", "title: Privacy Policy", "---", "", ""].join("\n");

writeFileSync("docs/privacy.md", front + body);
console.log("docs/privacy.md  <-  PRIVACY.md");
