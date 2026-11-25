"""
Original pixel art for the upstairs bathroom (quest 2).

Run:  python3 scripts/art/bathroom_art.py
Writes the tile sheet to public/assets-active/tilesets/bathroom_16x16.png.
Frame numbers are in src/game/bathroomTiles.ts. Keep the two in the same order.

Each piece is an ASCII grid. One character is one pixel. "." is clear.
Edit a grid and run the script again to change the art.
"""
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets-active/tilesets/bathroom_16x16.png"

PALETTE = {
    "K": (24, 20, 28),
    "w": (252, 252, 252),
    "e": (176, 180, 192),
    "d": (96, 100, 112),
    "b": (112, 70, 30),
    "B": (176, 116, 58),
    "t": (228, 184, 132),
    "T": (196, 168, 112),
    "y": (248, 208, 56),
    "r": (216, 40, 16),
    "R": (248, 132, 140),
    "u": (40, 112, 240),
    "U": (156, 204, 255),
    "g": (72, 96, 40),
    "G": (60, 176, 60),
    "m": (104, 72, 40),
    "o": (240, 128, 40),
}


def grid(art: str) -> Image.Image:
    rows = art.strip("\n").split("\n")
    img = Image.new("RGBA", (max(len(r) for r in rows), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in PALETTE:
                img.putpixel((x, y), PALETTE[ch] + (255,))
    return img


def over(base: Image.Image, art: str) -> Image.Image:
    out = base.copy()
    out.alpha_composite(grid(art))
    return out


def tiles_floor(base, grout, specks=(), seed=0, density=0.0) -> Image.Image:
    """Square bathroom tiles, 8x8 each, with grout lines."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        for x in range(16):
            if x % 8 == 7 or y % 8 == 7:
                img.putpixel((x, y), grout + (255,))
            elif specks and rng.random() < density:
                img.putpixel((x, y), rng.choice(specks) + (255,))
    return img


def brick_wall(base, mortar, light) -> Image.Image:
    """Glazed wall tiles laid like bricks, 4 px high, offset every row."""
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        course = y // 4
        for x in range(16):
            edge = (x + (4 if course % 2 else 0)) % 8 == 7
            if y % 4 == 3 or edge:
                img.putpixel((x, y), mortar + (255,))
            elif y % 4 == 0:
                img.putpixel((x, y), light + (255,))
    return img


def wall_top() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (28, 36, 56, 255))
    for y in range(16):
        for x in range(16):
            if (x + y * 3) % 7 == 0:
                img.putpixel((x, y), (44, 56, 82, 255))
    return img


def wall_face() -> Image.Image:
    img = brick_wall((56, 116, 156), (24, 44, 68), (112, 172, 208))
    for x in range(16):  # baseboard
        img.putpixel((x, 14), (200, 200, 208, 255))
        img.putpixel((x, 15), (88, 92, 104, 255))
    return img


STAIRS = """
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KKKKKKKKKKKKKKKK
KKeeeeeeeeeeeeKK
KKddddddddddddKK
KKKKKKKKKKKKKKKK
KKKeeeeeeeeeeKKK
KKKddddddddddKKK
KKKKKKKKKKKKKKKK
KKKKeeeeeeeeKKKK
KKKKddddddddKKKK
KKKKKKKKKKKKKKKK
KKKKKeeeeeeKKKKK
KKKKKddddddKKKKK
KKKKKKKKKKKKKKKK
"""

BATHMAT = """
................
................
..w.w.w.w.w.w...
.uuuuuuuuuuuuu..
.uUUUUUUUUUUUu..
.uUuuuuuuuuuUu..
.uUuUUUUUUUuUu..
.uUuUUUUUUUuUu..
.uUuuuuuuuuuUu..
.uUUUUUUUUUUUu..
.uuuuuuuuuuuuu..
..w.w.w.w.w.w...
................
................
................
................
"""

PUDDLE = """
................
................
................
.....UUUU.......
...UUUUUUUU.....
..UUUwUUUUUUU...
..UUUUUUUUUUUU..
...UUUUUUUUUU...
.....UUUUUUU....
.......UUU......
..........U.....
.........UUU....
..........U.....
................
................
................
"""

DRAIN = """
................
................
................
................
.....KKKKKK.....
....KeeeeeeK....
...KeKdKdKdeK...
...KedKdKdKeK...
...KeKdKdKdeK...
...KedKdKdKeK...
....KeeeeeeK....
.....KKKKKK.....
................
................
................
................
"""

TOILET = """
................
...KKKKKKKKKK...
...KwwwwwwwwK...
...KweeeeeewK...
...KKKKKKKKKK...
....KwwwwwwK....
...KwwwwwwwwK...
..KwwKKKKKKwwK..
..KwK{0}{0}{0}{0}{0}{0}KwK..
..KwK{0}{0}{1}{0}{0}{0}KwK..
..KwK{0}{0}{0}{0}{1}{0}KwK..
..KwwK{0}{0}{0}{0}KwwK..
...KwwKKKKwwK...
....KwwwwwwK....
.....KKKKKK.....
................
"""

SINK = """
................
KKKKKKKKKKKKKKKK
KwwwwwwddwwwwwwK
KwwwwwwKKwwwwwwK
KwwwKKKKKKKKwwwK
KwwKUUUUUUUUKwwK
KwwKUUUUUuUUKwwK
KwwwKKKKKKKKwwwK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
KbBBBBBbbBBBBBbK
KbBBBBBbbBBBBBbK
KbBByBBbbBByBBbK
KbBBBBBbbBBBBBbK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
"""

COUNTER = """
................
KKKKKKKKKKKKKKKK
KwwwwwwwwwwwwwwK
KwwwwwwwwwwwRRwK
KwwwwwwwwwwwRRwK
KwwwwwwwwwwwwwwK
KwwwwwwwwwwwwwwK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
KbBBBBBBBBBBBBbK
KbBBBBBBBBBBBBbK
KbBBBBByyBBBBBbK
KbBBBBBBBBBBBBbK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
"""

LINEN = """
KKKKKKKKKKKKKKKK
KbbbbbbbbbbbbbbK
KbRRRRbUUUUbyyyK
KbRwwRbUwwUbyyyK
KbRRRRbUUUUbyyyK
KbbbbbbbbbbbbbbK
KbwwwwbGGGGbRRRK
KbweewbGwwGbRwRK
KbwwwwbGGGGbRRRK
KbbbbbbbbbbbbbbK
KbyyyyyyybwwwwwK
KbywwwwwybweeewK
KbyyyyyyybwwwwwK
KbbbbbbbbbbbbbbK
KBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKK
"""

TUB = """
................................
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK
KwwKKKKKKKKKKKKKKKKKKKKKKKKKKwwK
KwKUUUUUUUUUUUUUUUUUUUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUUUUUUUUuUUUKwK
KwKUUUUwUUUUUUUUUUUUUUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUUyUUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUyyyUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUUyUUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUUUUUUUUUUUUKwK
KwKUUUUUUUUUUUUUUUUUUUUUUUUdUKwK
KwwKKKKKKKKKKKKKKKKKKKKKKKKKKwwK
KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK
.KeeeeeeeeeeeeeeeeeeeeeeeeeeeeK.
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
"""

OLD_TUB = """
................................
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
KTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTK
KTTKKKKKKKKKKKKKKKKKKKKKKKKKKTTK
KTKgggggggggggggggggggggggggKTK.
KTKggGggggggggggggggggGgggggKTK.
KTKgggggggggmggggggggggggggggKTK
KTKggggggggggggggggggggggmgggKTK
KTKgggGgggggggggggggggggggggKTK.
KTKgggggggggggggGgggggggggggKTK.
KTTKKKKKKKKKKKKKKKKKKKKKKKKKKTTK
KTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTK
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
..KyK......................KyK..
..KK........................KK..
................................
"""

PIPE = """
................
................
................
................
KKKKKKKKKKKKKKKK
eeeeeeeeeeeeeeee
wwwwwwwwwwwwwwww
eeeeeeeeeeeeeeee
dddddddddddddddd
KKKKKKKKKKKKKKKK
......KdK.......
......KUK.......
.......U........
................
.......U........
................
"""

HAMPER = """
................
................
.....w....R.....
...KKwKKKKRKK...
..KwwwwRRRRRRK..
..KBBBBBBBBBBK..
..KbBbBbBbBbBK..
..KBbBbBbBbBbK..
..KbBbBbBbBbBK..
..KBbBbBbBbBbK..
..KbBbBbBbBbBK..
..KBbBbBbBbBbK..
..KbBbBbBbBbBK..
...KKKKKKKKKK...
................
................
"""


def split(img: Image.Image) -> list[Image.Image]:
    return [img.crop((0, 0, 16, 16)), img.crop((16, 0, 32, 16))]


def build() -> Image.Image:
    floor = tiles_floor((232, 232, 224), (172, 176, 188))
    grimy = tiles_floor((196, 188, 150), (128, 118, 90),
                        ((120, 140, 70), (150, 136, 100), (100, 96, 70)), 5, 0.12)
    clear = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    toilet_clogged = grid(TOILET.replace("{0}", "m").replace("{1}", "g"))
    toilet_clean = grid(TOILET.replace("{0}", "U").replace("{1}", "w"))
    tub_l, tub_r = split(grid(TUB))
    old_l, old_r = split(grid(OLD_TUB))

    frames = [
        floor,               # 0
        grimy,               # 1
        wall_face(),         # 2
        wall_top(),          # 3
        grid(STAIRS),        # 4
        over(clear, BATHMAT),  # 5
        over(clear, PUDDLE),   # 6
        over(clear, DRAIN),    # 7
        toilet_clogged,      # 8
        toilet_clean,        # 9
        grid(SINK),          # 10
        grid(COUNTER),       # 11
        grid(LINEN),         # 12
        tub_l, tub_r,        # 13, 14
        old_l, old_r,        # 15, 16
        over(wall_face(), PIPE),  # 17
        grid(HAMPER),        # 18
    ]
    sheet = Image.new("RGBA", (16 * len(frames), 16), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (16 * i, 0))
    return sheet


def main() -> None:
    build().save(OUT)
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
