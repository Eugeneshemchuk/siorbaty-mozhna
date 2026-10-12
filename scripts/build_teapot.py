#!/usr/bin/env python3
"""Ink-brush teapot -> brand mark.
  assets/illustrations/teapot-ink.png : alpha mask (colour comes from CSS)
  assets/favicon-32.png, assets/apple-touch-icon.png : ink on a cream disc, readable on light and dark tabs
Needs Pillow."""
from PIL import Image, ImageDraw, ImageOps

src = ImageOps.grayscale(Image.open("Content/Illustrations/teapot-ink.jpg"))
alpha = src.point(lambda v: 0 if v > 200 else min(255, (200 - v) * 2))
alpha = alpha.crop(alpha.getbbox())
mark = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
mark.putalpha(alpha)
mark.save("assets/illustrations/teapot-ink.png", optimize=True)
print("mask", mark.size)

for size, name in [(32, "favicon-32.png"), (180, "apple-touch-icon.png")]:
    big = size * 4
    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(icon).ellipse((0, 0, big - 1, big - 1), fill=(244, 239, 228, 255))
    ink = Image.new("RGBA", alpha.size, (30, 28, 26, 255))
    ink.putalpha(alpha)
    k = big * .72 / max(ink.size)                      # scale up or down to fill ~72% of the disc
    ink = ink.resize((round(ink.width * k), round(ink.height * k)), Image.LANCZOS)
    icon.alpha_composite(ink, ((big - ink.width) // 2, (big - ink.height) // 2 + big // 40))
    icon.resize((size, size), Image.LANCZOS).save(f"assets/{name}")
    print(name)
