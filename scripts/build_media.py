#!/usr/bin/env python3
"""Compress Content/Photo/* into assets/img/pNN.webp (max 1600px, EXIF-rotated),
write assets/img/media.json and a numbered contact sheet for picking photos.
Needs Pillow. Usage: python3 scripts/build_media.py [contact_sheet.jpg]"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

SRC, OUT, MAX, THUMB, COLS = Path("Content/Photo"), Path("assets/img"), 1600, 300, 6


def main(sheet_path):
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".heic"})
    media, thumbs = [], []
    for n, src in enumerate(files, 1):
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((MAX, MAX))
        dst = OUT / f"p{n:02d}.webp"
        im.save(dst, "WEBP", quality=78, method=6)
        media.append({"id": f"p{n:02d}", "src": dst.as_posix(), "w": im.width, "h": im.height,
                      "source": src.name, "kb": dst.stat().st_size // 1024})
        t = im.copy()
        t.thumbnail((THUMB, THUMB))
        thumbs.append(t)
    (OUT / "media.json").write_text(json.dumps(media, ensure_ascii=False, indent=1), encoding="utf-8")

    rows = -(-len(thumbs) // COLS)
    sheet = Image.new("RGB", (COLS * THUMB, rows * THUMB), "white")
    draw = ImageDraw.Draw(sheet)
    for i, t in enumerate(thumbs):
        x, y = (i % COLS) * THUMB, (i // COLS) * THUMB
        sheet.paste(t, (x + (THUMB - t.width) // 2, y + (THUMB - t.height) // 2))
        draw.rectangle((x, y, x + 46, y + 26), fill="black")
        draw.text((x + 6, y + 6), f"p{i + 1:02d}", fill="white", font_size=18)
    sheet.save(sheet_path, quality=80)
    total = sum(m["kb"] for m in media)
    print(f"{len(media)} photos -> {OUT}, {total} KB total; contact sheet: {sheet_path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "contact_sheet.jpg")
