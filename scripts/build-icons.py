#!/usr/bin/env python3
"""
Turns the logo into browser icons that actually fill a browser tab.

    pip install pillow
    python3 scripts/build-icons.py                 # auto-trim the whole mark
    python3 scripts/build-icons.py --box 0,0,.45,1 # just the left part of it

WHY THIS EXISTS

A logo drawn for a letterhead does not work as a favicon, for two reasons that
look like one:

  1. PADDING. Artwork is usually centred in a big square canvas with wide
     margins. A browser draws a favicon at 16 or 32 pixels, so those margins are
     not a small waste - if the mark covers 60% of the canvas, it is being drawn
     at 10px inside a 16px box, and it reads as tiny next to icons that go
     edge to edge. This script measures the real ink and crops to it.

  2. DETAIL. Sixteen pixels will not hold a five-petal outline and a two-letter
     wordmark. The icons that look sharp in a tab - Vercel's triangle is the
     obvious one - are a single bold shape and nothing else. Cropping cannot
     invent that, so --box takes a region of the source: point it at the
     symbol on its own and drop the wordmark, which is unreadable at that size
     anyway and only makes the symbol smaller.

WHAT IT WRITES

    app/favicon.ico     16 / 32 / 48, what the tab uses
    app/icon.png        512, what Next links for higher-resolution uses
    app/apple-icon.png  180, the home-screen icon on iOS

and with --tile, the in-app logo as well:

    public/logo.png     the mark on a coloured tile, for the navbar and login

The tab icon and the in-app logo want opposite things, which is why they are
separate outputs from the same source. A tab icon sits on the browser's own
chrome, light or dark depending on the theme, so it has to be transparent. The
in-app logo sits on a white header, where a transparent mark floats and a solid
tile reads as a logo.

All three come from one source, so they cannot drift apart. Next.js picks these
up from app/ by filename convention - there is nothing to wire up.
"""
import argparse
import os
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is needed: pip install pillow")

SOURCE = os.path.join("public", "logo.png")
OUT_DIR = "app"

ALPHA_FLOOR = 24
# How far a colour has to be from the background colour to count as ink. Wide
# enough to survive the gradient in a flat-looking backdrop, narrow enough that
# a dark outline against it still registers.
COLOUR_TOLERANCE = 90


