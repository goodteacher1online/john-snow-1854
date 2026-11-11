# -*- coding: utf-8 -*-
"""흉상들의 얼굴 크기와 위치를 하나로 맞춘다.

생성기마다 얼굴이 크게도 작게도 나오므로, 얼굴을 찾아 폭과 중심을 재고
모두 같은 폭·같은 높이에 오도록 키우거나 줄여 같은 크기의 판에 놓는다.

  python tools/frame_portraits.py            # 전부
  python tools/frame_portraits.py sarah ned  # 일부

입력: tools/source/portraits_gen/<이름>.png (배경 포함, 얼굴 찾기용)
      tools/source/portraits_gen/cut/<이름>.png (배경을 지운 것)
출력: public/assets/portraits/<이름>.webp
"""
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'tools' / 'source' / 'portraits_gen'
CUT = RAW / 'cut'
OUT = ROOT / 'public' / 'assets' / 'portraits'

OUT_W, OUT_H = 520, 500
FACE_W = 230          # 얼굴 폭 (출력 픽셀)
FACE_Y = 0.47         # 얼굴 중심 높이 (출력 높이에 대한 비율)

_casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')


def find_face(raw: Image.Image):
    """(중심 x, 중심 y, 폭) 을 원본 픽셀로. 못 찾으면 None"""
    g = cv2.equalizeHist(cv2.cvtColor(np.array(raw.convert('RGB')), cv2.COLOR_RGB2GRAY))
    faces = _casc.detectMultiScale(g, 1.05, 4, minSize=(raw.width // 5, raw.width // 5))
    if not len(faces):
        return None
    x, y, w, h = max(faces, key=lambda r: r[2])
    return x + w / 2, y + h / 2, w


def frame(name: str) -> str:
    raw = Image.open(RAW / f'{name}.png')
    cut = Image.open(CUT / f'{name}.png').convert('RGBA')
    k = cut.width / raw.width                       # 배경 지운 그림이 원본과 크기가 다를 수 있다
    f = find_face(raw)
    if f is None:
        return f'{name}: 얼굴을 못 찾아 그대로 둠'
    cx, cy, fw = (v * k for v in f)
    s = FACE_W / fw
    big = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', (OUT_W, OUT_H))
    ox, oy = round(OUT_W / 2 - cx * s), round(OUT_H * FACE_Y - cy * s)
    out.alpha_composite(big, (ox, oy)) if ox >= 0 and oy >= 0 else out.paste(big, (ox, oy), big)
    # 그림이 판 아래까지 닿지 않으면 바닥이 떠 보이므로, 옷 끝 몇 줄을 아래로 늘여 메운다
    gap = OUT_H - (oy + big.height)
    if gap > 0:
        edge = out.crop((0, OUT_H - gap - 3, OUT_W, OUT_H - gap))
        out.alpha_composite(edge.resize((OUT_W, gap + 1), Image.BILINEAR), (0, OUT_H - gap - 1))
    out.save(OUT / f'{name}.webp', quality=88, method=6)
    return f'{name}: 얼굴 폭 {fw:.0f} -> {FACE_W}, 배율 {s:.2f}' + (f'  (아래 {gap}px 메움)' if gap > 0 else '')


def sheet(names):
    ims = [Image.open(OUT / f'{n}.webp').convert('RGBA') for n in names]
    cols = 9
    w, h = OUT_W // 2, OUT_H // 2
    out = Image.new('RGBA', (cols * (w + 6), ((len(ims) + cols - 1) // cols) * (h + 6)), (236, 224, 196, 255))
    for i, im in enumerate(ims):
        out.alpha_composite(im.resize((w, h)), ((i % cols) * (w + 6) + 3, (i // cols) * (h + 6) + 3))
    out.convert('RGB').save(RAW / '_framed.png')
    print('모아 보기:', RAW / '_framed.png')


if __name__ == '__main__':
    names = sys.argv[1:] or sorted(p.stem for p in CUT.glob('*.png'))
    for n in names:
        print(' ', frame(n))
    sheet(names)
