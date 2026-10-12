"""Build assets/icons/*.svg and assets/icons.zip from assets/icons.json (single source of truth).
Run from the repo root: python3 scripts/build_icons.py"""
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
icons = json.loads((root / "assets/icons.json").read_text(encoding="utf-8"))
out = root / "assets/icons"
out.mkdir(exist_ok=True)
tpl = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
       'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">{}</svg>\n')
with zipfile.ZipFile(root / "assets/icons.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for ic in icons:
        f = out / f"{ic['id']}.svg"
        f.write_text(tpl.format(ic["body"]), encoding="utf-8")
        z.write(f, f"tea-icons/{f.name}")
    z.writestr("tea-icons/LICENSE.txt", "Free to use in personal and commercial work. No attribution required.\n")
print(f"{len(icons)} icons written")
