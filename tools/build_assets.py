# -*- coding: utf-8 -*-
"""1854 스노우 고지도(snow_map.jpg)에서 게임용 에셋을 만든다.

  python tools/build_assets.py            # 전부
  python tools/build_assets.py map        # 지도·보행 마스크·도보권역만
  python tools/build_assets.py sprites    # 초상화·캐릭터·펌프 최적화만

산출물 (public/assets):
  soho_map.webp     사망자 막대를 지운 3배 해상도 채색 지도 (플레이어가 막대를 직접 채워 넣는다)
  walk_mask.png     거리=보행 가능. 픽셀값은 벽까지의 거리(경로가 길 한가운데로 나도록)
  catchment.png     걸어서 브로드 가 펌프가 가장 가까운 거리(스노우의 두 번째 지도와 같은 원리)
  portraits/*.webp, characters/*.webp, pump*.webp, houses/*.webp
산출물 (src/data): geo.gen.json  — 문 위치를 거리 위로 보정한 좌표와 가장 가까운 펌프
"""
import sys, json, heapq
from pathlib import Path
import numpy as np, cv2
from scipy import ndimage as ndi
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public' / 'assets'
SRC = ROOT / 'tools' / 'source'      # 원본(고지도·고해상도 PNG) 보관소
DATA = ROOT / 'src' / 'data'
UP = 3                               # 지도 확대 배율
K3 = np.ones((3, 3), bool)


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def street_mask(g):
    """블록 윤곽선만 남기고(글자·점선 제거) 브로드 가에서 번져 나가 거리를 찾는다."""
    dark = g < 215
    lab, n = ndi.label(dark, K3)
    small = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) < 26:
            small[i] = True
    outline = dark & ~small[lab]
    # 원본 석판에서 선이 끊겨 블록 안으로 새는 곳을 손으로 막는다
    patch = np.zeros(g.shape, np.uint8)
    for pts, closed in (
        ([(699, 171), (716, 187)], False),
        ([(694, 299), (703, 318)], False),
        ([(793, 522), (827, 505), (854, 563), (821, 583)], True),   # 양조장
        ([(463, 493), (493, 475), (510, 501), (480, 521)], True),
    ):
        cv2.polylines(patch, [np.array(pts, np.int32)], closed, 1, 2)
    outline |= patch > 0
    # 폭 5px 미만 틈으로는 번지지 않게 한다
    dist = ndi.distance_transform_edt(~outline)
    lab, _ = ndi.label(dist >= 2.5)
    street = ndi.binary_dilation(lab == lab[556, 700], K3, iterations=4, mask=~outline)
    street |= ndi.binary_closing(street, K3)
    # 윤곽선에 붙어 벽으로 잡힌 글자(브로드 가 펌프 옆 'PU')를 길로 되돌린다
    carve = np.zeros(g.shape, np.uint8)
    cv2.fillPoly(carve, [np.array([(713, 541), (732, 535), (735, 549), (722, 557), (712, 552)], np.int32)], 1)
    return street | (carve > 0)


def clean_ink(g, street):
    """블록 안쪽의 사망자 막대와 글자를 지운 잉크 농도(0~1)."""
    dark = g < 215
    band = ndi.binary_dilation(street, K3, iterations=2)
    inner = ~band
    bars = ndi.binary_opening(g < 100, np.ones((2, 2), bool))
    bars = ndi.binary_dilation(bars, K3)
    cand = dark & inner & ~bars
    lab, n = ndi.label(cand, K3)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if max(h, w) >= 28 and (lab[sl] == i).sum() < 0.35 * h * w:
            keep[i] = True     # 길고 가는 선 = 건물 윤곽
    ink = np.clip((235.0 - g) / 150.0, 0, 1)
    ink[inner & ~keep[lab]] = 0
    return ink


