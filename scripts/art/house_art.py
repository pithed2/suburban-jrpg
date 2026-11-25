"""
Original pixel art for the main house floor (NeighborhoodScene).

Run:  python3 scripts/art/house_art.py
Writes the tile sheet to public/assets-active/tilesets/house_16x16.png.
Frame numbers are in src/game/houseTiles.ts. Keep the two in the same order.

Each piece is an ASCII grid. One character is one pixel. "." is clear.
Edit a grid and run the script again to change the art.
"""
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets-active/tilesets/house_16x16.png"

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
    "o": (232, 128, 40),
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


def planks(base, seam, grain, seed) -> Image.Image:
    """Wood floor: 4 px boards running sideways, staggered end joints."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (16, 16), base + (255,))
    for y in range(16):
        board = y // 4
        joint = (board * 6 + 3) % 16
        for x in range(16):
            if y % 4 == 3 or x == joint:
                img.putpixel((x, y), seam + (255,))
            elif rng.random() < 0.08:
                img.putpixel((x, y), grain + (255,))
    return img


def checker(a, b, size=8) -> Image.Image:
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), (a if (x // size + y // size) % 2 == 0 else b) + (255,))
    return img


def slate() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (120, 116, 108, 255))
    for y in range(16):
        for x in range(16):
            if y % 8 == 7 or (x + (4 if (y // 8) % 2 else 0)) % 8 == 7:
                img.putpixel((x, y), (72, 70, 66, 255))
            elif (x * 7 + y * 3) % 11 == 0:
                img.putpixel((x, y), (140, 136, 126, 255))
    return img


def wall_face() -> Image.Image:
    """Cream wallpaper with thin stripes, chair rail and baseboard."""
    img = Image.new("RGBA", (16, 16), (232, 216, 176, 255))
    for y in range(16):
        for x in range(16):
            if x % 4 == 0 and y < 9:
                img.putpixel((x, y), (214, 194, 150, 255))
    for x in range(16):
        img.putpixel((x, 9), (160, 100, 48, 255))
        for y in (10, 11, 12):
            img.putpixel((x, y), (200, 176, 128, 255))
        img.putpixel((x, 13), (120, 72, 32, 255))
        img.putpixel((x, 14), (160, 100, 48, 255))
        img.putpixel((x, 15), (72, 40, 16, 255))
    return img


def wall_top() -> Image.Image:
    img = Image.new("RGBA", (16, 16), (40, 30, 34, 255))
    for y in range(16):
        for x in range(16):
            if (x + y * 5) % 9 == 0:
                img.putpixel((x, y), (58, 46, 50, 255))
    return img


STAIRS_DOWN = """
KKKKKKKKKKKKKKKK
KttttttttttttttK
KBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKK
KKttttttttttttKK
KKBBBBBBBBBBBBKK
KKKKKKKKKKKKKKKK
KKKttttttttttKKK
KKKBBBBBBBBBBKKK
KKKKKKKKKKKKKKKK
KKKKttttttttKKKK
KKKKBBBBBBBBKKKK
KKKKKKKKKKKKKKKK
KKKKKttttttKKKKK
KKKKKBBBBBBKKKKK
KKKKKKKKKKKKKKKK
"""

STAIRS_UP = """
KKKKKttttttKKKKK
KKKKKBBBBBBKKKKK
KKKKKbbbbbbKKKKK
KKKKttttttttKKKK
KKKKBBBBBBBBKKKK
KKKKbbbbbbbbKKKK
KKKttttttttttKKK
KKKBBBBBBBBBBKKK
KKKbbbbbbbbbbKKK
KKttttttttttttKK
KKBBBBBBBBBBBBKK
KKbbbbbbbbbbbbKK
KttttttttttttttK
KBBBBBBBBBBBBBBK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
"""

DOOR = """
KKKKKKKKKKKKKKKK
KbbbbbbbbbbbbbbK
KbBBBBBBBBBBBBbK
KbBbbbbBBbbbbBbK
KbBbBBbBBbBBbBbK
KbBbBBbBBbBBbBbK
KbBbbbbBBbbbbBbK
KbBBBBBBBBBBBBbK
KbBBBBBBBBBByBbK
KbBbbbbBBbbbbBbK
KbBbBBbBBbBBbBbK
KbBbBBbBBbBBbBbK
KbBbbbbBBbbbbBbK
KbBBBBBBBBBBBBbK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
"""

GARAGE = """
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KeeeeeedeeeeeeeK
KdddddddddddddDK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KeeeeeeeeeeeeeeK
KddddddddddddddK
KKKKKKKKKKKKKKKK
"""

WINDOW = """
................
..KKKKKKKKKKKK..
..KwwwwwwwwwwK..
..KUUUUUKUUUUK..
..KUwUUUKUUUUK..
..KUUwUUKUUUUK..
..KKKKKKKKKKKK..
..KUUUUUKUUwUK..
..KUUUUUKUwUUK..
..KUUUUUKUUUUK..
..KKKKKKKKKKKK..
.KttttttttttttK.
.KKKKKKKKKKKKKK.
................
................
................
"""

PICTURE = """
................
................
...KKKKKKKKKK...
...KyyyyyyyyK...
...KyUUUUUUyK...
...KyUUUUwUyK...
...KyGGUUUUyK...
...KyGGGGGGyK...
...KygGGgGGyK...
...KyyyyyyyyK...
...KKKKKKKKKK...
................
................
................
................
................
"""

TV = """
................
.KKKKKKKKKKKKKK.
.KDDDDDDDDDDDDK.
.KDuuuuuuuuuuDK.
.KDuUUuuuuuuuDK.
.KDuUuuuuuuuuDK.
.KDuuuuuuuuuuDK.
.KDuuuuuuuuuuDK.
.KDDDDDDDDDDDrK.
.KKKKKKKKKKKKKK.
......KddK......
....KKKKKKKK....
................
................
................
................
"""

TV_STAND = """
................
KKKKKKKKKKKKKKKK
KBBBBBBBBBBBBBBK
KbbbbbbbbbbbbbbK
KbBBBBBbbBBBBBbK
KbBKKKBbbBKKKBbK
KbBKyKBbbBKKKBbK
KbBKKKBbbBKKKBbK
KbBBBBBbbBBBBBbK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
.Kb..........bK.
.KK..........KK.
................
................
................
"""

COUCH = """
................................................
................................................
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
KgggggggggggggggggggggggggggggggggggggggggggggggK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgggggggggggggggggggggggggggggggggggggggggggggggK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgGGGGGGGGGGGGGGgGGGGGGGGGGGGGGGgGGGGGGGGGGGGGgK
KgggggggggggggggggggggggggggggggggggggggggggggggK
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
..Kb..........................................bK
..KK..........................................KK
................................................
"""

RUG = """
pppppppppppppppp
pRRRRRRRRRRRRRRp
pRyyyyyyyyyyyyRp
pRyRRRRRRRRRRyRp
pRyRppppppppRyRp
pRyRpRRRRRRpRyRp
pRyRpRyyyyRpRyRp
pRyRpRyRRyRpRyRp
pRyRpRyRRyRpRyRp
pRyRpRyyyyRpRyRp
pRyRpRRRRRRpRyRp
pRyRppppppppRyRp
pRyRRRRRRRRRRyRp
pRyyyyyyyyyyyyRp
pRRRRRRRRRRRRRRp
pppppppppppppppp
"""

COFFEE_TABLE = """
................
................
................
.KKKKKKKKKKKKKK.
.KBBBBBBBBBBBBK.
.KBttttttttttBK.
.KBtwwtttttttBK.
.KBtwwtttRRttBK.
.KBttttttRRttBK.
.KBBBBBBBBBBBBK.
.KbbbbbbbbbbbbK.
.KKKKKKKKKKKKKK.
..Kb........bK..
..KK........KK..
................
................
"""

BOOKSHELF = """
KKKKKKKKKKKKKKKK
KbbbbbbbbbbbbbbK
KbrRuUygGpyrRubK
KbrRuUygGpyrRubK
KbrRuUygGpyrRubK
KbbbbbbbbbbbbbbK
KbuUgGyrRpuUgGbK
KbuUgGyrRpuUgGbK
KbuUgGyrRpuUgGbK
KbbbbbbbbbbbbbbK
KbyrRpuUgGyrRpbK
KbyrRpuUgGyrRpbK
KbyrRpuUgGyrRpbK
KbbbbbbbbbbbbbbK
KBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKK
"""

PLANT = """
................
......gG........
...gG.gGG.Gg....
..gGGgGGGgGGg...
..gGGGGgGGGGg...
...gGgGGGGgG....
..gGGGGGgGGGGg..
...gGGgGGGGGg...
.....gGGgGGg....
......KKKK......
.....KooooK.....
.....KoRRoK.....
.....KooooK.....
......KooK......
......KKKK......
................
"""

END_TABLE = """
................
......KKKK......
.....KyyyyK.....
....KyyyyyyK....
.....KKyyKK.....
.......KK.......
.......dd.......
...KKKKKKKKKK...
...KBBBBBBBBK...
...KbbbbbbbbK...
...KbBBBBBBbK...
...KbBByyBBbK...
...KbBBBBBBbK...
...KbbbbbbbbK...
...KKKKKKKKKK...
................
"""

COUNTER = """
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KewwwwwwwwwwwweK
KewwwwwwwwwwwweK
KewwwwwwwwwwwweK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
KBBBBBBBBBBBBBBK
KBbbbbbBBbbbbbBK
KBbBBBbBBbBBBbBK
KBbBBBbBBbBBBbBK
KBbBByBBBBBBybBK
KBbBBBbBBbBBBbBK
KBbbbbbBBbbbbbBK
KBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKK
"""

SINK = """
KKKKKKKKKKKKKKKK
KeeeeeedeeeeeeeK
KeweeeKddKeeeweK
KewKKKKKKKKKKweK
KewKUUUUUUUUKweK
KeeKKKKKKKKKKeeK
KKKKKKKKKKKKKKKK
KBBBBBBBBBBBBBBK
KBbbbbbBBbbbbbBK
KBbBBBbBBbBBBbBK
KBbBBBbBBbBBBbBK
KBbBByBBBBBBybBK
KBbBBBbBBbBBBbBK
KBbbbbbBBbbbbbBK
KBBBBBBBBBBBBBBK
KKKKKKKKKKKKKKKK
"""

STOVE = """
KKKKKKKKKKKKKKKK
KeeeeeeeeeeeeeeK
KeKKKKeeeeKKKKeK
KeKrrKeeeeKddKeK
KeKKKKeeeeKKKKeK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
KwwwwwwwwwwwwwwK
KwRwwRwwwwRwwRwK
KwwwwwwwwwwwwwwK
KwKKKKKKKKKKKKwK
KwKDDDDDDDDDDKwK
KwKDDDDDDDDDDKwK
KwKKKKKKKKKKKKwK
KwwwwwwwwwwwwwwK
KKKKKKKKKKKKKKKK
"""

DRYER = """
KKKKKKKKKKKKKKKK
KwwwwwwwwwwwwwwK
KwKKwwwwwwwRwywK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KwwwwwwwwwwwwwwK
KwwwwKKKKKKwwwwK
KwwwKddddddKwwwK
KwwKddrRRrddKwwK
KwwKdrRRRRrdKwwK
KwwKddrRRrddKwwK
KwwwKddddddKwwwK
KwwwwKKKKKKwwwwK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
"""

WASHER = """
KKKKKKKKKKKKKKKK
KwwwwwwwwwwwwwwK
KwKKwwwwwwwGwywK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KwwwwwwwwwwwwwwK
KwwwwKKKKKKwwwwK
KwwwKUUUUUUKwwwK
KwwKUUuUUUUUKwwK
KwwKUuUUUuUUKwwK
KwwKUUUUuUUUKwwK
KwwwKUUUUUUKwwwK
KwwwwKKKKKKwwwwK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
"""

FRIDGE = """
KKKKKKKKKKKKKKKK
KwwwwwwwwwwwwwwK
KwwwwwwwwwwwwdwK
KwwwwwwwwwwwwdwK
KwwwwwwwwwwwwdwK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KwwwwwwwwwwwwwwK
KwwRwwwwwwwwwdwK
KwRRRwwwwwwwwdwK
KwwRwwyywwwwwdwK
KwwwwwyywwwwwdwK
KwwwwwwwwwwwwdwK
KwwwwwwwwwwwwwwK
KeeeeeeeeeeeeeeK
KKKKKKKKKKKKKKKK
"""

TABLE = """
................................
................................
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
.KBBBBBBBBBBBBBBBBBBBBBBBBBBBBK.
.KBttttttttttttttttttttttttttBK.
.KBtwwwwtttttttttttttttwwwwttBK.
.KBtwRRwtttttttyytttttwGGwttBK.
.KBtwwwwtttttttyytttttwwwwttBK.
.KBttttttttttttttttttttttttttBK.
.KBBBBBBBBBBBBBBBBBBBBBBBBBBBBK.
.KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK.
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
..Kb........................bK..
..KK........................KK..
................................
................................
"""

CHAIR = """
................
................
.....KKKKKK.....
....KBBBBBBK....
....KBbbbbBK....
....KBBBBBBK....
....KKKKKKKK....
....KBttttBK....
....KBttttBK....
....KBBBBBBK....
....KKKKKKKK....
....Kb....bK....
....KK....KK....
................
................
................
"""

RUNNER = """
................
................
uuuuuuuuuuuuuuuu
UyUUUUyUUUUyUUUU
uuuuuuuuuuuuuuuu
uUUUUUUUUUUUUUUu
uUuuuuuuuuuuuuUu
uUuUUUUUUUUUUuUu
uUuuuuuuuuuuuuUu
uUUUUUUUUUUUUUUu
uuuuuuuuuuuuuuuu
UyUUUUyUUUUyUUUU
uuuuuuuuuuuuuuuu
................
................
................
"""

COAT_HOOKS = """
................
................
..KKKKKKKKKKKK..
..KBBBBBBBBBBK..
..KKdKKKdKKdKK..
....d...d..d....
...KuK.KrK.KgK..
..KuuuKrrrKgggK.
..KuuuKrrrKgggK.
..KuuuKrrrKgggK.
..KuuuKrrrKgggK.
...KKK.KKK.KKK..
................
................
................
................
"""

SHOES = """
................
................
................
................
................
................
................
................
..KKKK....KKKK..
.KrrrrK..KuuuuK.
KrrrrrK.KuuuuuK.
KwwwwwK.KwwwwwK.
.KKKKK...KKKKK..
................
................
................
"""

BENCH = """
................
................
................
................
KKKKKKKKKKKKKKKK
KBBBBBBBBBBBBBBK
KttttttttttttttK
KBBBBBBBBBBBBBBK
KbbbbbbbbbbbbbbK
KKKKKKKKKKKKKKKK
.Kb..........bK.
.Kb..........bK.
.KK..........KK.
................
................
................
"""

UTILITY_DOOR = """
KKKKKKKKKKKKKKKK
KdddddddddddddddK
KdeeeeeeeeeeeedK
KdeKKKKKKKKKKedK
KdeKwwwwwwwwKedK
KdeKwKKwKKwwKedK
KdeKwwwwwwwwKedK
KdeKKKKKKKKKKedK
KdeeeeeeeeeeyedK
KdeeeeeeeeeeeedK
KdeeeeeeeeeeeedK
KdeeeeeeeeeeeedK
KdeeeeeeeeeeeedK
KdeeeeeeeeeeeedK
KdddddddddddddddK
KKKKKKKKKKKKKKKK
"""


def split(img: Image.Image) -> list[Image.Image]:
    return [img.crop((x, 0, x + 16, 16)) for x in range(0, img.width, 16)]


def fix(art: str) -> str:
    """Pad or trim every row to the widest multiple of 16 so typos never shift pixels."""
    rows = art.strip("\n").split("\n")
    width = 16 * max(1, round(max(len(r) for r in rows) / 16))
    return "\n".join(r[:width].ljust(width, ".") for r in rows)


def build() -> Image.Image:
    clear = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    face = wall_face()
    g = lambda art: grid(fix(art))
    couch = split(g(COUCH))
    table = split(g(TABLE))

    frames = [
        planks((176, 116, 60), (112, 68, 30), (196, 136, 76), 1),   # 0 living wood
        checker((236, 236, 228), (168, 64, 56)),                    # 1 kitchen tile
        planks((140, 92, 52), (88, 52, 24), (160, 108, 64), 2),     # 2 hall wood
        slate(),                                                    # 3 mudroom slate
        face,                                                       # 4 wall face
        wall_top(),                                                 # 5 wall top
        g(STAIRS_DOWN),                                             # 6
        g(STAIRS_UP),                                               # 7
        g(DOOR),                                                    # 8 front/back door
        g(GARAGE),                                                  # 9 garage door
        over(face, fix(WINDOW)),                                    # 10
        over(face, fix(PICTURE)),                                   # 11
        over(face, fix(TV)),                                        # 12
        over(clear, fix(TV_STAND)),                                 # 13
        couch[0], couch[1], couch[2],                               # 14-16
        g(RUG),                                                     # 17
        over(clear, fix(COFFEE_TABLE)),                             # 18
        g(BOOKSHELF),                                               # 19
        over(clear, fix(PLANT)),                                    # 20
        over(clear, fix(END_TABLE)),                                # 21
        g(COUNTER),                                                 # 22
        g(SINK),                                                    # 23
        g(STOVE),                                                   # 24
        g(DRYER),                                                   # 25
        g(WASHER),                                                  # 26
        g(FRIDGE),                                                  # 27
        table[0], table[1],                                         # 28-29
        over(clear, fix(CHAIR)),                                    # 30
        over(clear, fix(RUNNER)),                                   # 31
        over(face, fix(COAT_HOOKS)),                                # 32
        over(clear, fix(SHOES)),                                    # 33
        over(clear, fix(BENCH)),                                    # 34
        g(UTILITY_DOOR),                                            # 35
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
