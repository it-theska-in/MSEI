"""Build the Chrome Web Store upload zip.

    python build.py

Writes dist/mse-inspection-autofill-<version>.zip. The store build only matches the
live portal (https://inspection-os.msei.in). The localhost and file:// entries in the
dev manifest exist only for the offline mock site.
"""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).parent
FILES = ["xlsx.js", "fill.js", "content.js", "popup.html", "popup.js",
         "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png"]
PORTAL = ["https://inspection-os.msei.in/*"]

manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
manifest["host_permissions"] = PORTAL
for cs in manifest["content_scripts"]:
    cs["matches"] = PORTAL

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
out = dist / f"mse-inspection-autofill-{manifest['version']}.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2))
    for f in FILES:
        z.write(ROOT / f, f)  # forward-slash entry names, as the store expects
print(out)
