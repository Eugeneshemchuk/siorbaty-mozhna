#!/usr/bin/env python3
"""Turn the purchased leaf artwork into single-colour alpha masks (colour comes from CSS, like the Flower of Life).
  Content/Illustrations/leaf-sprigs-pngtree-purchased.jpg -> assets/illustrations/sprig-1..6.png (green strokes only,
      so the grey preview watermark drops out)
  Content/Illustrations/leaf-pattern-purchased.jpg        -> assets/illustrations/leaf-pattern.png (seamless tile)
Needs Pillow."""
from PIL import Image, ImageChops, ImageFilter

OUT = "assets/illustrations"


def to_mask(alpha):
    """Black RGB + given alpha, cropped to content."""
    box = alpha.getbbox()
    alpha = alpha.crop(box)
    im = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    im.putalpha(alpha)
    return im


def sprigs():
    im = Image.open("Content/Illustrations/leaf-sprigs-pngtree-purchased.jpg").convert("RGB")
    r, g, b = im.split()
    # greenness: how much G exceeds the mean of R and B. Grey watermark/background ~0, green strokes high.
    green = ImageChops.subtract(g, ImageChops.add(r, b, scale=2))
    alpha = green.point(lambda v: 0 if v < 6 else min(255, (v - 6) * 16)).filter(ImageFilter.GaussianBlur(0.35))
    # hand-picked boxes around each sprig in the 640x856 sheet (an even grid clips neighbours)
    cells = [(10, 40, 315, 262), (380, 60, 630, 185), (40, 300, 315, 505),
             (380, 225, 590, 545), (60, 590, 290, 812), (360, 568, 600, 800)]
    for n, c in enumerate(cells, 1):
        m = to_mask(alpha.crop(c))
        m.save(f"{OUT}/sprig-{n}.png", optimize=True)
        print(f"sprig-{n}.png", m.size)


def pattern():
    im = Image.open("Content/Illustrations/leaf-pattern-purchased.jpg").convert("L")
    alpha = im.point(lambda v: 0 if v > 235 else min(255, (235 - v) * 2))
    m = Image.new("RGBA", im.size, (0, 0, 0, 0))
    m.putalpha(alpha)                       # keep full tile size so it stays seamless
    m.save(f"{OUT}/leaf-pattern.png", optimize=True)
    print("leaf-pattern.png", m.size)


if __name__ == "__main__":
    sprigs()
    pattern()
