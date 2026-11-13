# -*- coding: utf-8 -*-
"""흉상마다 얼굴과 옷차림을 따로 잘라, 남자로 보이는지 여자로 보이는지 CLIP 으로 재고
설정된 성별과 어긋나는 그림을 찾는다 (여자 옷차림에 남자 얼굴 같은 합성 실수).

  python tools/audit_gender.py            # 전부 검사, 어긋난 이름을 tools/source/portraits_gen/gender_bad.txt 에
"""
import sys, json, re
from pathlib import Path
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from frame_portraits import RAW, OUT, find_face

ROOT = Path(__file__).resolve().parent.parent
FEMALE_WORDS = ('woman', 'lady', 'mother', 'girl', 'widow', 'washerwoman', 'seamstress', 'milliner', 'landlady', 'housemaid')


def expected():
    """이름 → 여성인가 (설정 기준)"""
    out = {}
    for p in json.loads((ROOT / 'src' / 'data' / 'district_people.json').read_text(encoding='utf-8'))['people']:
        out[f"r_{p['id']}"] = p.get('female', any(w in p['desc'] for w in FEMALE_WORDS))
    import gen_portraits
    for n, (desc, _) in gen_portraits.PEOPLE.items():
        if not n.startswith('r_'):
            out[n] = any(re.search(rf'\b{w}\b', desc) for w in FEMALE_WORDS)
    import gen_investigators
    for iid in gen_investigators.INVESTIGATORS:
        out[f'inv_{iid}'] = iid.startswith('f')
    return out


def main():
    import torch
    from transformers import CLIPModel, CLIPProcessor
    model = CLIPModel.from_pretrained('openai/clip-vit-large-patch14').eval()
    proc = CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14')
    face_txt = ["a close-up photo of a man's face", "a close-up photo of a woman's face"]
    body_txt = ["men's clothing: a coat, waistcoat, shirt and cravat", "women's clothing: a dress, blouse, shawl or bonnet"]
    with torch.no_grad():
        tf = model.get_text_features(**proc(text=face_txt + body_txt, return_tensors='pt', padding=True))
        tf = tf / tf.norm(dim=-1, keepdim=True)

    def p_female(img, texts):
        with torch.no_grad():
            f = model.get_image_features(**proc(images=img, return_tensors='pt'))
            f = f / f.norm(dim=-1, keepdim=True)
            logits = 100 * f @ texts.T
            return float(logits.softmax(-1)[0, 1])

    want = expected()
    bad, rows = [], []
    names = sorted(p.stem for p in OUT.glob('*.webp'))
    for k, n in enumerate(names):
        if n not in want or not (RAW / f'{n}.png').exists():
            continue
        raw = Image.open(RAW / f'{n}.png').convert('RGB')
        fc = find_face(raw)
        if not fc:
            continue
        cx, cy, fw = fc
        face = raw.crop((int(cx - fw * 0.75), int(cy - fw * 0.9), int(cx + fw * 0.75), int(cy + fw * 0.8)))
        body = raw.crop((0, int(min(raw.height - 40, cy + fw * 0.9)), raw.width, raw.height))
        pf, pb = p_female(face, tf[:2]), p_female(body, tf[2:])
        w = want[n]
        # 얼굴이나 옷차림이 설정과 반대로 뚜렷하면 문제로 본다
        wrong_face = (pf < 0.3) if w else (pf > 0.7)
        wrong_body = (pb < 0.3) if w else (pb > 0.7)
        if wrong_face or wrong_body:
            bad.append(n)
            rows.append(f"  {n:22s} 설정 {'여' if w else '남'}  얼굴 여성 {pf:.2f}  옷 여성 {pb:.2f}  " + ('얼굴' if wrong_face else '') + (' 옷' if wrong_body else ''))
        if k % 50 == 0:
            print(f'  ... {k}/{len(names)}', flush=True)
    print('\n'.join(rows))
    print(f'어긋난 그림 {len(bad)}개')
    (RAW / 'gender_bad.txt').write_text(' '.join(bad) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
