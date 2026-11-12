# -*- coding: utf-8 -*-
"""흉상들의 얼굴 크기와 위치를 하나로 맞춘다.

생성기마다 얼굴이 크게도 작게도 나오므로, 얼굴을 찾아 폭과 중심을 재고
모두 같은 폭·같은 높이에 오도록 키우거나 줄여 같은 크기의 판에 놓는다.

  python tools/frame_portraits.py            # 전부
  python tools/frame_portraits.py sarah ned  # 일부
  python tools/frame_portraits.py --audit     # 머리나 어깨가 그림 밖으로 잘린 원본 찾기

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


MARGIN_TOP = 14       # 머리(모자) 위로 남길 여백
MARGIN_SIDE = 10      # 어깨 옆으로 남길 여백 (판 아래쪽 22%는 잘려도 자연스럽다)


def fit_scale(cut: Image.Image, cx: float, cy: float, s: float) -> float:
    """얼굴 크기를 맞추는 배율 s 를, 머리 위와 어깨 옆이 판 안에 들어올 때까지 줄인다"""
    a = np.array(cut)[..., 3] > 128
    ys, _ = np.nonzero(a)
    if not len(ys):
        return s
    top = ys.min()
    for _ in range(4):
        # 머리 위
        if (cy - top) * s > OUT_H * FACE_Y - MARGIN_TOP:
            s = (OUT_H * FACE_Y - MARGIN_TOP) / (cy - top)
        # 판 위쪽 78% 높이 안에 들어오는 원본 줄들의 좌우 폭
        bottom = int(min(a.shape[0], cy + (OUT_H * 0.78 - OUT_H * FACE_Y) / s))
        rows = a[top:bottom]
        cols = np.nonzero(rows.any(axis=0))[0]
        if not len(cols):
            break
        half = max(cx - cols.min(), cols.max() + 1 - cx)
        if half * s > OUT_W / 2 - MARGIN_SIDE:
            s = (OUT_W / 2 - MARGIN_SIDE) / half
        else:
            break
    return s


def edge_cut(cut: Image.Image) -> str:
    """배경을 지운 그림에서 인물이 위나 양옆 테두리에 닿았으면(그림 밖으로 잘렸으면) 어디인지 돌려준다"""
    a = np.array(cut)[..., 3] > 128
    h = a.shape[0]
    where = []
    if a[:2].sum() > 2:
        where.append('위')
    if a[: int(h * 0.82), :2].sum() > 2:
        where.append('왼쪽')
    if a[: int(h * 0.82), -2:].sum() > 2:
        where.append('오른쪽')
    return ' '.join(where)


SEEDS = RAW / 'seeds.json'      # 잘리지 않은 그림을 얻은 시드 (원래 시드보다 우선)


def chosen_seed(name: str, seed: int) -> int:
    import json
    try:
        return json.loads(SEEDS.read_text(encoding='utf-8')).get(name, seed)
    except FileNotFoundError:
        return seed


def generate_clean(pipe, session, name: str, prompt: str, neg: str, seed: int, tries: int = 8):
    """흉상 하나를 만든다. 머리나 어깨가 그림 밖으로 잘리면 시드를 바꿔 다시 뽑는다.
    받아들인 시드는 seeds.json 에 적어 다음에도 같은 그림이 나오게 한다"""
    import json, torch
    from rembg import remove
    for i in range(tries):
        s = seed + i * 7919
        img = pipe(prompt, negative_prompt=neg, width=768, height=768, num_inference_steps=28, guidance_scale=6.5,
                   generator=torch.Generator('cuda').manual_seed(s)).images[0]
        cut = remove(img, session=session, post_process_mask=True)
        bad = edge_cut(cut)
        if not bad:
            break
        print(f'    {name} 시드 {s}: {bad} 잘림, 다시 뽑는다')
    img.save(RAW / f'{name}.png')
    (RAW / 'cut').mkdir(exist_ok=True)
    cut.save(RAW / 'cut' / f'{name}.png')
    seeds = json.loads(SEEDS.read_text(encoding='utf-8')) if SEEDS.exists() else {}
    seeds[name] = s
    SEEDS.write_text(json.dumps(seeds, ensure_ascii=False, indent=1), encoding='utf-8')
    return bad


def frame(name: str) -> str:
    raw = Image.open(RAW / f'{name}.png')
    cut = Image.open(CUT / f'{name}.png').convert('RGBA')
    k = cut.width / raw.width                       # 배경 지운 그림이 원본과 크기가 다를 수 있다
    f = find_face(raw)
    if f is None:
        return f'{name}: 얼굴을 못 찾아 그대로 둠'
    cx, cy, fw = (v * k for v in f)
    s = fit_scale(cut, cx, cy, FACE_W / fw)
    big = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', (OUT_W, OUT_H))
    ox, oy = round(OUT_W / 2 - cx * s), round(OUT_H * FACE_Y - cy * s)
    out.alpha_composite(big, (ox, oy)) if ox >= 0 and oy >= 0 else out.paste(big, (ox, oy), big)
    # 그림이 판 아래까지 닿지 않으면 바닥이 떠 보이므로, 옷 끝 몇 줄을 아래로 늘여 메운다
    gap = OUT_H - (oy + big.height)
    if gap > 0:
        edge = out.crop((0, OUT_H - gap - 3, OUT_W, OUT_H - gap))
        out.alpha_composite(edge.resize((OUT_W, gap + 1), Image.BILINEAR), (0, OUT_H - gap - 1))
    # 어깨 끝이 판 옆 테두리에 조금 못 미치면(원본 그림 밖으로 나갔던 몸) 세로로 잘려 보이므로,
    # 아래에서부터 곧게 선 가장자리 구간만 골라 옷을 테두리까지 늘인다. 비스듬한 어깨선은 건드리지 않는다
    a = np.array(out)
    body = a[..., 3] > 128
    for side in (0, 1):
        edge = None
        for y in range(OUT_H - 1, int(OUT_H * 0.5), -1):
            xs = np.nonzero(body[y])[0]
            if not len(xs):
                break
            x = xs[0] if side == 0 else xs[-1]
            gap = x if side == 0 else OUT_W - 1 - x
            if edge is None:
                if not 0 < gap <= 48:
                    break
                edge = x
            elif abs(x - edge) > 1:
                break
            if side == 0:
                a[y, :x] = a[y, x + 1]
            else:
                a[y, x + 1:] = a[y, x - 1]
    out = Image.fromarray(a)
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


def audit() -> list[str]:
    """그림 밖으로 잘린 원본을 찾는다"""
    bad = []
    for p in sorted(CUT.glob('*.png')):
        where = edge_cut(Image.open(p).convert('RGBA'))
        if where:
            bad.append(p.stem)
            print(f'  {p.stem}: {where} 잘림')
    print(f'잘린 원본 {len(bad)}개' + (': ' + ' '.join(bad) if bad else ''))
    return bad


if __name__ == '__main__':
    if '--audit' in sys.argv:
        audit()
        sys.exit()
    names = sys.argv[1:] or sorted(p.stem for p in CUT.glob('*.png'))
    for n in names:
        print(' ', frame(n))
    sheet(names)
