# -*- coding: utf-8 -*-
"""영역마다 맡아 조사할 집 8곳을 스노우의 지도에서 고른다.

  python tools/build_districts.py pick     # 후보를 골라 확대 그림을 만든다 (막대는 사람이 눈으로 센다)
  python tools/build_districts.py build    # 공개 자료(snow_deaths.gen.json)의 사망자 수를 합쳐 districts.gen.json 을 만든다

영역마다 막대(사망자)가 있는 집 5곳과 막대가 없는 집 3곳을 고르고, 사망자가 7명 넘는 큰 집은 빠짐없이 더한다.
사망자 수는 공개 자료(tools/build_snow_data.py 가 만든 snow_deaths.gen.json)에서 그 자리의 값을 쓴다.
문은 가장 가까운 길 위, 건물 그림은 막대가 있던 자리(블록 안쪽)에 둔다.
걸어서 가장 가까운 펌프는 build_assets.py 의 도보권역 계산과 같은 방식으로 구한다.
"""
import sys, json, heapq
from pathlib import Path
import numpy as np, cv2
from scipy import ndimage as ndi

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'source' / 'snow_map.jpg'
DATA = ROOT / 'src' / 'data'
OUT_PICK = ROOT / 'tools' / 'source' / 'districts'

AREAS = {   # story.ts 의 AREAS.start 와 같다
    'team1': (718, 556), 'team2': (690, 340), 'team3': (858, 410), 'team4': (505, 600), 'team5': (610, 800),
}
PER_AREA_DEATH, PER_AREA_CLEAR = 5, 3
SPACING = 46            # 집끼리, 그리고 이야기 14곳과 떨어질 거리(원본 픽셀)
# 집이 아닌 곳: 골든 스퀘어 광장(정원) 안
NOT_HOUSES = [(615, 780, 705, 875)]


def is_house_spot(x, y, pumps):
    if any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in NOT_HOUSES):
        return False
    return all((x - px) ** 2 + (y - py) ** 2 > 42 ** 2 for px, py in pumps)    # 펌프 점과 PUMP 글자를 막대로 잘못 잡지 않게


def load():
    g = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
    walk = cv2.imread(str(ROOT / 'public' / 'assets' / 'walk_mask.png'), cv2.IMREAD_GRAYSCALE)
    return g, walk


def bar_stacks(g, walk):
    """막대 묶음의 가운데와 크기. 길 위의 글자·펌프 점은 뺀다"""
    bars = ndi.binary_opening(g < 100, np.ones((2, 2), bool)) & ~ndi.binary_dilation(walk > 0, iterations=1)
    lab, _ = ndi.label(ndi.binary_dilation(bars, np.ones((5, 5), bool)))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        comp = (lab[sl] == i) & bars[sl]
        a = int(comp.sum())
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if a < 12 or a > 420 or max(h, w) > 40:      # 너무 큰 것은 건물 선이나 여러 집이 붙은 것
            continue
        ys, xs = np.nonzero(comp)
        out.append((int(xs.mean() + sl[1].start), int(ys.mean() + sl[0].start), a))
    return out, bars


def nearest_area(x, y):
    return min(AREAS, key=lambda k: (AREAS[k][0] - x) ** 2 + (AREAS[k][1] - y) ** 2)


def snap_street(walk, x, y, r=40):
    d = ndi.distance_transform_edt(walk > 0)
    best, bd = None, 1e9
    for yy in range(max(0, y - r), min(walk.shape[0], y + r)):
        for xx in range(max(0, x - r), min(walk.shape[1], x + r)):
            if d[yy, xx] >= 2.5:
                dd = (xx - x) ** 2 + (yy - y) ** 2
                if dd < bd:
                    bd, best = dd, (xx, yy)
    return best


def existing_points():
    geo = json.loads((DATA / 'geo.gen.json').read_text(encoding='utf-8'))
    pts = []
    for s in geo['sites'].values():
        pts += [tuple(s['door']), tuple(s['icon'])]
    return pts


def far_from(p, pts, d=SPACING):
    return all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= d * d for q in pts)


