/**
 * Sync version from package.json to website JS and AboutDialog.
 * Run as part of dev:hmr or manually: bun scripts/sync-version.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const version: string = pkg.version;
const prefixed = `v${version}`;

// 1) website/js/main.js — update APP_VERSION constant
const webPath = "website/js/main.js";
const webSrc = readFileSync(webPath, "utf-8");
const updated = webSrc.replace(
  /const APP_VERSION = "v[^"]*";/,
  `const APP_VERSION = "${prefixed}";`,
);
writeFileSync(webPath, updated);
console.log(`[sync-version] ${webPath} → ${prefixed}`);

// 2) src/mainview/components/about/AboutDialog.tsx — update "Version x.x.x"
const aboutPath = "src/mainview/components/about/AboutDialog.tsx";
const aboutSrc = readFileSync(aboutPath, "utf-8");
const aboutUpdated = aboutSrc.replace(
  />Version [\d.]+</,
  `>Version ${version}<`,
);
writeFileSync(aboutPath, aboutUpdated);
console.log(`[sync-version] ${aboutPath} → ${version}`);
