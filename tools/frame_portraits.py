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
FACE_W = 160          # 얼굴 폭 (출력 픽셀). 어깨까지 판 안에 들어오도록 작게
FACE_Y = 0.36         # 얼굴 중심 높이 (출력 높이에 대한 비율, 가장 높은 자리)

_casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')


def find_face(raw: Image.Image):
    """(중심 x, 중심 y, 폭) 을 원본 픽셀로. 못 찾으면 None"""
    g = cv2.equalizeHist(cv2.cvtColor(np.array(raw.convert('RGB')), cv2.COLOR_RGB2GRAY))
    faces = _casc.detectMultiScale(g, 1.05, 4, minSize=(raw.width // 5, raw.width // 5))
    if not len(faces):
        return None
    x, y, w, h = max(faces, key=lambda r: r[2])
    return x + w / 2, y + h / 2, w


def count_faces(raw: Image.Image) -> int:
    """얼굴이 몇 개인지 (두 사람이 그려진 그림을 걸러 낸다)"""
    g = cv2.equalizeHist(cv2.cvtColor(np.array(raw.convert('RGB')), cv2.COLOR_RGB2GRAY))
    return len(_casc.detectMultiScale(g, 1.05, 4, minSize=(raw.width // 10, raw.width // 10)))


def problems(raw: Image.Image, cut: Image.Image) -> tuple[str, float]:
    """흉상으로 쓰기 어려운 까닭과 벌점. 벌점 0 이면 그대로 쓴다.
    머리·어깨 잘림, 얼굴이 하나가 아님, 가슴이 짧아 얼굴이 판 아래로 내려가는 것을 본다"""
    why, pen = [], 0.0
    bad = edge_cut(cut)
    n = count_faces(raw)
    if n != 1:
        why.append(f'얼굴 {n}개'); pen += 10
    f = find_face(raw)
    if f is None:
        return ' '.join(why + ['얼굴 못 찾음']), pen + 20
    k = cut.width / raw.width
    cx, cy, fw = (v * k for v in f)
    solid = np.array(cut)[..., 3] > 128
    H = solid.shape[0]
    side = solid[:, :3].any(axis=1) | solid[:, -3:].any(axis=1)
    rows = np.nonzero(side & (np.arange(H) > cy + fw * 0.6))[0]
    keep = int(rows[0]) - 2 if len(rows) else H
    chest = (keep - cy) / fw
    if chest < CHEST_MIN:
        why.append(f'가슴 짧음 {chest:.2f}'); pen += (CHEST_MIN - chest) * 4
    if '위' in bad:
        why.append('머리 잘림'); pen += 5
    return ' '.join(why), pen


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
    """배경을 지운 그림에서 인물이 위나 양옆 테두리에 닿았으면(그림 밖으로 잘렸으면) 어디인지 돌려준다.
    어깨 끝까지 그림 안에 들어와야 액자에 넣었을 때 옆이 세로로 잘려 보이지 않는다 (맨 아래 3%만 봐준다)"""
    a = np.array(cut)[..., 3] > 128
    h = a.shape[0]
    where = []
    if a[:3].any():
        where.append('위')
    if a[: int(h * 0.97), :3].any():
        where.append('왼쪽')
    if a[: int(h * 0.97), -3:].any():
        where.append('오른쪽')
    return ' '.join(where)


SEEDS = RAW / 'seeds.json'      # 잘리지 않은 그림을 얻은 시드 (원래 시드보다 우선)


def chosen_seed(name: str, seed: int) -> int:
    import json
    try:
        return json.loads(SEEDS.read_text(encoding='utf-8')).get(name, seed)
    except FileNotFoundError:
        return seed


def generate_clean(pipe, session, name: str, prompt: str, neg: str, seed: int, tries: int = 12):
    """흉상 하나를 만든다. 얼굴이 둘이거나, 머리가 잘리거나, 가슴이 짧아 얼굴이 작고 낮게 놓일 그림이면
    시드를 바꿔 다시 뽑고, 끝내 깨끗한 것이 없으면 가장 나은 것을 쓴다.
    받아들인 시드는 seeds.json 에 적어 다음에도 같은 그림이 나오게 한다"""
    import json, torch
    from rembg import remove
    best = None
    for i in range(tries):
        s = seed + i * 7919
        img = pipe(prompt, negative_prompt=neg, width=768, height=960, num_inference_steps=28, guidance_scale=6.5,
                   generator=torch.Generator('cuda').manual_seed(s)).images[0]
        cut = remove(img, session=session, post_process_mask=True)
        why, pen = problems(img, cut)
        if best is None or pen < best[0]:
            best = (pen, s, img, cut, why)
        if pen == 0:
            break
        print(f'    {name} 시드 {s}: {why}, 다시 뽑는다')
    pen, s, img, cut, why = best
    img.save(RAW / f'{name}.png')
    (RAW / 'cut').mkdir(exist_ok=True)
    cut.save(RAW / 'cut' / f'{name}.png')
    seeds = json.loads(SEEDS.read_text(encoding='utf-8')) if SEEDS.exists() else {}
    seeds[name] = s
    SEEDS.write_text(json.dumps(seeds, ensure_ascii=False, indent=1), encoding='utf-8')
    return why


CHEST_MIN = 1.25      # 얼굴 가운데부터 가슴 아래 끝까지 최소 길이 (얼굴 폭의 배수). 이보다 짧으면 다시 그려야 한다


def frame(name: str) -> str:
    """얼굴 크기를 모두 같게 맞춰 같은 크기의 판에 놓는다.
    원본에서 어깨가 그림 테두리에 닿기 시작하는 높이 위에서 가슴을 수평으로 잘라, 어깨 옆이 세로로 잘려 보이지 않게 한다.
    그림이 판 아래까지 닿지 않으면 늘려 메우지 않고 아래로 내려 붙인다"""
    raw = Image.open(RAW / f'{name}.png')
    cut = Image.open(CUT / f'{name}.png').convert('RGBA')
    k = cut.width / raw.width                       # 배경 지운 그림이 원본과 크기가 다를 수 있다
    f = find_face(raw)
    if f is None:
        return f'{name}: 얼굴을 못 찾아 그대로 둠 [다시 그리기]'
    cx, cy, fw = (v * k for v in f)
    a = np.array(cut)
    solid = a[..., 3] > 128
    H, W = solid.shape
    # 어깨가 그림 옆 테두리에 닿는 첫 줄 (얼굴 아래에서). 그 위까지만 쓴다
    side = solid[:, :3].any(axis=1) | solid[:, -3:].any(axis=1)
    rows = np.nonzero(side & (np.arange(H) > cy + fw * 0.6))[0]
    keep = int(rows[0]) - 2 if len(rows) else H
    ys = np.nonzero(solid[:keep].any(axis=1))[0]
    top = int(ys.min())
    chest = (keep - cy) / fw
    s = FACE_W / fw
    # 머리 위 여백: 모자가 큰 사람은 판 위로 넘치지 않게 얼굴을 조금 낮춘다 (크기는 그대로)
    face_y = max(OUT_H * FACE_Y, (cy - top) * s + MARGIN_TOP)
    # 가슴 아래 끝이 판 바닥에 못 미치면 아래로 내려 붙인다
    bottom = face_y + (keep - cy) * s
    if bottom < OUT_H:
        face_y += OUT_H - bottom
    # 판에 보이는 줄들에서 어깨 폭이 판보다 넓으면 배율을 줄인다 (드문 경우)
    vis_bottom = int(min(keep, cy + (OUT_H - face_y) / s))
    cols = np.nonzero(solid[top:vis_bottom].any(axis=0))[0]
    half = max(cx - cols.min(), cols.max() + 1 - cx)
    if half * s > OUT_W / 2 - MARGIN_SIDE:
        s = (OUT_W / 2 - MARGIN_SIDE) / half
    a[keep:, :, 3] = 0                               # 가슴 아래 끝에서 수평으로 자른다
    body = Image.fromarray(a)
    big = body.resize((round(W * s), round(H * s)), Image.LANCZOS)
    out = Image.new('RGBA', (OUT_W, OUT_H))
    ox, oy = round(OUT_W / 2 - cx * s), round(face_y - cy * s)
    out.paste(big, (ox, oy), big)
    out.save(OUT / f'{name}.webp', quality=88, method=6)
    flag = ''
    if chest < CHEST_MIN:
        flag = f' [가슴이 짧음 {chest:.2f}, 다시 그리기]'
    if s < FACE_W / fw * 0.9:
        flag += f' [어깨가 넓어 얼굴이 작아짐 {s / (FACE_W / fw):.2f}]'
    return f'{name}: 얼굴 폭 {fw:.0f}, 가슴 {chest:.2f}, 얼굴 높이 {face_y / OUT_H:.2f}' + flag


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
