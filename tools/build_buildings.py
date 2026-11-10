# -*- coding: utf-8 -*-
"""실사풍 주택 그림(house_terrace.png)의 벽돌·창·지붕을 재료로
양조장, 뇌관 공장, 구빈원을 같은 화풍으로 지어 올린다.

  python tools/build_buildings.py
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / 'tools' / 'source' / 'houses' / 'house_terrace.png').convert('RGBA')
OUT = ROOT / 'public' / 'assets' / 'houses'

# 원본에서 잘라 쓰는 조각 (x0, x1) / (y0, y1)
EDGE_L, EDGE_R = (25, 130), (550, 655)
DOOR, WIN_L, WIN_R = (270, 410), (130, 270), (410, 550)      # 가운데 칸(1층은 문), 창문 칸
ROWS = {'cornice': (250, 345), 'upper': (345, 565), 'mid': (565, 800), 'ground': (800, 1140)}
SLATE = (255, 114, 425, 250)
STACK = (60, 64, 110, 134)


def crop(x, y):
    return SRC.crop((x[0], y[0], x[1], y[1]))


def row(name, bays):
    """한 층을 가로로 잇는다. bays 는 칸마다 쓸 조각"""
    y = ROWS[name]
    parts = [crop(EDGE_L, y)] + [crop(b, y) for b in bays] + [crop(EDGE_R, y)]
    out = Image.new('RGBA', (sum(p.width for p in parts), y[1] - y[0]))
    x = 0
    for p in parts:
        out.paste(p, (x, 0))
        x += p.width
    return out


def roof(width):
    tile = SRC.crop(SLATE)
    out = Image.new('RGBA', (width, tile.height))
    for i, x in enumerate(range(0, width, tile.width)):
        out.paste(tile if i % 2 == 0 else tile.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
    d = ImageDraw.Draw(out)
    d.rectangle([0, 0, width, 5], fill=(58, 52, 54, 255))                 # 용마루
    # 양 끝을 비스듬히 깎아 모임지붕처럼 보이게 한다
    for i in range(tile.height):
        cut = int((tile.height - i) * 0.45)
        d.line([(0, i), (cut, i)], fill=(0, 0, 0, 0))
        d.line([(width - cut, i), (width, i)], fill=(0, 0, 0, 0))
    return out


def stack(height):
    """벽돌 굴뚝. 주택 굴뚝의 벽돌을 세로로 이어 쌓는다"""
    brick = SRC.crop(STACK)
    w = brick.width + 14
    out = Image.new('RGBA', (w, height))
    for y in range(0, height, brick.height):
        out.paste(brick, (7, y))
    d = ImageDraw.Draw(out)
    d.rectangle([0, 0, w, 16], fill=(52, 40, 36, 255))
    d.rectangle([3, 16, w - 3, 24], fill=(92, 58, 46, 255))
    shade = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([w // 2, 24, w - 7, height], fill=(0, 0, 0, 46))
    out.alpha_composite(shade)
    return out


def font(size):
    for name in ('georgiab.ttf', 'timesbd.ttf', 'arialbd.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def sign(img, text, cx, y, w, h=58):
    d = ImageDraw.Draw(img)
    d.rectangle([cx - w // 2, y, cx + w // 2, y + h], fill=(30, 25, 22, 255), outline=(150, 118, 62, 255), width=3)
    f = font(int(h * 0.56))
    tw = d.textlength(text, font=f)
    d.text((cx - tw / 2, y + h * 0.18), text, font=f, fill=(206, 170, 98, 255))


def gate(img, cx, bottom, w, h):
    """마차가 드나드는 아치문"""
    d = ImageDraw.Draw(img)
    x0, x1, top = cx - w // 2, cx + w // 2, bottom - h
    ring = (118, 54, 40, 255)
    d.rectangle([x0 - 12, top + w // 2, x1 + 12, bottom], fill=ring)
    d.pieslice([x0 - 12, top - 12, x1 + 12, top + w + 12], 180, 360, fill=ring)
    wood = (44, 31, 23, 255)
    d.rectangle([x0, top + w // 2, x1, bottom], fill=wood)
    d.pieslice([x0, top, x1, top + w], 180, 360, fill=wood)
    for x in range(x0 + 14, x1, 16):                                      # 널빤지 결
        d.line([(x, top + 22), (x, bottom)], fill=(30, 21, 16, 255), width=2)
    d.line([(cx, top), (cx, bottom)], fill=(18, 12, 9, 255), width=4)
    d.rectangle([x0, top + w // 2 + 40, x1, top + w // 2 + 48], fill=(70, 62, 58, 255))    # 쇠띠
    d.rectangle([x0, bottom - 60, x1, bottom - 52], fill=(70, 62, 58, 255))


def stock_brick(img):
    """붉은 벽돌을 런던의 누런 회색 벽돌로 바꾼다 (관공서 느낌)"""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3]
    grey = rgb.mean(axis=2, keepdims=True)
    warm = np.array([1.06, 0.98, 0.80], np.float32)
    redness = np.clip((rgb[..., 0:1] - rgb[..., 2:3]) / 60.0, 0, 1)        # 벽돌에만 적용, 창과 지붕은 그대로
    a[..., :3] = rgb * (1 - redness) + (grey * warm * 1.18 + 14) * redness
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def assemble(rows_):
    w = rows_[0].width
    top = roof(w - 40)
    h = top.height - 6 + sum(r.height for r in rows_)
    out = Image.new('RGBA', (w, h))
    out.alpha_composite(top, (20, 0))
    y = top.height - 6
    for r in rows_:
        out.alpha_composite(r, (0, y))
        y += r.height
    return out


def finish(img, name):
    img = ImageEnhance.Contrast(img).enhance(1.04)
    h = 420
    img.resize((round(img.width * h / img.height), h), Image.LANCZOS).save(OUT / f'{name}.webp', quality=90, method=6)
    print(f'  {name}: {img.width}x{img.height}')


def brewery():
    bays = [WIN_L, WIN_R, WIN_L, WIN_R, WIN_L]
    body = assemble([row('cornice', bays), row('upper', bays), row('mid', bays)])
    cx = body.width // 2
    gate(body, cx, body.height, 190, 205)
    sign(body, 'LION BREWERY', cx, body.height - 235 - 62, 470)
    ImageDraw.Draw(body).rectangle([18, body.height - 12, body.width - 18, body.height], fill=(74, 68, 64, 255))
    extra = 250
    canvas = Image.new('RGBA', (body.width, body.height + extra))
    canvas.alpha_composite(stack(extra + 150), (body.width - 250, 0))      # 굴뚝은 지붕 뒤에
    canvas.alpha_composite(body, (0, extra))
    finish(canvas, 'house_brewery')


def factory():
    bays = [WIN_L, WIN_R, WIN_L, WIN_R]
    body = assemble([row('cornice', bays), row('upper', bays), row('ground', [WIN_L, DOOR, WIN_R, WIN_L])])
    sign(body, 'ELEY BROTHERS', body.width // 2, body.height - 340 - 4, 430, 50)
    extra = 120
    canvas = Image.new('RGBA', (body.width, body.height + extra))
    canvas.alpha_composite(stack(extra + 140), (150, 0))
    canvas.alpha_composite(body, (0, extra))
    finish(canvas, 'house_factory')


def workhouse():
    bays = [WIN_L, WIN_R, WIN_L, WIN_R, WIN_L, WIN_R, WIN_L]
    body = assemble([row('cornice', bays), row('upper', bays), row('mid', bays),
                     row('ground', [WIN_L, WIN_R, WIN_L, DOOR, WIN_L, WIN_R, WIN_L])])
    body = stock_brick(body)
    # 가운데 세 칸 위의 삼각 박공과 둥근 창
    cx, half, rise = body.width // 2, 230, 120
    canvas = Image.new('RGBA', (body.width, body.height + 40))
    canvas.alpha_composite(body, (0, 40))
    d = ImageDraw.Draw(canvas)
    y = 138 + 40
    d.polygon([(cx - half, y), (cx, y - rise), (cx + half, y)], fill=(168, 156, 128, 255))
    d.line([(cx - half, y), (cx, y - rise), (cx + half, y), (cx - half, y)], fill=(214, 206, 186, 255), width=7)
    d.ellipse([cx - 26, y - 78, cx + 26, y - 26], fill=(40, 44, 50, 255), outline=(214, 206, 186, 255), width=5)
    finish(canvas, 'house_workhouse')


if __name__ == '__main__':
    brewery()
    factory()
    workhouse()
