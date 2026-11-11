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
from frame_portraits import frame

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'tools' / 'source' / 'portraits_gen'
OUT = ROOT / 'public' / 'assets' / 'portraits'
import os
# 모델 폴더(직접 받아 둔 diffusers 형식)나 허깅페이스 모델 이름
MODEL = os.environ.get('SD_MODEL', 'Lykon/dreamshaper-8')

# CLIP 은 77 토큰까지만 읽으므로 구도를 맨 앞에, 설명은 짧게 쓴다
FRAME = 'symmetrical front-facing bust portrait, head straight, eyes looking at camera, both shoulders fully visible, upper chest,'
STYLE = '1850s London, plain light grey background, realistic digital painting, soft light, muted colors'
NEG = ('looking away, looking down, head turned, three-quarter view, tilted head, monochrome, grayscale, profile, side view, teenager, child, full body, waist, hands, arms crossed, bare shoulders, cleavage, cropped head, text, watermark, frame, border, '
       'vignette, modern clothing, deformed, blurry, cartoon, anime, 3d render, makeup, jewelry, smiling')

# 이름: (설명, 시드)
PEOPLE = {
    'sarah':     ('sad pale tired woman aged 32, brown hair, plain white cotton cap, dark grey high-neck dress, brown wool shawl', 212),
    'ned':       ('thin anxious 17 year old apprentice boy, dark messy hair, grey waistcoat, collarless shirt', 23),
    'maryann':   ('sturdy 42 year old washerwoman, weathered kind face, faded blue headscarf, coarse linen dress and apron', 31),
    'keeper':    ('middle-aged 52 year old shopkeeper woman, lined face, greying auburn hair in a bun, lace cap, dark green dress, white apron', 503),
    'sam':       ('broad 45 year old blacksmith, dark full beard, sooty face, leather apron over rough shirt, stern sad eyes', 52),
    'huggins':   ('stout 60 year old rich brewer, ruddy round face, bald, grey side whiskers, brown frock coat, cravat', 61),
    'master':    ('thin stern 52 year old workhouse master, clean shaven, grey hair, small round spectacles, dark navy coat, white collar, color painting', 501),
    'scholar':   ('thoughtful 50 year old gentleman naturalist, receding dark hair, sideburns, olive green coat, silk cravat', 85),
    'foreman':   ('38 year old factory foreman, brown moustache, flat cap, grey waistcoat, white shirt, worried look', 93),
    'jack':      ('20 year old street porter, freckled face, sandy hair, cloth cap, red neckerchief, worn brown jacket, sad eyes', 104),
    'ellen':     ('35 year old grieving mother, red tired eyes, black bonnet tied under chin, black shawl, dark dress', 118),
    'abe':       ('72 year old retired coachman, deeply wrinkled friendly face, white whiskers, old blue greatcoat, knitted scarf', 126),
    'harriet':   ('refined 62 year old wealthy lady, silver hair in a neat bun, lavender silk high-neck dress, lace collar', 137),
    'hugh':      ('burly 42 year old man, thick neck, ruddy face, dark moustache, short dark hair, white shirt, dark navy apron with thin stripes', 431),
    'player_female_bust': ('calm determined 27 year old woman investigator, brown hair in a low bun, plain navy high-neck dress, small white collar', 611),
    'player_male_bust':   ('calm 30 year old man investigator, short dark hair, clean shaven, buttoned dark navy frock coat, white high collar, black silk cravat', 706),
    'chairman':  ('stern 66 year old parish chairman, white hair, heavy eyebrows, dark charcoal frock coat, burgundy cravat, doubtful frown', 502),
    'physician': ('46 year old physician, brown trimmed beard, sceptical face, dark brown coat, grey cravat, white collar, color painting', 364),
}


def generate(names):
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    from rembg import remove, new_session

    pipe = StableDiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16, variant='fp16', safety_checker=None)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='dpmsolver++', use_karras_sigmas=True)
    pipe.to('cuda')
    session = new_session('u2net_human_seg')
    RAW.mkdir(parents=True, exist_ok=True)
    for name in names:
        name, _, override = name.partition(':')
        desc, seed = PEOPLE[name]
        seed = int(override) if override else seed
        img = pipe(f'{FRAME} {desc}, {STYLE}', negative_prompt=NEG, width=768, height=704, num_inference_steps=28,
                   guidance_scale=6.5, generator=torch.Generator('cuda').manual_seed(seed)).images[0]
        img.save(RAW / f'{name}.png')
        cut = remove(img, session=session, post_process_mask=True)
        (RAW / 'cut').mkdir(exist_ok=True)
        cut.save(RAW / 'cut' / f'{name}.png')
        print('  ', frame(name))                      # 얼굴 크기와 위치를 다른 인물과 맞춘다
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
