# -*- coding: utf-8 -*-
"""스노우 지도의 사망자 578명(Tobler 1994 디지털화, R 패키지 HistData 의 Snow.deaths)을
이 게임의 지도 좌표로 옮기고, 같은 집(같은 주소)끼리 묶는다.

  python tools/build_snow_data.py          # src/data/snow_deaths.gen.json 과 확인용 그림을 만든다

자료 좌표와 지도 픽셀은 13개 펌프 위치로 맞춘다(아핀 변환, 최소제곱).
스노우의 지도는 한 주소의 사망자를 길에서 블록 안쪽으로 막대를 쌓아 그렸고, 디지털화 자료도
같은 방식으로 점을 쌓아 두었다. 그래서 서로 아주 가까이 일렬로 놓인 점들을 한 집으로 묶는다.
"""
import sys, json, csv
from pathlib import Path
import numpy as np, cv2
from scipy import ndimage as ndi

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'source' / 'snow_data'
DATA = ROOT / 'src' / 'data'

# 자료의 펌프 이름 → geo.json 의 펌프 id
PUMP_IDS = {
    'Oxford Market': 'oxford_market', 'Castle St E': 'castle', 'Oxford St #1': 'berners', 'Oxford St #2': 'newman',
    'Gt Marlborough': 'great_marlborough', 'Crown Chapel': 'little_marlborough', 'Broad St': 'broad', 'Warwick': 'warwick',
    'Briddle St': 'bridle', 'So Soho': 'rupert', 'Dean St': 'dean', 'Coventry St': 'tichborne', 'Vigo St': 'vigo',
}
LINK = 0.105       # 한 집으로 묶는 점 사이 거리 (자료 단위. 막대 간격은 약 0.08)


def read(name):
    with open(SRC / f'{name}.csv', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def fit():
    geo = json.loads((DATA / 'geo.json').read_text(encoding='utf-8'))['pumps']
    src, dst, names = [], [], []
    for p in read('Snow.pumps'):
        src.append([float(p['x']), float(p['y']), 1.0])
        dst.append(geo[PUMP_IDS[p['label']]])
        names.append(p['label'])
    A, *_ = np.linalg.lstsq(np.array(src), np.array(dst, float), rcond=None)
    err = np.hypot(*(np.array(src) @ A - np.array(dst)).T)
    for n, e in zip(names, err):
        print(f'  펌프 {n:15s} 어긋남 {e:5.1f}px')
    print(f'  펌프 맞춤 평균 어긋남 {err.mean():.1f}px (지도 1280px 기준)')
    return A


def main():
    A = fit()
    pts = np.array([[float(d['x']), float(d['y'])] for d in read('Snow.deaths')])
    # 같은 집 묶기: 가까운 점끼리 이어 붙인다
    n = len(pts)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(n):
        d = np.hypot(*(pts - pts[i]).T)
        for j in np.nonzero(d < LINK)[0]:
            if j > i:
                parent[find(j)] = find(i)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    houses = []
    for idx in groups.values():
        g = pts[idx]
        # 막대 묶음의 길 쪽 끝(첫 점)을 집 위치로 삼는다: 쌓인 줄의 양 끝 가운데 가장 가까운 길 쪽
        mx = np.c_[g, np.ones(len(g))] @ A
        houses.append({'deaths': len(idx), 'points': [[round(x, 1), round(y, 1)] for x, y in mx]})
    houses.sort(key=lambda h: -h['deaths'])
    total = sum(h['deaths'] for h in houses)
    print(f'  사망자 {total}명, 주소(집) {len(houses)}곳, 가장 많은 집 {houses[0]["deaths"]}명')
    hist = {}
    for h in houses:
        hist[h['deaths']] = hist.get(h['deaths'], 0) + 1
    print('  집당 사망자 분포:', ', '.join(f'{k}명 {v}곳' for k, v in sorted(hist.items())))
    out = {'_source': 'Tobler W. (1994) Snow\'s Cholera Map, NCGIA 디지털화(1992, Rusty Dodson). R 패키지 HistData 의 Snow.deaths. '
                      '좌표는 13개 펌프로 맞춰 snow_map.jpg 픽셀로 옮겼다.',
           'total': total, 'houses': houses}
    (DATA / 'snow_deaths.gen.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')

    # 확인용: 원본 지도 위에 자료 점을 찍는다
    g = cv2.imread(str(ROOT / 'tools' / 'source' / 'snow_map.jpg'))
    for h in houses:
        for x, y in h['points']:
            cv2.circle(g, (int(x), int(y)), 2, (0, 0, 255), -1)
    for p in read('Snow.pumps'):
        x, y = np.array([float(p['x']), float(p['y']), 1]) @ A
        cv2.circle(g, (int(x), int(y)), 6, (255, 0, 0), 2)
    cv2.imwrite(str(SRC / '_overlay.png'), g)
    cv2.imwrite(str(SRC / '_overlay_center.png'), cv2.resize(g[380:760, 520:960], None, fx=2, fy=2))
    print('  확인용 그림:', SRC / '_overlay_center.png')


if __name__ == '__main__':
    main()
