"""
Original pixel art for the utility basement (TileRoomScene) and the hardware
store (HardwareStoreScene).

Run:  python3 scripts/art/utility_store_art.py
Writes public/assets-active/tilesets/utility_16x16.png and store_16x16.png.
Frame numbers are in src/game/utilityTiles.ts and src/game/storeTiles.ts.
Keep each list in the same order as its TS file.

Each piece is an ASCII grid. One character is one pixel. "." is clear.
Multi-tile pieces are drawn as one grid and cut into 16x16 frames,
left to right, then top to bottom.
"""
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TILESETS = ROOT / "public/assets-active/tilesets"

PALETTE = {
    "K": (24, 20, 28),
    "w": (252, 252, 252),
    "e": (176, 180, 192),
    "d": (96, 100, 112),
    "D": (56, 60, 72),
    "b": (96, 56, 24),
    "B": (160, 100, 48),
    "t": (216, 168, 112),
    "c": (236, 220, 176),
    "y": (248, 208, 56),
    "r": (184, 32, 24),
    "R": (232, 96, 80),
    "u": (40, 88, 200),
    "U": (140, 196, 252),
    "g": (24, 112, 48),
    "G": (72, 176, 72),
    "p": (120, 56, 128),
    "o": (232, 112, 24),
    "O": (252, 168, 72),
    "s": (140, 140, 148),
}


def grid(art: str) -> Image.Image:
    rows = art.strip("\n").split("\n")
    width = 16 * max(1, round(max(len(r) for r in rows) / 16))
    height = 16 * max(1, round(len(rows) / 16))
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for y, row in enumerate(rows[:height]):
        for x, ch in enumerate(row[:width]):
            if ch in PALETTE:
                img.putpixel((x, y), PALETTE[ch] + (255,))
    return img


def cut(img: Image.Image) -> list[Image.Image]:
    return [img.crop((x, y, x + 16, y + 16))
            for y in range(0, img.height, 16) for x in range(0, img.width, 16)]


def on(base: Image.Image, art: str) -> Image.Image:
    out = base.copy()
    out.alpha_composite(grid(art))
    return out


def speckle(base, specks, seed, density) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        for x in range(16):
            if rng.random() < density:
                img.putpixel((x, y), rng.choice(specks) + (255,))
    return img


def wall_top(base=(36, 34, 40), fleck=(54, 52, 60)) -> Image.Image:
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        for x in range(16):
            if (x + y * 5) % 9 == 0:
                img.putpixel((x, y), fleck + (255,))
    return img


