import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { log } from "node:console";
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
assert.equal(manifest.name, "PRZEPŁYW");
assert.equal(manifest.display, "standalone");
for (const key of ["id", "scope", "start_url"])
  assert.equal(manifest[key], "/przeplyw/");
const html = readFileSync("dist/index.html", "utf8");
assert.ok(html.includes("/przeplyw/manifest.webmanifest"));
assert.ok(html.includes("/przeplyw/assets/"));
const sw = readFileSync("dist/sw.js", "utf8");
assert.ok(sw.includes("/przeplyw/index.html"));
assert.ok(sw.includes("SKIP_WAITING"));
assert.ok(!sw.includes("self.skipWaiting(),")); // activation is message-driven, not automatic
for (const size of [192, 512]) {
  const file = `icon-${size}.png`;
  const bytes = readFileSync(`dist/${file}`);
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
  assert.ok(
    manifest.icons.some(
      (icon) => icon.src === file && icon.sizes === `${size}x${size}`,
    ),
  );
  assert.ok(sw.includes(`url:"${file}"`));
}
for (const asset of readdirSync("dist/assets")) {
  if (!/\.(css|js)$/.test(asset)) continue;
  assert.ok(sw.includes(`url:"assets/${asset}"`), `Missing precache: ${asset}`);
  if (asset.endsWith(".css"))
    assert.ok(
      !/https?:\/\//.test(readFileSync(`dist/assets/${asset}`, "utf8")),
      "External runtime stylesheet/font",
    );
}
assert.ok(sw.includes('url:"index.html"'));
log(
  "PWA build checks passed: manifest, scope, base, PNG sizes, precache assets and local fonts. Browser install/offline QA remains pending.",
);
