# -*- coding: utf-8 -*-
"""지도 위 건물과 펌프 그림을 만든다 (Stable Diffusion DreamShaper 8, 로컬 GPU).
출처가 분명한 그림만 쓰려고, 이전 작업에서 출처를 알 수 없던 그림을 이것으로 바꿨다.

  <diffusers 가 깔린 파이썬> tools/gen_buildings.py            # 전부
  <같은 파이썬> tools/gen_buildings.py house pump:1234           # 일부, 이름:시드 로 다시 뽑기

원본: tools/source/buildings_gen/<이름>.png → 게임용: public/assets/houses/house_<이름>.webp, public/assets/pump*.webp
"""
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'tools' / 'source' / 'buildings_gen'
ASSETS = ROOT / 'public' / 'assets'
MODEL = os.environ.get('SD_MODEL', 'Lykon/dreamshaper-8')

STYLE = 'isolated on plain flat white background, realistic detailed digital painting, soft daylight, muted colors, 1850s London'
NEG = ('people, person, crowd, street, road, sky, clouds, trees, ground, neighbouring buildings, cropped, cut off, text, watermark, '
       'signature, frame, border, perspective from below, night, modern, cars, deformed, blurry, cartoon, anime, 3d render')

# 이름: (설명, 가로, 세로, 시드)
ITEMS = {
    'terrace':   ('front elevation of a single narrow four storey Georgian brick terrace house, black front door, sash windows, '
                  'slate roof with chimneys, black iron railings, whole building visible', 512, 832, 21),
    'brewery':   ('front elevation of a Victorian red brick brewery building, large arched wooden cart gate, rows of windows, '
                  'one tall brick chimney, wooden barrels by the gate, whole building visible', 768, 704, 31),
    'factory':   ('front elevation of a small Victorian three storey brick workshop, shop front with a painted sign board, '
                  'sash windows, short chimney, whole building visible', 640, 768, 41),
    'workhouse': ('front elevation of a large plain Georgian workhouse, pale yellow London stock brick, many identical windows, '
                  'central pediment with clock, high wall gate, whole building visible', 896, 704, 51),
    'pump':      ('a single Victorian cast iron street water pump, tall fluted column, curved pump handle on the left side, '
                  'spout on the right, small stone base, whole object visible, product photo', 512, 896, 61),
}


def cut_white(img: Image.Image) -> Image.Image:
    """테두리에서 이어진 흰 배경만 지운다 (건물 안의 흰 창틀은 남는다)"""
    a = np.array(img.convert('RGB')).astype(np.int16)
    light = (a.min(axis=2) > 222) & (np.ptp(a, axis=2) < 26)
    lab, _ = ndi.label(light)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bg = ndi.binary_opening(bg, iterations=1)
    alpha = (~bg).astype(np.float32)
    alpha = ndi.gaussian_filter(alpha, 0.8)
    out = np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(alpha > 0.5)
    return Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def touches_edge(img: Image.Image) -> bool:
    a = np.array(img.convert('RGB')).astype(np.int16)
    light = (a.min(axis=2) > 222) & (np.ptp(a, axis=2) < 26)
    # 위·왼쪽·오른쪽 테두리 대부분이 배경이어야 대상이 그림 안에 온전히 들었다
    return min(light[0].mean(), light[:, 0].mean(), light[:, -1].mean()) < 0.85


def main(specs):
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True)
    pipe.to('cuda')
    RAW.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        name, _, override = spec.partition(':')
        desc, w, h, seed = ITEMS[name]
        seed = int(override) if override else seed
        for i in range(8):
            s = seed + i * 7919
            img = pipe(f'{desc}, {STYLE}', negative_prompt=NEG, width=w, height=h, num_inference_steps=30, guidance_scale=7,
                       generator=torch.Generator('cuda').manual_seed(s)).images[0]
            if not touches_edge(img):
                break
            print(f'  {name} 시드 {s}: 테두리에 닿음, 다시 뽑는다')
        img.save(RAW / f'{name}.png')
        print(f'  {name}: 시드 {s}')
        export(name)


def export(name):
    cut = cut_white(Image.open(RAW / f'{name}.png'))
    if name == 'pump':
        h = 320
        cut.resize((round(cut.width * h / cut.height), h), Image.LANCZOS).save(ASSETS / 'pump.webp', quality=90, method=6)
        # 손잡이를 뗀 모습: 기둥 왼쪽(손잡이 쪽)을 지운다
        a = np.array(cut)
        col = (a[..., 3] > 128).sum(axis=0)
        core = np.nonzero(col > col.max() * 0.55)[0]          # 기둥이 차지하는 가로 범위
        a[: int(a.shape[0] * 0.85), : max(0, core.min() - 2), 3] = 0
        nh = Image.fromarray(a)
        nh.resize((round(nh.width * h / nh.height), h), Image.LANCZOS).save(ASSETS / 'pump_no_handle.webp', quality=90, method=6)
    else:
        h = 420
        cut.resize((round(cut.width * h / cut.height), h), Image.LANCZOS).save(ASSETS / 'houses' / f'house_{name}.webp', quality=90, method=6)


def sheet():
    tiles = [Image.open(ASSETS / 'houses' / f'house_{n}.webp').convert('RGBA') for n in ('terrace', 'brewery', 'factory', 'workhouse')]
    tiles += [Image.open(ASSETS / f).convert('RGBA') for f in ('pump.webp', 'pump_no_handle.webp')]
    out = Image.new('RGBA', (sum(t.width for t in tiles) + 10 * len(tiles) + 10, 440), (224, 206, 168, 255))
    x = 10
    for t in tiles:
        out.alpha_composite(t, (x, 440 - t.height - 10))
        x += t.width + 10
    out.convert('RGB').save(RAW / '_sheet.png')
    print('모아 보기:', RAW / '_sheet.png')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--sheet']
    if '--sheet' not in sys.argv:
        main(args or list(ITEMS))
    sheet()