def blocks(base, mortar, light, h=8, w=16, stripe=None) -> Image.Image:
    """Cinder blocks or bricks: courses `h` high, joints every `w`, offset by half."""
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        course = y // h
        for x in range(16):
            if y % h == h - 1 or (x + (w // 2 if course % 2 else 0)) % w == w - 1:
                img.putpixel((x, y), mortar + (255,))
            elif y % h == 0:
                img.putpixel((x, y), light + (255,))
    if stripe:
        for x in range(16):
            for y in (10, 11, 12):
                img.putpixel((x, y), stripe + (255,))
    return img


# ── Utility basement ─────────────────────────────────────────────────────────

STAIRS_UP = """
KKKKKeeeeeeKKKKK
KKKKKddddddKKKKK
KKKKKKKKKKKKKKKK
KKKKeeeeeeeeKKKK
KKKKddddddddKKKK
KKKKKKKKKKKKKKKK
KKKeeeeeeeeeeKKK
KKKddddddddddKKK
KKKKKKKKKKKKKKKK
KKeeeeeeeeeeeeKK
KKddddddddddddKK
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KKKKKKKKKKKKKKKK
................
"""

WORKBENCH = """
................................................
...KKKK...........KKK..........KK...............
..KrrrrK.........KyyyK........KdK...............
.KrrrrrrK.......KBBBBBK.......KdK.....KKKKK.....
.KBBBBBBK.......KBKKKBK......KdddK...KeeeeeK....
.KBBKKBBK.......KBBBBBK.......KdK....KeKKKeK....
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KttttttttttttttttttttttttttttttttttttttttttttttK
KBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
.KbK..KeeeK.........................KeeK....KbK.
.KbK..KdddK.........................KddK....KbK.
.KbK..KKKKK.................................KbK.
.KbK........................................KbK.
.KKK........................................KKK.
................................................
"""

METAL_SHELF = """
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KsKBBBBBBBBKsKrrrrrrrrrrrKsKBBBBBBBKsKBBBBBBBKsK
KsKBtttttBBKsKrRRRRRRRRRrKsKBttttBBKsKBttBttBKsK
KsKBtKKKtBBKsKrrrrrrrrrrrKsKBBBBBBBKsKBBBBBBBKsK
KsKKKKKKKKKKsKKKKKKKKKKKKKsKKKKKKKKKsKKKKKKKKKsK
KssssssssssssssssssssssssssssssssssssssssssssssK
KsKuuuuuuuKsKBBBBBBBBBBKsKggggggggggKsKBBBBBBBKsK
KsKuUUUUUuKsKBttttttBBBKsKgGGGGGGGGgKsKBttttBBKsK
KsKuuuuuuuKsKBBBBBBBBBBKsKggggggggggKsKBBBBBBBKsK
KsKKKKKKKKKsKKKKKKKKKKKKsKKKKKKKKKKKKsKKKKKKKKKsK
KssssssssssssssssssssssssssssssssssssssssssssssK
KsKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKsK
KsK..........................................KsK
KsK..........................................KsK
KKK..........................................KKK
................................................
"""

CRT_TV = """
................................
................................
....KKKKKKKKKKKKKKKKKKKKKKKK....
...KDDDDDDDDDDDDDDDDDDDDDDDDK...
...KDKKKKKKKKKKKKKKKKKKKKKKDK...
...KDKddddddddddddddddddddKDK...
...KDKdeddddddddddddddddddKDK...
...KDKdeddddddddddddddddddKDK...
...KDKddddddddddddddddddddKDK...
...KDKddddddddddddddddddddKDK...
...KDKddddddddddddddddddddKDK...
...KDKddddddddddddddddddddKDK...
...KDKddddddddddddddddddddKDK...
...KDKKKKKKKKKKKKKKKKKKKKKKDK...
...KDDDDDDDDDDDDDDDDDDDKrKgDK...
...KDDDDDDDDDDDDDDDDDDDDDDDDK...
....KKKKKKKKKKKKKKKKKKKKKKKK....
.....KBBBBBBBBBBBBBBBBBBBBK.....
.....KbbbbbbbbbbbbbbbbbbbbK.....
.....KBKKKKKKKKKKKKKKKKKKBK.....
.....KBKddddddddddddddddKBK.....
.....KBKddddddddddddddddKBK.....
.....KBKKKKKKKKKKKKKKKKKKBK.....
.....KBBBBBBBBBBBBBBBBBBBBK.....
.....KbbbbbbbbbbbbbbbbbbbbK.....
.....KKKKKKKKKKKKKKKKKKKKKK.....
......KbK..............KbK......
......KKK..............KKK......
................................
................................
................................
................................
"""

MINI_FRIDGE = """
................................
................................
.....KKKKKKKKKKKKKKKKKKKKKK.....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KweeeeeeeeeeeeeeeeeeeewK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KwwwwwwwwwwwwwwwwwwKKwwK....
....KwwwwwwwwwwwwwwwwwKddKwK....
....KwwwwwwwwwwwwwwwwKdKKdKK....
....KwwwwwwwwwwwwwwwwKdKKdKK....
....KwwwwwwwwwwwwwwwKyyyyyyK....
....KwwwwwwwwwwwwwwwKyyKKyyK....
....KwwwwwwwwwwwwwwwKyyKKyyK....
....KwwwwwwwwwwwwwwwKyyyyyyK....
....KwwwwwwwwwwwwwwwwKKKKKKK....
....KwwwRRRRRRRRwwwwwwwwwwwK....
....KwwwRwwwwwwRwwwwwwwwwwwK....
....KwwwRwwwwwwRwwwwwwwwwwwK....
....KwwwRRRRRRRRwwwwwwwwwwwK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KeeeeeeeeeeeeeeeeeeeeeeK....
....KwwwwwwwwwwwwwwwwwwwwwwK....
....KeeeeeeeeeeeeeeeeeeeeeeK....
....KKKKKKKKKKKKKKKKKKKKKKKK....
.....KdK..............KdK.......
.....KKK..............KKK.......
................................
................................
................................
"""

DADS_BOX = """
................................
................................
.....y..........................
....KyK...KKKKKKKKKKKKKKKKKKK...
...KyyyK..KtttttttttttttttttK...
...KKyKK.KtttttttttttttttttKK...
....KyK.KKKKKKKKKKKKKKKKKKKKtK..
...KKKKKKtttttttttttttttttttKtK.
...KBBBBKtKKtKtKKtKKKtKKKttKtK.
...KBttBKtttttttttttttttttttKtK.
...KBBBBKtttttttttttttttttttKtK.
...KBttBKtttttttttttttttttttKK..
...KBBBBKttttttttttttttttttttK..
...KKKKKKKKKKKKKKKKKKKKKKKKKKK..
................................
................................
"""

WATER_HEATER = """
......KKKK......
......KddK......
...KKKKKKKKKK...
..KeeeeeeeeeeK..
..KeKKKKKKKKeK..
..KeeeeeeeeeeK..
.KeeeeeeeeeeeeK.
.KewwweeeeeeeeK.
.KewweeeeeeeeeK.
.KeweeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeKKKKeeeK.
.KeeeeKyyyyKeeK.
.KeeeeKyrryKeeK.
.KeeeeKyyyyKeeK.
.KeeeeeKKKKeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeeeeeeeeeK.
.KeeeeKKKKeeeeK.
.KeeeKooooKeeeK.
.KeeeKoOOoKeeeK.
.KeeeeKKKKeeeeK.
.KeeeeeeeeeeeeK.
.KddddddddddddK.
..KKKKKKKKKKKK..
...KdK....KdK...
................
"""

WEIGHT_BENCH = """
................................
..KKK......................KKK..
.KDDDK.....................KDDDK
.KDDDK.KKKKKKKKKKKKKKKKKKK.KDDDK
.KDDDKKeeeeeeeeeeeeeeeeeeeKKDDDK
.KDDDK.KKKKKKKKKKKKKKKKKKK.KDDDK
.KDDDK....KdK.......KdK....KDDDK
..KKK..KKKKKKKKKKKKKKKKKKK..KKK.
.......KrrrrrrrrrrrrrrrrrK......
.......KrRRRRuuuuuuRRRRRrK......
.......KrrrrrUUUUUUrrrrrrK......
.......KKKKKKKKKKKKKKKKKKK......
........KdK...........KdK.......
........KdK...........KdK.......
........KKK...........KKK.......
................................
"""

OLD_CARPET = None  # made in code
FLOOR_DRAIN = """
................
................
................
................
.....KKKKKK.....
....KdddddK.....
...KdKdKdKdK....
...KdKdKdKdK....
...KdKdKdKdK....
....KdddddK.....
.....KKKKKK.....
................
................
................
................
................
"""


def utility_sheet() -> Image.Image:
    concrete = speckle((150, 148, 140), ((132, 130, 124), (168, 166, 158), (120, 118, 112)), 11, 0.22)
    carpet = speckle((112, 96, 64), ((96, 82, 54), (128, 112, 76), (88, 104, 72)), 12, 0.3)
    for x in range(16):
        for y in range(16):
            if (x + y) % 6 == 0:
                carpet.putpixel((x, y), (100, 86, 58, 255))
    face = blocks((128, 128, 124), (80, 80, 78), (156, 156, 150), h=8, w=16)
    clear = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    frames = [concrete, carpet, face, wall_top(), on(concrete, STAIRS_UP)]
    frames += cut(grid(WORKBENCH))      # 5-7
    frames += cut(grid(METAL_SHELF))    # 8-10
    frames += cut(grid(CRT_TV))         # 11-14 (TL, TR, BL, BR)
    frames += cut(grid(MINI_FRIDGE))    # 15-18
    frames += cut(grid(DADS_BOX))       # 19-20
    frames += cut(grid(WATER_HEATER))   # 21-22 (top, bottom)
    frames += cut(grid(WEIGHT_BENCH))   # 23-24
    frames.append(on(clear, FLOOR_DRAIN))  # 25
    return frames


# ── Hardware store ───────────────────────────────────────────────────────────

GLASS_DOOR = """
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KeKKKKKKKKKKKKeK
KeKUUUUUUUUUUKeK
KeKUwUUUUUUUUKeK
KeKUUwUUUUUUUKeK
KeKUUUUUUUUUUKeK
KeKUUUUUUUUUUKeK
KeKUUUUUUUUwUKeK
KeKUUUUUUUwUUKeK
KeKUUUUUUUUUUKeK
KeKKKKKKKKKKKKeK
KeeeeeeeeeeeeeeK
KooooooooooooooK
KooooooooooooooK
KKKKKKKKKKKKKKKK
"""

MAT = """
................
................
.KKKKKKKKKKKKKK.
.KooooooooooooK.
.KoKoKoKoKoKoKK.
.KooooooooooooK.
.KKoKoKoKoKoKoK.
.KooooooooooooK.
.KKKKKKKKKKKKKK.
................
................
................
................
................
................
................
"""

# One 16x32 shelf unit per department: top tile shows the goods from above,
# bottom tile shows the shelf front. Order: lumber, pipe, hardware, paint,
# tools, electrical.
SHELVES = {
    "lumber": """
KKKKKKKKKKKKKKKK
KtttttttttttttbK
KBBBBBBBBBBBBBbK
KtttttttttttttbK
KBBBBBBBBBBBBBbK
KtttttttttttttbK
KBBBBBBBBBBBBBbK
KtttttttttttttbK
KBBBBBBBBBBBBBbK
KKKKKKKKKKKKKKKK
KsKtttttttttKsKK
KsKBBBBBBBBBKsKK
KsKtttttttttKsKK
KsKBBBBBBBBBKsKK
KsKKKKKKKKKKKsKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKtttttttttKsKK
KsKBBBBBBBBBKsKK
KsKtttttttttKsKK
KsKBBBBBBBBBKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKtttttttttKsKK
KsKBBBBBBBBBKsKK
KsKtttttttttKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKoooooooooKsKK
KsKKKKKKKKKKKsKK
KKKKKKKKKKKKKKKK
................
""",
    "pipe": """
KKKKKKKKKKKKKKKK
KeKeKeKeKeKeKeKK
KdKdKdKdKdKdKdKK
KeKeKeKeKeKeKeKK
KdKdKdKdKdKdKdKK
KKKKKKKKKKKKKKKK
KoKoKoKoKoKoKoKK
KOKOKOKOKOKOKOKK
KoKoKoKoKoKoKoKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKeeeeeeeeeKsKK
KsKdKdKdKdKdKsKK
KsKeeeeeeeeeKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKwwwwwwwwwKsKK
KsKwKwKwKwKwKsKK
KsKwwwwwwwwwKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKoOoOoOoOoKsKK
KsKOoOoOoOoOKsKK
KsKoOoOoOoOoKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKdddddddddKsKK
KsKeeeeeeeeeKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
................
""",
    "hardware": """
KKKKKKKKKKKKKKKK
KrrrrKuuuuKyyyKK
KrKKrKuKKuKyKyKK
KrrrrKuuuuKyyyKK
KKKKKKKKKKKKKKKK
KggggKeeeeKrrrKK
KgKKgKeKKeKrKrKK
KggggKeeeeKrrrKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKrrKuuKyyKsKKK
KsKrrKuuKyyKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKggKeeKrrKsKKK
KsKggKeeKrrKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKuuKyyKggKsKKK
KsKuuKyyKggKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKeeKrrKuuKsKKK
KsKeeKrrKuuKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKyyKggKeeKsKKK
KsKyyKggKeeKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
................
""",
    "paint": """
KKKKKKKKKKKKKKKK
KKeeKKKeeKKKeeKK
KeuueKeyyeKerreK
KeuueKeyyeKerreK
KKeeKKKeeKKKeeKK
KKeeKKKeeKKKeeKK
KeggeKeppeKewweK
KeggeKeppeKewweK
KKeeKKKeeKKKeeKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKeeKeeKeeKsKKK
KsKuuKyyKrrKsKKK
KsKeeKeeKeeKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKeeKeeKeeKsKKK
KsKggKppKwwKsKKK
KsKeeKeeKeeKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKeeKeeKeeKsKKK
KsKRRKUUKGGKsKKK
KsKeeKeeKeeKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKBBBBBBBBBKsKK
KsKtttttttttKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
................
""",
    "tools": """
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKoKsKdKsKrKsKK
KsKoKsKdKsKrKsKK
KsKoKsKdKsKrKsKK
KsKbKsKeKsKdKsKK
KsKbKsKeKsKdKsKK
KsKbKsKeKsKdKsKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKoooKyyyKoKsKK
KsKodoKydyKoKsKK
KsKoooKyyyKoKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKdKKdKKdKKdsKK
KsKeKKeKKeKKesKK
KsKbKKbKKbKKbsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKoooKoooKoKsKK
KsKoKoKoKoKoKsKK
KsKoooKoooKoKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKrrrrrrrrrKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
................
""",
    "electrical": """
KKKKKKKKKKKKKKKK
KKKKKKKKKKKKKKKK
KKoooKKKgggKKKKK
KoKKKoKgKKKgKKKK
KoKdKoKgKdKgKKKK
KoKKKoKgKKKgKKKK
KKoooKKKgggKKKKK
KKKKKKKKKKKKKKKK
KKuuuKKKrrrKKKKK
KKKKKKKKKKKKKKKK
KsssssssssssssKK
KsKwwKwwKwwKsKKK
KsKyKKyKKyKKsKKK
KsKwwKwwKwwKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KsKoooKgggKuKsKK
KsKoKoKgKgKuKsKK
KsKoooKgggKuKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKwwwwwwwwwKsKK
KsKwyywwyywwKsKK
KsKwwwwwwwwwKsKK
KsKKKKKKKKKKKsKK
KsssssssssssssKK
KsKrrKuuKggKsKKK
KsKrrKuuKggKsKKK
KsKKKKKKKKKKsKKK
KsssssssssssssKK
KKKKKKKKKKKKKKKK
................
""",
}

COUNTER = """
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooK
KOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOK
KooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK
KDddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddDK
KDdKKKKKKKKKKKKKdKKKKKKKKKKKKKdKKKKKKKKKKKKKKKdKKKKKKKKKKKKKKdKKKKKKKKKKKKKKKKdKKKKKKKKKKKKKKKdDK
KDdKoooooooooooKdKoooooooooooKdKoooooooooooooKdKoooooooooooodKoooooooooooooooKdKoooooooooooooKdDK
KDdKoKKKKKKKKKoKdKoKKKKKKKKKoKdKoKKKKKKKKKKKoKdKoKKKKKKKKKKodKoKKKKKKKKKKKKKoKdKoKKKKKKKKKKKoKdDK
KDdKoooooooooooKdKoooooooooooKdKoooooooooooooKdKoooooooooooodKoooooooooooooooKdKoooooooooooooKdDK
KDdKKKKKKKKKKKKKdKKKKKKKKKKKKKdKKKKKKKKKKKKKKKdKKKKKKKKKKKKKKdKKKKKKKKKKKKKKKKdKKKKKKKKKKKKKKKdDK
KDddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddDK
KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
................................................................................................
"""

REGISTER = """
................
................
...KKKKKKKKKK...
...KDDDDDDDDK...
...KDGGGGGGDK...
...KDDDDDDDDK...
...KKKKKKKKKK...
....KeeeeeeK....
...KewewewewK...
...KeeeeeeeeK...
...KKKKKKKKKK...
................
................
................
................
................
"""

CART = """
................
................
..KK............
...K............
...KKKKKKKKKKK..
...KoKoKoKoKoK..
...KKKKKKKKKKK..
....KoKoKoKoK...
....KKKKKKKKK...
.....K.....K....
....KKKKKKKKK...
....KdK...KdK...
....KKK...KKK...
................
................
................
"""

PALLET = """
................
.KKKKKKKKKKKKKK.
.KtttttttttttbK.
.KBBBBBBBBBBBbK.
.KtttttttttttbK.
.KBBBBBBBBBBBbK.
.KtttttttttttbK.
.KBBBBBBBBBBBbK.
.KKKKKKKKKKKKKK.
.KbKKKbKKKbKKbK.
.KbbbbbbbbbbbbK.
.KKKKKKKKKKKKKK.
................
................
................
................
"""


def store_sheet() -> list[Image.Image]:
    floor = Image.new("RGBA", (16, 16), (220, 220, 212, 255))
    for y in range(16):
        for x in range(16):
            if x == 15 or y == 15:
                floor.putpixel((x, y), (188, 188, 182, 255))
            elif (x * 5 + y * 3) % 17 == 0:
                floor.putpixel((x, y), (204, 204, 196, 255))
    stripe = floor.copy()
    for x in range(16):
        for y in (6, 7, 8, 9):
            stripe.putpixel((x, y), (232, 112, 24, 255))
    face = blocks((176, 168, 152), (120, 112, 100), (200, 192, 176), h=8, w=16, stripe=(232, 112, 24))
    clear = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    frames = [floor, stripe, face, wall_top((40, 36, 34), (58, 52, 48)), grid(GLASS_DOOR), on(clear, MAT)]
    for name in ("lumber", "pipe", "hardware", "paint", "tools", "electrical"):
        frames += cut(grid(SHELVES[name]))      # 6-17: (top, bottom) per department
    counter = cut(grid(COUNTER))                # 18-23: six counter pieces
    frames += counter
    frames += [on(clear, REGISTER), on(clear, CART), on(clear, PALLET)]  # 24-26
    return frames


def save(frames: list[Image.Image], name: str) -> None:
    sheet = Image.new("RGBA", (16 * len(frames), 16), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (16 * i, 0))
    sheet.save(TILESETS / name)
    print("wrote", name, len(frames), "frames")


def main() -> None:
    save(utility_sheet(), "utility_16x16.png")
    save(store_sheet(), "store_16x16.png")


if __name__ == "__main__":
    main()