def content_box(image):
    """
    The bounding box of the actual mark.

    Two kinds of source turn up and they need different handling. A transparent
    PNG is easy - the alpha channel already says what is mark and what is not.
    An opaque one has the background baked in, and it is not necessarily white:
    this logo ships on a green field, so trimming "everything near white" would
    trim nothing at all and report the mark as filling the whole canvas.

    So when there is no usable alpha, the background colour is read off the
    corners and anything close to it is treated as backdrop.
    """
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")

    if alpha.getextrema()[0] < 255:
        box = alpha.point(lambda a: 255 if a > ALPHA_FLOOR else 0).getbbox()
        if box:
            return box

    w, h = rgba.size
    corners = [rgba.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    backdrop = tuple(sum(c[i] for c in corners) // len(corners) for i in range(3))

    rgb = rgba.convert("RGB")
    ink = Image.new("L", rgba.size, 0)
    ink.putdata([
        255 if (abs(r - backdrop[0]) + abs(g - backdrop[1]) + abs(b - backdrop[2])) > COLOUR_TOLERANCE
        else 0
        for r, g, b in rgb.getdata()
    ])

    return ink.getbbox() or (0, 0, w, h)


def symbol_only(image):
    """
    The flower on its own, with the "go" taken off.

    Sixteen pixels will not hold the whole lockup - rendered at that size the
    wordmark is a red smudge, and worse, being wide it forces the symbol to be
    drawn smaller so the pair can fit. Dropping it lets the flower fill the
    square, which is the whole reason Vercel's tab icon is the triangle and not
    the word.

    Done in two passes because neither alone is enough. Red ink goes first,
    which takes the glyphs but leaves the white outline that was drawn around
    them. Then the largest remaining island of pixels is kept - that is the
    flower, and the stranded outline fragments are dropped with everything else.
    """
    rgba = image.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    keep = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_FLOOR:
                continue
            if r > 120 and r - g > 60 and r - b > 60:
                continue
            keep[y * w + x] = 1

    # Flood fill rather than a library: one dependency is enough for a script
    # that runs once. A megapixel takes a few seconds, which is fine offline.
    seen = bytearray(w * h)
    best, best_size = [], 0
    for start in range(w * h):
        if not keep[start] or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        island = [start]
        while queue:
            i = queue.popleft()
            x0, y0 = i % w, i // w
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                x1, y1 = x0 + dx, y0 + dy
                if 0 <= x1 < w and 0 <= y1 < h:
                    j = y1 * w + x1
                    if keep[j] and not seen[j]:
                        seen[j] = 1
                        queue.append(j)
                        island.append(j)
        if len(island) > best_size:
            best, best_size = island, len(island)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for i in best:
        x, y = i % w, i // w
        op[x, y] = px[x, y]
    return out


def square(image, margin):
    """Centres the mark on a transparent square, leaving `margin` around it."""
    side = int(max(image.size) * (1 + margin * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        image,
        ((side - image.width) // 2, (side - image.height) // 2),
        image if image.mode == "RGBA" else None,
    )
    return canvas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=SOURCE, help=f"default {SOURCE}")
    parser.add_argument(
        "--box",
        help="region of the SOURCE to use, as fractions left,top,right,bottom "
             "- e.g. 0,0,.45,1 for the left 45%%. Use it to take the symbol on "
             "its own and leave the wordmark out.",
    )
    parser.add_argument(
        "--symbol-only", action="store_true",
        help="keep the flower and drop the wordmark. Recommended - it is what "
             "makes the icon fill a 16px tab instead of sitting in it.",
    )
    parser.add_argument(
        "--tile", metavar="#RRGGBB",
        help="also write public/logo.png as the mark centred on a tile of this "
             "colour, for use inside the app.",
    )
    parser.add_argument(
        "--tile-inset", type=float, default=0.06,
        help="breathing room inside the tile, as a fraction. Default 0.06 - "
             "tighter and the mark touches the corners, looser and it floats.",
    )
    parser.add_argument(
        "--margin", type=float, default=0.04,
        help="breathing room around the mark, as a fraction. Default 0.04 - "
             "small on purpose, since the point is to fill the tab.",
    )
    args = parser.parse_args()

    if not os.path.exists(args.source):
        sys.exit(f"No logo at {args.source}. Save it there first.")

    image = Image.open(args.source).convert("RGBA")
    original = image.size

    if args.box:
        try:
            left, top, right, bottom = (float(v) for v in args.box.split(","))
        except ValueError:
            sys.exit("--box wants four numbers: left,top,right,bottom")
        image = image.crop((
            int(left * image.width), int(top * image.height),
            int(right * image.width), int(bottom * image.height),
        ))

    if args.symbol_only:
        image = symbol_only(image)

    box = content_box(image)
    trimmed = image.crop(box)

    if not trimmed.width or not trimmed.height:
        sys.exit("Nothing left after trimming - is the logo blank?")

    icon = square(trimmed, args.margin)

    # How much of the canvas the mark occupied before, and does now. The first
    # number is the answer to "why does it look so small".
    was = (box[2] - box[0]) * (box[3] - box[1]) / (original[0] * original[1])
    now = (trimmed.width * trimmed.height) / (icon.width * icon.height)
    print(f"source            {original[0]}x{original[1]}")
    print(f"ink found at      {box}")
    print(f"filled the canvas {was:.0%}  ->  {now:.0%}")

    os.makedirs(OUT_DIR, exist_ok=True)

    ico = os.path.join(OUT_DIR, "favicon.ico")
    icon.save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico}")

    png = os.path.join(OUT_DIR, "icon.png")
    icon.resize((512, 512), Image.LANCZOS).save(png, optimize=True)
    print(f"wrote {png}")

    apple = os.path.join(OUT_DIR, "apple-icon.png")
    # iOS draws no transparency, so flatten onto white rather than black.
    flattened = Image.new("RGBA", icon.size, (255, 255, 255, 255))
    flattened.paste(icon, (0, 0), icon)
    flattened.convert("RGB").resize((180, 180), Image.LANCZOS).save(apple, optimize=True)
    print(f"wrote {apple}")

    if args.tile:
        colour = args.tile.lstrip("#")
        if len(colour) != 6:
            sys.exit("--tile wants a colour like #28ac28")
        rgb = tuple(int(colour[i:i + 2], 16) for i in (0, 2, 4))

        side = 320
        tile = Image.new("RGBA", (side, side), (*rgb, 255))
        room = int(side * (1 - args.tile_inset * 2))
        scale = min(room / trimmed.width, room / trimmed.height)
        fitted = trimmed.resize(
            (round(trimmed.width * scale), round(trimmed.height * scale)), Image.LANCZOS
        )
        tile.paste(fitted, ((side - fitted.width) // 2, (side - fitted.height) // 2), fitted)

        logo = os.path.join("public", "logo.png")
        os.makedirs("public", exist_ok=True)
        tile.save(logo, optimize=True)
        print(f"wrote {logo}  (mark fills {fitted.width * fitted.height / side ** 2:.0%} of the tile)")


if __name__ == "__main__":
    main()
