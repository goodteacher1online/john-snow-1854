# -*- coding: utf-8 -*-
"""플레이어가 고르는 조사관 12명을 만든다. 사람마다 상반신(면담 화면·입장 화면)과
전신(지도 위 인물)을 같은 옷차림으로 그린다 (Stable Diffusion, 로컬 GPU).

  <diffusers 가 깔린 파이썬> tools/gen_investigators.py            # 전부
  <같은 파이썬> tools/gen_investigators.py f2 m3:1234              # 일부, 이름:시드 로 다시 뽑기
  <같은 파이썬> tools/gen_investigators.py --body m3:1234          # 전신만 다시
  <같은 파이썬> tools/gen_investigators.py --bust f4:1234          # 상반신만 다시

상반신: tools/source/portraits_gen/(cut/)inv_<id>.png → public/assets/portraits/inv_<id>.webp (frame_portraits 로 크기 맞춤)
전신:   tools/source/characters_gen/inv_<id>.png → public/assets/characters/inv_<id>.webp
모두 지어낸 인물이다.
"""
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from frame_portraits import frame, generate_clean, chosen_seed

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
RAW_BUST = ROOT / 'tools' / 'source' / 'portraits_gen'
RAW_BODY = ROOT / 'tools' / 'source' / 'characters_gen'
OUT_BODY = ROOT / 'public' / 'assets' / 'characters'
MODEL = os.environ.get('SD_MODEL', 'Lykon/dreamshaper-8')

STYLE = '1850s London, plain light grey background, realistic digital painting, soft light, muted colors'
BUST = 'symmetrical front-facing bust portrait, head straight, eyes looking at camera, both shoulders fully visible, upper chest,'
# 지도 위에서 걷는 방향이 보이도록 오른쪽을 보고 걷는 옆모습으로 그린다 (왼쪽으로 걸을 때는 뒤집어 쓴다)
BODY = 'side view full body of one person walking to the right, profile facing right, whole figure from head to shoes, small figure,'
NEG_BUST = ('looking away, head turned, three-quarter view, profile, monochrome, full body, hands, cropped head, text, watermark, '
            'frame, border, vignette, modern clothing, deformed, blurry, cartoon, anime, 3d render, smiling')
NEG_BODY = ('cropped, close-up, bust, cut off feet, cut off head, two people, crowd, sitting, front view, facing camera, facing viewer, facing left, back view, short skirt, '
            'monochrome, text, watermark, frame, modern clothing, deformed, extra limbs, blurry, cartoon, anime, 3d render')

# 상반신이 전신과 다르게 나오기 쉬운 것 (모자, 수염 따위)을 사람마다 따로 막는다
EXTRA_NEG = {
    'm1': 'beard, moustache, stubble',
    'm3': 'hair on top of head, dark hair, dark beard, hat',
    'm4': 'hat, cap, woman, feminine face, girl',
    'm5': 'bare head, no hat',
    'm6': 'hat, top hat, cap',
}

# id: (사람, 옷차림, 상반신 시드, 전신 시드). 옷차림은 두 그림에 똑같이 쓴다
INVESTIGATORS = {
    'f1': ('calm determined 27 year old woman, brown hair in a low bun', 'plain navy high-neck dress with small white collar', 611, 1001),
    'f2': ('lively 22 year old woman, red hair in a braid, freckles', 'moss green wool dress, cream knitted shawl', 1102, 4002),
    'f3': ('serious 34 year old woman, black hair, white cotton cap', 'dark grey dress, long white apron', 1103, 1003),
    'f4': ('kind 45 year old woman, auburn hair, straw bonnet', 'plum purple dress, brown cape', 1104, 1004),
    'f5': ('bright 25 year old woman, fair blonde hair in a low bun', 'long mustard yellow dress to the ankles, short brown jacket', 1105, 1005),
    'f6': ('wise 56 year old woman, grey hair in a bun, small spectacles', 'dark brown dress with lace collar', 1106, 4002),
    'm1': ('calm 30 year old man, slicked back dark hair, clean shaven face', 'buttoned dark navy frock coat, white high collar, black cravat', 706, 1011),
    'm2': ('cheerful 24 year old man, ginger hair, freckles', 'brown tweed jacket, green waistcoat, white shirt', 1112, 4001),
    'm3': ('stern 55 year old man, completely bald head, short grey white beard', 'grey frock coat, grey waistcoat, red cravat', 3413, 3113),
    'm4': ('eager 19 year old young man, masculine face, messy curly black hair, bare head', 'dark brown wool coat, cream knitted scarf, brown waistcoat', 1114, 4001),
    'm5': ('dignified 58 year old man, grey moustache, wearing a tall black top hat', 'black overcoat, black waistcoat, white shirt, black bow tie', 1115, 1015),
    'm6': ('thoughtful 30 year old Black man, short black hair, full black beard, bare head', 'dark green frock coat, cream waistcoat, white shirt, black cravat', 1116, 1016),
}


