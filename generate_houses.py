import os
from PIL import Image, ImageDraw, ImageFilter

os.makedirs('public/assets/houses', exist_ok=True)

# 1. 1854 런던 빅토리안 테라스 하우스 (house_terrace.png)
def create_terrace_house():
    img = Image.new('RGBA', (240, 240), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 그림자
    d.ellipse([30, 205, 210, 235], fill=(0, 0, 0, 80))

    # 본체 벽돌 벽 (런던 옐로우/브라운 스톡 브릭)
    d.rectangle([50, 75, 190, 215], fill=(163, 130, 92), outline=(100, 75, 50), width=3)
    # 벽돌 디테일 질감 (가로 줄눈)
    for y in range(80, 215, 6):
        d.line([52, y, 188, y], fill=(130, 100, 70, 120), width=1)

    # 1층 석조 기단
    d.rectangle([48, 205, 192, 218], fill=(120, 110, 100), outline=(70, 65, 60), width=2)

    # 지붕 (슬레이트 회색 지붕)
    d.polygon([(40, 75), (120, 25), (200, 75)], fill=(51, 65, 85), outline=(30, 41, 59))
    # 지붕 기와 슬레이트 줄눈
    for y in range(35, 75, 7):
        offset = (y - 25) * 1.6
        d.line([120 - offset, y, 120 + offset, y], fill=(30, 41, 59, 180), width=2)

    # 굴뚝 2개 (좌/우)
    d.rectangle([60, 15, 78, 55], fill=(140, 100, 70), outline=(80, 50, 30), width=2)
    d.rectangle([58, 12, 80, 18], fill=(60, 40, 25))
    d.rectangle([162, 15, 180, 55], fill=(140, 100, 70), outline=(80, 50, 30), width=2)
    d.rectangle([160, 12, 182, 18], fill=(60, 40, 25))

    # 창문 4개 (2층 2개, 1층 2개 - 런던 샤시 창문)
    windows = [(65, 90), (145, 90), (65, 145), (145, 145)]
    for wx, wy in windows:
        # 창문 흰색 석조 돌출 프레임
        d.rectangle([wx - 3, wy - 3, wx + 31, wy + 41], fill=(240, 235, 225), outline=(140, 130, 120), width=2)
        # 유리창 (따뜻한 실내 오렌지 불빛 + 반사광)
        d.rectangle([wx, wy, wx + 28, wy + 38], fill=(254, 240, 138), outline=(60, 50, 40), width=1)
        # 격자 살
        d.line([wx + 14, wy, wx + 14, wy + 38], fill=(60, 50, 40), width=2)
        d.line([wx, wy + 19, wx + 28, wy + 19], fill=(60, 50, 40), width=2)
        # 유리 반사광
        d.polygon([(wx + 2, wy + 2), (wx + 14, wy + 2), (wx + 2, wy + 18)], fill=(255, 255, 255, 160))

    # 현관문 (빅토리안 블랙 목조 패널 도어)
    d.rectangle([103, 158, 137, 215], fill=(20, 25, 35), outline=(10, 15, 20), width=2)
    # 문 위 아치 채광창
    d.arc([103, 144, 137, 168], 180, 0, fill=(240, 235, 225), width=3)
    d.chord([103, 144, 137, 168], 180, 0, fill=(254, 240, 138))
    # 황동 문고리
    d.ellipse([130, 188, 134, 192], fill=(245, 158, 11))

    # 문 앞 계단
    d.rectangle([98, 215, 142, 220], fill=(160, 150, 140), outline=(100, 90, 80))

    img.save('public/assets/houses/house_terrace.png', 'PNG')
    print('Saved house_terrace.png')

# 2. 라이온 양조장 (house_brewery.png)
def create_brewery():
    img = Image.new('RGBA', (320, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 바닥 그림자
    d.ellipse([30, 220, 290, 255], fill=(0, 0, 0, 90))

    # 산업용 높은 붉은 벽돌 굴뚝 (왼쪽 뒤)
    d.rectangle([45, 15, 75, 180], fill=(127, 29, 29), outline=(69, 10, 10), width=3)
    d.rectangle([40, 10, 80, 20], fill=(69, 10, 10))
    # 굴뚝 그을음
    d.rectangle([46, 20, 74, 45], fill=(30, 20, 20, 160))

    # 메인 공장 본체 (짙은 적벽돌 산업 건물)
    d.rectangle([60, 80, 270, 230], fill=(153, 27, 27), outline=(69, 10, 10), width=4)
    # 벽돌 질감
    for y in range(85, 230, 8):
        d.line([62, y, 268, y], fill=(100, 15, 15, 140), width=1)

    # 상단 톱니형 공장 지붕 파사드 (Gable Roof)
    d.polygon([(55, 80), (165, 35), (275, 80)], fill=(69, 10, 10), outline=(40, 5, 5))
    # 양조장 황동 간판
    d.rectangle([110, 65, 220, 90], fill=(217, 119, 6), outline=(120, 53, 15), width=2)
    # LION BREWERY 글씨 라인
    d.rectangle([115, 70, 215, 85], fill=(69, 10, 10))

    # 2층 아치형 산업용 창문 3개
    for i, wx in enumerate([90, 150, 210]):
        d.chord([wx, 105, wx + 36, 145], 180, 0, fill=(254, 240, 138), outline=(69, 10, 10), width=2)
        d.rectangle([wx, 125, wx + 36, 155], fill=(254, 240, 138), outline=(69, 10, 10), width=2)
        d.line([wx + 18, 105, wx + 18, 155], fill=(69, 10, 10), width=2)
        d.line([wx, 135, wx + 36, 135], fill=(69, 10, 10), width=2)

    # 1층 대형 마차 운송용 아치문
    d.chord([190, 160, 250, 220], 180, 0, fill=(35, 20, 15), outline=(20, 10, 5), width=3)
    d.rectangle([190, 190, 250, 230], fill=(35, 20, 15), outline=(20, 10, 5), width=3)
    d.line([220, 160, 220, 230], fill=(20, 10, 5), width=3)

    # 나무 맥주통 3개 (앞마당 적재)
    for bx in [85, 115, 145]:
        d.ellipse([bx, 195, bx + 26, 232], fill=(120, 53, 15), outline=(67, 20, 7), width=2)
        # 맥주통 철제 띠 2줄
        d.arc([bx, 203, bx + 26, 210], 0, 180, fill=(30, 20, 10), width=2)
        d.arc([bx, 218, bx + 26, 225], 0, 180, fill=(30, 20, 10), width=2)

    img.save('public/assets/houses/house_brewery.png', 'PNG')
    print('Saved house_brewery.png')

# 3. 세인트 제임스 구빈원 (house_workhouse.png)
def create_workhouse():
    img = Image.new('RGBA', (340, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 그림자
    d.ellipse([30, 220, 310, 255], fill=(0, 0, 0, 90))

    # 본체 (런던 그레이 화강암 석조 파사드)
    d.rectangle([50, 75, 290, 225], fill=(100, 116, 139), outline=(51, 65, 85), width=4)
    # 석조 줄눈 블록
    for y in range(80, 225, 12):
        d.line([52, y, 288, y], fill=(71, 85, 105, 150), width=1)

    # 중앙 돌출 페디먼트 (신고전주의 삼각 박공)
    d.polygon([(110, 75), (170, 30), (230, 75)], fill=(71, 85, 105), outline=(30, 41, 59), width=3)
    d.ellipse([160, 50, 180, 70], fill=(254, 240, 138), outline=(30, 41, 59), width=2)

    # 지붕 좌우 슬레이트 (다크 슬레이트)
    d.polygon([(40, 75), (110, 75), (110, 55), (40, 75)], fill=(30, 41, 59))
    d.polygon([(230, 75), (300, 75), (300, 75), (230, 55)], fill=(30, 41, 59))

    # 2층 촘촘한 격자 창문 5개 (구빈원 특유의 통제된 창살)
    for wx in [70, 115, 158, 201, 246]:
        d.rectangle([wx, 95, wx + 24, 130], fill=(254, 240, 138), outline=(30, 41, 59), width=2)
        d.line([wx + 8, 95, wx + 8, 130], fill=(30, 41, 59), width=1)
        d.line([wx + 16, 95, wx + 16, 130], fill=(30, 41, 59), width=1)
        d.line([wx, 112, wx + 24, 112], fill=(30, 41, 59), width=1)

    # 1층 창문 4개
    for wx in [70, 115, 201, 246]:
        d.rectangle([wx, 155, wx + 24, 190], fill=(254, 240, 138), outline=(30, 41, 59), width=2)
        d.line([wx + 8, 155, wx + 8, 190], fill=(30, 41, 59), width=1)
        d.line([wx + 16, 155, wx + 16, 190], fill=(30, 41, 59), width=1)
        d.line([wx, 172, wx + 24, 172], fill=(30, 41, 59), width=1)

    # 중앙 육중한 석조 아치 철문
    d.chord([150, 140, 190, 180], 180, 0, fill=(30, 41, 59), outline=(15, 23, 42), width=3)
    d.rectangle([150, 160, 190, 225], fill=(30, 41, 59), outline=(15, 23, 42), width=3)
    d.line([170, 140, 170, 225], fill=(15, 23, 42), width=2)

    img.save('public/assets/houses/house_workhouse.png', 'PNG')
    print('Saved house_workhouse.png')

create_terrace_house()
create_brewery()
create_workhouse()
