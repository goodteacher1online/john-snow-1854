# -*- coding: utf-8 -*-
"""영역 집 주민의 흉상을, 이미 잘 나온 기본 인물을 바탕으로 머리 모양과 옷만 바꿔 그린다
(Stable Diffusion img2img, 로컬 GPU). 처음부터 그리는 것보다 빠르고, 구도가 기본 인물과 같아
머리나 어깨가 잘리지 않는다.

  <diffusers 가 깔린 파이썬> tools/gen_residents.py            # 그림이 없는 주민 모두
  <같은 파이썬> tools/gen_residents.py d61 d72:1234             # 일부, 이름:시드 로 다시 뽑기

기본 인물: tools/source/portraits_gen/<이름>.png 가운데 잘리지 않은 흉상 (성별과 나이대가 맞는 것)
주민 설정: src/data/district_people.json (desc, female, age)
"""
import os
import re
import sys
import json
from pathlib import Path
from PIL import Image
from frame_portraits import frame, edge_cut, RAW, CUT, OUT, SEEDS

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
MODEL = os.environ.get('SD_MODEL', 'Lykon/dreamshaper-8')
STRENGTH = 0.58          # 기본 인물에서 얼마나 바꿀지 (높을수록 다른 사람)

STYLE = 'symmetrical front-facing bust portrait, eyes looking at camera, 1850s London, plain light grey background, realistic digital painting, soft light, muted colors'
NEG = ('looking away, head turned, profile, two people, monochrome, hands, cropped head, text, watermark, frame, border, '
       'modern clothing, deformed, blurry, cartoon, anime, 3d render, makeup, smiling')

# 기본 인물로 쓸 흉상 (면담 상대 16명과 처음 40명의 주민). 조사관(inv_*)은 플레이어 얼굴이라 쓰지 않는다
FEMALE_WORDS = ('woman', 'lady', 'mother', 'girl', 'widow', 'washerwoman', 'seamstress', 'milliner', 'landlady', 'housemaid')


def person_meta(desc: str):
    female = any(w in desc for w in FEMALE_WORDS)
    m = re.search(r'(\d+) year', desc)
    return female, int(m.group(1)) if m else 40


def bracket(age: int) -> int:
    return 0 if age < 34 else 1 if age < 52 else 2


def bases():
    """(이름, 여성?, 나이대) 목록. 원본이 잘리지 않은 것만"""
    import gen_portraits
    out = []
    for name, (desc, _) in gen_portraits.PEOPLE.items():
        if name.startswith('player_') or name in ('chairman', 'physician'):
            continue
        raw, cut = RAW / f'{name}.png', CUT / f'{name}.png'
        if not raw.exists() or not cut.exists() or edge_cut(Image.open(cut).convert('RGBA')):
            continue
        female, age = person_meta(desc)
        out.append((name, female, bracket(age)))
    return out


def main(args):
    import torch
    from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler
    from rembg import remove, new_session

    people = json.loads((ROOT / 'src' / 'data' / 'district_people.json').read_text(encoding='utf-8'))['people']
    by_id = {p['id']: p for p in people}
    pool = bases()
    print(f'기본 인물 {len(pool)}명:', ', '.join(n for n, *_ in pool))
    specs = [a for a in args if not a.startswith('--')] or [p['id'] for p in people if not (OUT / f"r_{p['id']}.webp").exists()]
    if not specs:
        print('새로 그릴 주민이 없다')
        return

    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True)
    pipe.to('cuda')
    session = new_session('u2net_human_seg')
    seeds = json.loads(SEEDS.read_text(encoding='utf-8')) if SEEDS.exists() else {}

    for k, spec in enumerate(specs):
        pid, _, override = spec.partition(':')
        p = by_id[pid]
        name = f'r_{pid}'
        female = p.get('female', person_meta(p['desc'])[0])
        age = p.get('age', person_meta(p['desc'])[1])
        # 성별과 나이대가 같은 기본 인물을 돌아가며 쓴다 (같은 얼굴이 몰리지 않게)
        same = [b for b in pool if b[1] == female and b[2] == bracket(age)] or [b for b in pool if b[1] == female]
        base = same[int(pid[1:]) % len(same)][0]
        init = Image.open(RAW / f'{base}.png').convert('RGB').resize((768, 768))
        seed = int(override) if override else seeds.get(name, p['seed'])
        for i in range(6):
            s = seed + i * 7919
            img = pipe(f"{p['desc']}, {STYLE}", image=init, strength=STRENGTH, negative_prompt=NEG, num_inference_steps=30,
                       guidance_scale=7, generator=torch.Generator('cuda').manual_seed(s)).images[0]
            cut = remove(img, session=session, post_process_mask=True)
            bad = edge_cut(cut)
            if not bad:
                break
        img.save(RAW / f'{name}.png')
        cut.save(CUT / f'{name}.png')
        seeds[name] = s
        SEEDS.write_text(json.dumps(seeds, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'  [{k + 1}/{len(specs)}] {name} ← {base}', frame(name), f'[{bad} 잘림]' if bad else '')


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).parent))
    main(sys.argv[1:])