def main(args):
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    from rembg import remove, new_session

    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True)
    pipe.to('cuda')
    session = new_session('u2net_human_seg')
    for d in (RAW_BUST / 'cut', RAW_BODY, OUT_BODY):
        d.mkdir(parents=True, exist_ok=True)

    body_only = '--body' in args
    bust_only = '--bust' in args
    names = [a for a in args if not a.startswith('--')] or list(INVESTIGATORS)
    for spec in names:
        iid, _, override = spec.partition(':')
        who, outfit, bust_seed, body_seed = INVESTIGATORS[iid]
        name = f'inv_{iid}'
        gen = lambda s: torch.Generator('cuda').manual_seed(s)
        if not body_only:
            seed = int(override) if override else chosen_seed(name, bust_seed)
            neg = NEG_BUST + (', ' + EXTRA_NEG[iid] if iid in EXTRA_NEG else '')
            bad = generate_clean(pipe, session, name, f'{BUST} {who}, {outfit}, {STYLE}, small head, chest visible', neg, seed)
            if bad:
                print(f'  [{name}] 여러 번 뽑아도 {bad} 잘림')
            print('  상반신', frame(name))
        if bust_only:
            continue
        img = pipe(f'{BODY} {who}, {outfit}, {STYLE}', negative_prompt=NEG_BODY, width=512, height=896,
                   num_inference_steps=28, guidance_scale=7, generator=gen(int(override) if override and body_only else body_seed)).images[0]
        img.save(RAW_BODY / f'{name}.png')
        cut = remove(img, session=session, post_process_mask=True)
        a = np.array(cut)[..., 3]
        ys, xs = np.nonzero(a > 40)
        whole = ys.min() > 4 and ys.max() < a.shape[0] - 4          # 머리와 발이 그림 안에 다 들었나
        cut = cut.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        cut.resize((round(cut.width * 360 / cut.height), 360), Image.LANCZOS).save(OUT_BODY / f'{name}.webp', quality=90, method=6)
        print(f'  전신 {name}', '정상' if whole else '[머리나 발이 잘림, 다시 뽑기]')


def sheet():
    """상반신과 전신을 나란히 모아 본다"""
    tiles = []
    for iid in INVESTIGATORS:
        bust = ROOT / 'public' / 'assets' / 'portraits' / f'inv_{iid}.webp'
        body = OUT_BODY / f'inv_{iid}.webp'
        if not (bust.exists() and body.exists()):
            continue
        t = Image.new('RGBA', (300, 300), (236, 224, 196, 255))
        b = Image.open(bust).convert('RGBA').resize((180, 173))
        f = Image.open(body).convert('RGBA')
        f = f.resize((round(f.width * 290 / f.height), 290))
        t.alpha_composite(b, (0, 120))
        t.alpha_composite(f, (300 - f.width - 10, 5))
        tiles.append(t)
    out = Image.new('RGB', (6 * 304, ((len(tiles) + 5) // 6) * 304), (40, 30, 20))
    for i, t in enumerate(tiles):
        out.paste(t.convert('RGB'), ((i % 6) * 304 + 2, (i // 6) * 304 + 2))
    out.save(RAW_BODY / '_sheet.png')
    print('모아 보기:', RAW_BODY / '_sheet.png')


if __name__ == '__main__':
    if '--sheet' not in sys.argv:
        main(sys.argv[1:])
    sheet()
