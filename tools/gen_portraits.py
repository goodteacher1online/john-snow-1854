# -*- coding: utf-8 -*-
"""면담 상대 16명의 흉상을 한 화풍으로 생성한다 (Stable Diffusion, 로컬 GPU).

  <diffusers 가 깔린 파이썬> tools/gen_portraits.py [이름 ...]      # 이름을 주면 그 인물만 다시
  <같은 파이썬> tools/gen_portraits.py --sheet                       # 생성 없이 모아 보기만

원본은 tools/source/portraits_gen/<이름>.png (배경 포함)로 남기고,
배경을 지운 게임용 그림은 public/assets/portraits/<이름>.webp 로 내보낸다.
모두 지어낸 얼굴이며 실존 인물의 초상이 아니다.
"""
import sys
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'tools' / 'source' / 'portraits_gen'
OUT = ROOT / 'public' / 'assets' / 'portraits'
import os
# 모델 폴더(직접 받아 둔 diffusers 형식)나 허깅페이스 모델 이름
MODEL = os.environ.get('SD_MODEL', 'Lykon/dreamshaper-8')

STYLE = ('half-length portrait, head and full shoulders and chest in frame, centered, facing the viewer, '
         'London 1854, early Victorian working clothes, plain flat pale grey studio background, '
         'realistic detailed digital painting, soft even light, muted natural colors, sharp focus')
NEG = ('cropped head, out of frame, hands, fingers, text, watermark, signature, frame, border, vignette, oval, '
       'modern clothing, glasses reflection, deformed, disfigured, extra limbs, blurry, cartoon, anime, 3d render, '
       'photo studio props, hat brim cut off, smiling broadly, makeup')

# 이름: (설명, 시드)
PEOPLE = {
    'sarah':     ('a tired grieving young mother aged 28, pale face, brown hair under a plain white cotton cap, dark plain dress, grey wool shawl', 11),
    'ned':       ("a thin 17 year old tailor's apprentice boy, anxious look, dark tousled hair, waistcoat over a collarless shirt, measuring tape around his neck", 23),
    'maryann':   ('a sturdy 42 year old washerwoman, weathered kind face, hair tied in a faded blue headscarf, sleeves rolled, coarse linen apron', 31),
    'keeper':    ('a careful 50 year old woman who keeps a coffee shop, auburn hair in a bun under a small lace cap, dark green dress with a clean white apron', 44),
    'sam':       ('a broad 45 year old blacksmith, dark full beard, soot on his cheeks, heavy leather apron over a rough shirt, stern grieving eyes', 52),
    'huggins':   ('a stout prosperous 58 year old brewery owner, ruddy face, grey side whiskers, brown frock coat, patterned waistcoat and a cravat', 61),
    'master':    ('a thin stern 52 year old workhouse master, clean shaven, small round spectacles, black coat buttoned high, stiff white collar', 77),
    'scholar':   ('a thoughtful 50 year old gentleman naturalist, receding dark hair, dark sideburns, olive green coat, silk cravat, intelligent eyes', 85),
    'foreman':   ('a 38 year old factory foreman, brown moustache, flat cap, grey waistcoat over a shirt with sleeves rolled, worried look', 93),
    'jack':      ('a 20 year old street porter, freckled face, sandy hair under a cloth cap, red neckerchief, worn brown jacket, hollow sad eyes', 104),
    'ellen':     ('a 35 year old mother in mourning, red eyes from crying, black bonnet tied under the chin, black shawl over a dark dress', 118),
    'abe':       ('a 72 year old retired coachman, deeply wrinkled friendly face, white whiskers, old faded blue greatcoat, knitted scarf', 126),
    'harriet':   ('a refined wealthy 62 year old lady, silver hair in a neat bun, lavender silk dress with a lace collar and a cameo brooch', 137),
    'hugh':      ('a 40 year old butcher, round red face, short black hair, blue and white striped apron over a white shirt, bowler hat', 149),
    'chairman':  ('an authoritative 66 year old parish chairman, white hair, heavy white eyebrows, black frock coat, gold watch chain, doubtful frown', 158),
    'physician': ('a 46 year old physician, dark trimmed beard, serious sceptical face, black coat, dark cravat, high white collar', 163),
}


def generate(names):
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    from rembg import remove, new_session

    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
    pipe.to('cuda')
    session = new_session('u2net_human_seg')
    RAW.mkdir(parents=True, exist_ok=True)
    for name in names:
        desc, seed = PEOPLE[name]
        img = pipe(f'{desc}, {STYLE}', negative_prompt=NEG, width=576, height=704, num_inference_steps=28,
                   guidance_scale=6.5, generator=torch.Generator('cuda').manual_seed(seed)).images[0]
        img.save(RAW / f'{name}.png')
        cut = remove(img, session=session, post_process_mask=True)
        cut.resize((round(cut.width * 640 / cut.height), 640), Image.LANCZOS).save(OUT / f'{name}.webp', quality=88, method=6)
        print('  생성', name)


def sheet():
    names = [n for n in PEOPLE if (OUT / f'{n}.webp').exists()]
    ims = [Image.open(OUT / f'{n}.webp').convert('RGBA').resize((262, 320)) for n in names]
    cols = 8
    out = Image.new('RGBA', (cols * 266, ((len(ims) + cols - 1) // cols) * 324), (236, 224, 196, 255))
    for i, im in enumerate(ims):
        out.alpha_composite(im, ((i % cols) * 266 + 2, (i // cols) * 324 + 2))
    out.convert('RGB').save(RAW / '_sheet.png')
    print('모아 보기:', RAW / '_sheet.png')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--sheet' not in args:
        generate(args or list(PEOPLE))
    sheet()