def pick():
    g, walk = load()
    stacks, bars = bar_stacks(g, walk)
    taken = existing_points()
    pumps = list(json.loads((DATA / 'geo.json').read_text(encoding='utf-8'))['pumps'].values())
    chosen = []
    for area, (ax, ay) in AREAS.items():
        mine = sorted([s for s in stacks if nearest_area(s[0], s[1]) == area], key=lambda s: (s[0] - ax) ** 2 + (s[1] - ay) ** 2)
        n = 0
        for x, y, a in mine:
            if n >= PER_AREA_DEATH or not far_from((x, y), taken) or not is_house_spot(x, y, pumps):
                continue
            door = snap_street(walk, x, y)
            if door is None or not far_from(door, taken, 30):
                continue
            chosen.append({'area': area, 'icon': [x, y], 'door': list(door), 'bars': True})
            taken += [(x, y), door]
            n += 1
        # 막대 없는 집: 영역 안 블록 가장자리 가운데 둘레 26px 안에 막대가 하나도 없는 곳
        near_bar = ndi.binary_dilation(bars, iterations=26)
        edge = (walk == 0) & ndi.binary_dilation(walk > 0, iterations=6) & ~ndi.binary_dilation(walk > 0, iterations=3) & ~near_bar
        ys, xs = np.nonzero(edge)
        order = np.argsort((xs - ax) ** 2 + (ys - ay) ** 2)
        n = 0
        for i in order[::7]:
            x, y = int(xs[i]), int(ys[i])
            if n >= PER_AREA_CLEAR or nearest_area(x, y) != area or not far_from((x, y), taken, SPACING + 10) or not is_house_spot(x, y, pumps):
                continue
            door = snap_street(walk, x, y)
            if door is None or not far_from(door, taken, 30):
                continue
            chosen.append({'area': area, 'icon': [x, y], 'door': list(door), 'bars': False})
            taken += [(x, y), door]
            n += 1
    for i, c in enumerate(chosen):
        c['id'] = f'd{i + 1:02d}'
    OUT_PICK.mkdir(parents=True, exist_ok=True)
    (OUT_PICK / 'picked.json').write_text(json.dumps(chosen, ensure_ascii=False, indent=1), encoding='utf-8')
    # 사람이 막대를 셀 확대 그림: 한 장에 열 곳
    tiles = []
    for c in chosen:
        x, y = c['icon']
        crop = cv2.cvtColor(g[max(0, y - 30):y + 30, max(0, x - 30):x + 30], cv2.COLOR_GRAY2BGR)
        crop = cv2.resize(crop, (360, 360), interpolation=cv2.INTER_NEAREST)
        cv2.putText(crop, c['id'], (6, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        tiles.append(crop)
    for k in range(0, len(tiles), 10):
        row = tiles[k:k + 10] + [np.full((360, 360, 3), 255, np.uint8)] * (10 - len(tiles[k:k + 10]))
        cv2.imwrite(str(OUT_PICK / f'count_{k // 10 + 1}.png'), np.vstack([np.hstack(row[:5]), np.hstack(row[5:])]))
    # 전체 위치
    vis = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    for c in chosen:
        cv2.circle(vis, tuple(c['icon']), 9, (0, 0, 255) if c['bars'] else (0, 160, 0), 2)
        cv2.putText(vis, c['id'], (c['icon'][0] + 8, c['icon'][1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 0, 0), 1)
    cv2.imwrite(str(OUT_PICK / 'where.png'), vis)
    print(f'{len(chosen)}곳을 골랐다. 확대 그림:', OUT_PICK)


def real_houses():
    """공개 자료의 집(주소)별 사망자: [(묶음 점들, 사망자 수)]"""
    real = json.loads((DATA / 'snow_deaths.gen.json').read_text(encoding='utf-8'))['houses']
    return [(np.array(h['points']), h['deaths']) for h in real]


def real_count(houses, x, y, r=16):
    """(x, y) 에서 r 픽셀 안에 막대 묶음이 있으면 그 사망자 수, 없으면 0"""
    best, n = r, 0
    for pts, deaths in houses:
        d = np.min(np.hypot(pts[:, 0] - x, pts[:, 1] - y))
        if d < best:
            best, n = d, deaths
    return n


# 고른 40곳에 더해, 사망자가 많은데 빠졌던 집들 (공개 자료에서 사망 7명 이상인 묶음)
BIG_MIN = 7


def add_big(picked, walk, houses):
    geo = json.loads((DATA / 'geo.gen.json').read_text(encoding='utf-8'))
    taken = [tuple(c['icon']) for c in picked] + [tuple(s['icon']) for s in geo['sites'].values()]
    n = len(picked)
    for pts, deaths in sorted(houses, key=lambda h: -h[1]):
        if deaths < BIG_MIN:
            break
        # 막대 묶음의 길 쪽 끝을 문으로, 블록 안쪽 끝을 건물 자리로
        dists = [np.hypot(*(np.array(snap_street(walk, int(x), int(y)) or (9e9, 9e9)) - (x, y))) for x, y in pts]
        inner = pts[int(np.argmax(dists))]
        x, y = int(round(inner[0])), int(round(inner[1]))
        if not far_from((x, y), taken, 12):
            continue                         # 이미 게임에 있는 집이다
        door = snap_street(walk, x, y)
        if door is None:
            continue
        n += 1
        picked.append({'area': nearest_area(x, y), 'icon': [x, y], 'door': list(door), 'bars': True, 'id': f'd{n:02d}'})
        taken.append((x, y))
        print(f'  더함 d{n:02d}: 사망 {deaths}명, 자리 {x},{y}')
    return picked


def add_rest(picked, walk, houses):
    """아직 게임에 없는 자료의 집을 모두 '자유 조사 집'으로 더한다.
    건물 그림 없이 문 표시만 두고, 기록하면 자료의 막대 자리에 막대를 그린다(points)"""
    geo = json.loads((DATA / 'geo.gen.json').read_text(encoding='utf-8'))
    icons = [np.array(c['icon'], float) for c in picked] + [np.array(s['icon'], float) for s in geo['sites'].values()]
    n = len(picked)
    added = 0
    # 게임의 집(이야기·맡은 집)마다 그 자리에서 가장 가까운 막대 묶음 하나만 '이미 들어간 집'이다
    used = set()
    for k, ic in enumerate(icons):
        r = 30 if k == len(picked) + list(geo['sites']).index('workhouse') else 22   # 구빈원 막대는 건물 안쪽에 그려져 있다
        d = [np.min(np.hypot(pts[:, 0] - ic[0], pts[:, 1] - ic[1])) for pts, _ in houses]
        j = int(np.argmin(d))
        if d[j] < r:
            used.add(j)
    for j, (pts, deaths) in enumerate(houses):
        if j in used:
            continue
        # 문: 막대 묶음에서 길에 가장 가까운 점 앞의 길
        best = None
        for x, y in pts:
            door = snap_street(walk, int(round(x)), int(round(y)), r=24) or snap_street(walk, int(round(x)), int(round(y)), r=60)
            if door is not None:
                d = np.hypot(door[0] - x, door[1] - y)
                if best is None or d < best[0]:
                    best = (d, door, (x, y))
        if best is None:
            print('  문을 못 찾음', pts.mean(0))
            continue
        _, door, (x, y) = best
        n += 1
        added += 1
        picked.append({'area': nearest_area(x, y), 'icon': [int(round(x)), int(round(y))], 'door': list(door), 'bars': True,
                       'id': f'd{n:03d}' if n > 99 else f'd{n:02d}', 'assigned': False,
                       'points': [[round(float(a), 1), round(float(b), 1)] for a, b in pts]})
    print(f'  자유 조사 집 {added}곳을 더함')
    return picked


def build():
    """공개 자료의 사망자 수를 합치고, 걸어서 가장 가까운 펌프를 구한다"""
    g, walk = load()
    picked = json.loads((OUT_PICK / 'picked.json').read_text(encoding='utf-8'))
    houses = real_houses()
    picked = add_big([c for c in picked if int(c['id'][1:]) <= 40], walk, houses)
    for c in picked:
        c['assigned'] = True          # 영역이 맡아 조사하는 집 (숙제)
    picked = add_rest(picked, walk, houses)
    geo = json.loads((DATA / 'geo.json').read_text(encoding='utf-8'))
    street = walk > 0
    H, W = street.shape
    owner = np.full((H, W), -1, np.int16)
    best = np.full((H, W), np.inf, np.float32)
    pump_ids = list(geo['pumps'])
    heap = []
    for i, pid in enumerate(pump_ids):
        x, y = snap_street(walk, *geo['pumps'][pid])
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
    out = []
    for c in picked:
        deaths = len(c['points']) if 'points' in c else real_count(houses, *c['icon'], r=22 if c['bars'] else 10)
        x, y = c['door']
        near = pump_ids[int(owner[y, x])]
        out.append({**c, 'deaths': deaths, 'nearestPump': near, 'walkToBroad': round(float(best[y, x])) if near == 'broad' else None})
    (DATA / 'districts.gen.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for o in out:
        if o.get('assigned'):
            print(f"  {o['id']} {o['area']} 사망 {o['deaths']:2d}  가까운 펌프 {o['nearestPump']}")
    total = sum(o['deaths'] for o in out)
    print(f"  영역 집 {len(out)}곳 (맡은 집 {sum(1 for o in out if o.get('assigned'))}곳), 사망자 {total}명")
    make_people(out)


# 1850년대 소호에 흔했던 직업 (한국어 직업, 집 이름, 옷차림 영어)
TRADES = [
    ('재단사', '재단 공방', 'grey waistcoat, tape measure around neck'), ('구두장이', '구둣방', 'leather apron, rolled sleeves'),
    ('세탁부', '셋방', 'linen apron, sleeves rolled'), ('바느질삯꾼', '다락방 셋집', 'plain dark dress, pins on collar'),
    ('목수', '목공소 위층', 'canvas smock, flat cap'), ('짐꾼', '셋방', 'worn brown jacket, neckerchief'),
    ('하녀', '하숙집', 'black dress, white apron and cap'), ('빵집 주인', '빵집', 'white apron, flour on sleeves'),
    ('가구 칠장이', '칠장이 공방', 'paint stained smock'), ('인쇄공', '인쇄소 위층', 'grey waistcoat, black sleeve covers'),
    ('시계 수리공', '시계방', 'brown waistcoat, sleeve garters'), ('모자 장식공', '모자 가게 2층', 'plain blue dress, ribbon on collar'),
    ('채소 장수', '가게 위층', 'shawl, coarse apron'), ('마부', '마구간 위층', 'heavy green coat, bowler hat'),
    ('석탄 배달꾼', '석탄 가게 위층', 'dark wool coat, leather cap'), ('하숙집 안주인', '하숙집', 'dark plum dress, lace cap'),
    ('제화공', '제화 공방', 'white shirt, leather apron'), ('대장장이', '대장간', 'leather apron, sooty shirt'),
    ('우유 배달부', '우유 가게', 'blue smock, cloth cap'), ('술집 일꾼', '선술집 위층', 'striped shirt, waistcoat'),
]
GIVEN_M = ['토머스', '윌리엄', '존', '제임스', '조지', '헨리', '찰스', '에드워드', '프레더릭', '새뮤얼', '조지프', '로버트', '아서', '월터', '앨프리드', '리처드', '대니얼', '패트릭']
GIVEN_F = ['메리', '앤', '엘리자베스', '사라', '제인', '마거릿', '엘런', '해나', '에밀리', '캐서린', '수전', '마사', '브리짓', '루시', '앨리스', '엘리자', '해리엇', '로즈']
FAMILY = ['스미스', '존스', '브라운', '테일러', '윌리엄스', '데이비스', '에번스', '그린', '우드', '홀', '라이트', '워커', '해리스', '클라크', '루이스', '로빈슨',
          '모리스', '쿠퍼', '킹', '베이커', '터너', '파커', '오말리', '머피', '켈리', '헌트', '프라이스', '벨', '그레이', '웹', '마틴', '스톤']
HAIR_F = ['brown hair in a low bun', 'red hair under a linen cap', 'black hair parted in the middle', 'fair hair braided', 'greying hair under a lace cap', 'dark curly hair tied back']
HAIR_M = ['short brown hair', 'dark hair and sideburns', 'ginger hair and beard', 'balding grey hair', 'black hair and moustache', 'fair hair, clean shaven']


def make_people(out):
    path = DATA / 'district_people.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    have = {p['id'] for p in data['people']}
    rng = np.random.default_rng(1854)
    added = 0
    for o in out:
        if o['id'] in have:
            continue
        i = int(o['id'][1:])
        female = bool(rng.integers(2))
        trade, home, clothes = TRADES[int(rng.integers(len(TRADES)))]
        if female and trade in ('대장장이', '마부', '석탄 배달꾼', '짐꾼', '목수'):
            trade, home, clothes = ('세탁부', '셋방', 'linen apron, sleeves rolled')
        if not female and trade in ('세탁부', '바느질삯꾼', '하녀', '모자 장식공', '하숙집 안주인'):
            trade, home, clothes = ('재단사', '재단 공방', 'grey waistcoat, tape measure around neck')
        age = int(rng.integers(22, 66))
        name = f"{(GIVEN_F if female else GIVEN_M)[int(rng.integers(18))]} {FAMILY[int(rng.integers(len(FAMILY)))]}"
        hair = (HAIR_F if female else HAIR_M)[int(rng.integers(6))]
        desc = f"{age} year old {'woman' if female else 'man'}, {trade_en(trade)}, {hair}, {clothes}"
        data['people'].append({'id': o['id'], 'name': name, 'role': trade, 'home': home, 'desc': desc, 'seed': 9000 + i,
                               'female': female, 'age': age})
        added += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'  주민 {added}명을 더함 (모두 {len(data["people"])}명)')


def trade_en(k):
    return {'재단사': 'tailor', '구두장이': 'shoemaker', '세탁부': 'washerwoman', '바느질삯꾼': 'seamstress', '목수': 'carpenter',
            '짐꾼': 'porter', '하녀': 'housemaid', '빵집 주인': 'baker', '가구 칠장이': 'varnisher', '인쇄공': 'printer',
            '시계 수리공': 'watch mender', '모자 장식공': 'milliner', '채소 장수': 'greengrocer', '마부': 'cab driver',
            '석탄 배달꾼': 'coal porter', '하숙집 안주인': 'landlady', '제화공': 'bootmaker', '대장장이': 'blacksmith',
            '우유 배달부': 'milkman', '술집 일꾼': 'tavern worker'}[k]


if __name__ == '__main__':
    {'pick': pick, 'build': build}[sys.argv[1] if len(sys.argv) > 1 else 'pick']()