def build_map():
    g = cv2.imread(str(SRC / 'snow_map.jpg'), cv2.IMREAD_GRAYSCALE)
    H, W = g.shape
    street = street_mask(g)
    wall_dist = ndi.distance_transform_edt(street)
    mask = np.where(street, np.clip(np.round(wall_dist * 36), 1, 255), 0).astype(np.uint8)
    cv2.imwrite(str(ASSETS / 'walk_mask.png'), mask)

    ink = clean_ink(g, street)
    size = (W * UP, H * UP)
    ink3 = smoothstep(cv2.resize(ink.astype(np.float32), size, interpolation=cv2.INTER_CUBIC), 0.2, 0.55)
    s3 = smoothstep(cv2.resize(street.astype(np.float32), size, interpolation=cv2.INTER_LINEAR), 0.3, 0.7)
    edge = np.exp(-ndi.distance_transform_edt(~street) / 4.0).astype(np.float32)
    edge3 = cv2.resize(edge, size, interpolation=cv2.INTER_LINEAR)

    rng = np.random.default_rng(1854)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (size[1], size[0])).astype(np.float32), (0, 0), 1.2) * 5
    blot = cv2.resize(cv2.GaussianBlur(rng.normal(0, 1, (H // 8, W // 8)).astype(np.float32), (0, 0), 6), size) * 60

    STREET = np.array([246, 239, 220], np.float32)     # 밝은 길
    BLOCK = np.array([224, 206, 168], np.float32)      # 건물 블록
    INK = np.array([44, 32, 22], np.float32)
    s = s3[..., None]
    rgb = STREET * s + BLOCK * (1 - s)
    rgb -= (edge3 * (1 - s3))[..., None] * 26           # 블록 가장자리 음영
    rgb += (grain + blot)[..., None]
    rgb = rgb * (1 - ink3[..., None]) + INK * ink3[..., None]
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(ASSETS / 'soho_map.webp', quality=80, method=6)
    Image.open(SRC / 'snow_map.jpg').save(ASSETS / 'snow_map_1854.webp', quality=80, method=6)

    # ---- 문 위치 보정 + 도보 최단거리 권역 ----
    geo = json.loads((DATA / 'geo.json').read_text(encoding='utf-8'))
    ys, xs = np.nonzero(wall_dist >= 2.0)

    def snap(p):
        i = int(np.argmin((xs - p[0]) ** 2 + (ys - p[1]) ** 2))
        return [int(xs[i]), int(ys[i])]

    pump_ids = list(geo['pumps'])
    owner = np.full((H, W), -1, np.int16)
    best = np.full((H, W), np.inf, np.float32)
    heap = []
    for i, pid in enumerate(pump_ids):
        x, y = snap(geo['pumps'][pid])
        best[y, x] = 0
        heap.append((0.0, x, y, i))
    heapq.heapify(heap)
    NB = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142)]
    while heap:
        d, x, y, i = heapq.heappop(heap)
        if d > best[y, x] or owner[y, x] >= 0:
            continue
        owner[y, x] = i
        for dx, dy, c in NB:
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and street[ny, nx] and d + c < best[ny, nx]:
                best[ny, nx] = d + c
                heapq.heappush(heap, (d + c, nx, ny, i))

    broad = owner == pump_ids.index('broad')
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[broad] = (215, 25, 33, 84)
    rim = broad & ndi.binary_dilation((owner >= 0) & ~broad, K3)
    rgba[rim] = (215, 25, 33, 230)
    Image.fromarray(rgba).save(ASSETS / 'catchment.png', optimize=True)

    out = {'size': [W, H], 'pumps': {k: snap(v) for k, v in geo['pumps'].items()}, 'miasma': geo['miasma'], 'sites': {}}
    for sid, s_ in geo['sites'].items():
        door = snap(s_['door'])
        near = pump_ids[int(owner[door[1], door[0]])]
        out['sites'][sid] = {'door': door, 'icon': s_['icon'], 'nearestPump': near}
        moved = np.hypot(door[0] - s_['door'][0], door[1] - s_['door'][1])
        warn = '  [아이콘이 길 위!]' if street[s_['icon'][1], s_['icon'][0]] else ''
        print(f"  {sid:12s} 문 {s_['door']} -> {door} (보정 {moved:.1f}px)  가장 가까운 펌프: {near}{warn}")
    (DATA / 'geo.gen.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('지도 완료:', (ASSETS / 'soho_map.webp').stat().st_size // 1024, 'KB, 거리 픽셀', int(street.sum()))


def fill_holes(im):
    """배경 제거 과정에서 뚫린 인물 안쪽 구멍(흰 옷깃·앞치마)을 다시 메운다."""
    a = np.array(im).astype(np.float32)
    alpha = a[..., 3:] / 255.0
    inner = ndi.binary_erosion(ndi.binary_fill_holes(alpha[..., 0] > 0.16), iterations=2)
    white = np.array([242, 238, 230], np.float32)
    a[inner, :3] = (a[..., :3] * alpha + white * (1 - alpha))[inner]
    a[inner, 3] = 255
    return Image.fromarray(a.astype(np.uint8))


def save_h(im, height, path, q=86):
    w = round(im.width * height / im.height)
    im.resize((w, height), Image.LANCZOS).save(path, quality=q, method=6)


def build_sprites():
    for sub in ('portraits', 'characters', 'houses'):
        (ASSETS / sub).mkdir(exist_ok=True)
    for name in ('npc_brewery', 'npc_resident_female', 'npc_resident_elder', 'npc_resident_youth',
                 'npc_wealthy_lady', 'npc_workhouse', 'player_female_bust', 'player_male_bust'):
        im = fill_holes(Image.open(SRC / 'portraits' / f'{name}.png').convert('RGBA'))
        save_h(im, 640, ASSETS / 'portraits' / f'{name}.webp')
    for name in ('player_male', 'player_female'):
        im = fill_holes(Image.open(SRC / 'characters' / f'{name}.png').convert('RGBA'))
        save_h(im, 360, ASSETS / 'characters' / f'{name}.webp', 90)
    for name in ('house_terrace', 'house_brewery', 'house_workhouse'):
        im = Image.open(SRC / 'houses' / f'{name}.png').convert('RGBA')
        save_h(im, min(360, im.height), ASSETS / 'houses' / f'{name}.webp', 90)
    pump = Image.open(SRC / 'pump_cast_iron.png').convert('RGBA')
    save_h(pump, 320, ASSETS / 'pump.webp', 90)
    a = np.array(pump)
    h, w = a.shape[:2]
    a[int(h * 0.20):int(h * 0.78), :int(w * 0.335), 3] = 0     # 손잡이(왼쪽 레버) 제거
    save_h(Image.fromarray(a), 320, ASSETS / 'pump_no_handle.webp', 90)
    print('스프라이트 완료')


if __name__ == '__main__':
    ASSETS.mkdir(parents=True, exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('all', 'map'):
        build_map()
    if what in ('all', 'sprites'):
        build_sprites()
