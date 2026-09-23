"""
Optional: generate simple placeholder PNGs for item icons.
Requires Pillow. UI works without images (color blocks + codes).

Usage:
  python tools/generate_placeholders.py
"""
from __future__ import annotations

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow not available; skip placeholder generation.")
    raise SystemExit(0)

import os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "resources", "placeholders")
os.makedirs(OUT, exist_ok=True)

COLORS = {
    "coffee": (196, 164, 132),
    "flower": (232, 160, 181),
    "dessert": (232, 192, 122),
    "gift": (184, 160, 216),
}


def make(chain: str, level: int) -> None:
    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    color = COLORS[chain]
    draw.rounded_rectangle((8, 8, size - 8, size - 8), radius=24, fill=color + (255,))
    label = f"{chain[0].upper()}{level}"
    draw.text((48, 56), label, fill=(255, 255, 255, 255))
    path = os.path.join(OUT, f"{chain}_{level:02d}.png")
    img.save(path)
    print("wrote", path)


if __name__ == "__main__":
    for chain in COLORS:
        for level in range(1, 9):
            make(chain, level)
    print("done")
