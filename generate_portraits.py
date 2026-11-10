import os
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = "C:/Users/goodt/john-snow-1854/public/assets/portraits"
os.makedirs(OUTPUT_DIR, exist_ok=True)

W, H = 320, 380

def create_base():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

# 1. 플레이어 남성 (존 스노우 박사)
def draw_player_male():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 빅토리안 수트
    draw.polygon([(cx - 75, H), (cx + 75, H), (cx + 55, 230), (cx - 55, 230)], fill=(15, 23, 42)) # 짙은 네이비 수트
    # 흰 셔츠 V넥
    draw.polygon([(cx - 20, 230), (cx + 20, 230), (cx, 280)], fill=(248, 250, 252))
    # 검은 보타이
    draw.polygon([(cx - 22, 240), (cx + 22, 240), (cx + 18, 258), (cx - 18, 258)], fill=(2, 6, 23))
    draw.ellipse([cx - 6, 244, cx + 6, 254], fill=(2, 6, 23))
    # 황동 단추
    draw.ellipse([cx - 4, 300, cx + 4, 308], fill=(251, 191, 36))
    draw.ellipse([cx - 4, 330, cx + 4, 338], fill=(251, 191, 36))
    
    # 목
    draw.rectangle([cx - 16, 200, cx + 16, 235], fill=(250, 204, 21))
    
    # 머리 / 얼굴 원통
    draw.rounded_rectangle([cx - 48, 110, cx + 48, 205], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 눈 (검은자 + 흰 하이라이트)
    draw.ellipse([cx - 24, 142, cx - 12, 158], fill=(15, 23, 42))
    draw.ellipse([cx + 12, 142, cx + 24, 158], fill=(15, 23, 42))
    draw.ellipse([cx - 22, 144, cx - 16, 150], fill=(255, 255, 255))
    draw.ellipse([cx + 14, 144, cx + 20, 150], fill=(255, 255, 255))
    
    # 눈썹
    draw.line([(cx - 28, 134), (cx - 10, 138)], fill=(113, 63, 18), width=3)
    draw.line([(cx + 28, 134), (cx + 10, 138)], fill=(113, 63, 18), width=3)
    
    # 미소
    draw.arc([cx - 16, 165, cx + 16, 188], start=10, end=170, fill=(113, 63, 18), width=3)
    
    # 구루마 수염 (빅토리안 신사 스타일)
    draw.polygon([(cx - 22, 172), (cx - 5, 168), (cx - 12, 178)], fill=(69, 26, 3))
    draw.polygon([(cx + 22, 172), (cx + 5, 168), (cx + 12, 178)], fill=(69, 26, 3))
    
    # 빅토리안 실크햇
    # 챙
    draw.ellipse([cx - 75, 95, cx + 75, 122], fill=(15, 23, 42), outline=(2, 6, 23), width=2)
    # 기둥
    draw.rounded_rectangle([cx - 45, 15, cx + 45, 105], radius=6, fill=(30, 41, 59), outline=(2, 6, 23), width=3)
    # 리본 밴드
    draw.rectangle([cx - 45, 90, cx + 45, 105], fill=(185, 28, 28)) # 딥 레드 리본
    
    img.save(os.path.join(OUTPUT_DIR, "player_male.png"))

# 2. 플레이어 여성 (플로렌스 조사관)
def draw_player_female():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 짙은 와인 & 네이비 빅토리안 드레스
    draw.polygon([(cx - 75, H), (cx + 75, H), (cx + 55, 230), (cx - 55, 230)], fill=(76, 29, 149)) # 퍼플/네이비
    # 아이보리 레이스 프릴 V넥
    draw.polygon([(cx - 24, 230), (cx + 24, 230), (cx, 285)], fill=(254, 243, 199))
    # 황동 카메오 브로치
    draw.ellipse([cx - 10, 245, cx + 10, 265], fill=(217, 119, 6), outline=(254, 243, 199), width=2)
    draw.ellipse([cx - 5, 250, cx + 5, 260], fill=(255, 255, 255))
    
    # 목
    draw.rectangle([cx - 14, 200, cx + 14, 235], fill=(250, 204, 21))
    
    # 헤어 뒷머리 올림번
    draw.ellipse([cx - 46, 50, cx + 46, 120], fill=(62, 28, 12))
    
    # 머리 / 얼굴 원통
    draw.rounded_rectangle([cx - 46, 110, cx + 46, 205], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 눈 (검은자 + 흰 하이라이트 + 속눈썹)
    draw.ellipse([cx - 24, 142, cx - 12, 158], fill=(15, 23, 42))
    draw.ellipse([cx + 12, 142, cx + 24, 158], fill=(15, 23, 42))
    draw.ellipse([cx - 22, 144, cx - 16, 150], fill=(255, 255, 255))
    draw.ellipse([cx + 14, 144, cx + 20, 150], fill=(255, 255, 255))
    
    # 속눈썹
    draw.line([(cx - 26, 142), (cx - 32, 136)], fill=(15, 23, 42), width=2)
    draw.line([(cx - 24, 139), (cx - 28, 132)], fill=(15, 23, 42), width=2)
    draw.line([(cx + 26, 142), (cx + 32, 136)], fill=(15, 23, 42), width=2)
    draw.line([(cx + 24, 139), (cx + 28, 132)], fill=(15, 23, 42), width=2)
    
    # 핑크 볼터치
    draw.ellipse([cx - 34, 162, cx - 20, 174], fill=(244, 114, 182, 160))
    draw.ellipse([cx + 20, 162, cx + 34, 174], fill=(244, 114, 182, 160))
    
    # 부드러운 미소 입
    draw.arc([cx - 14, 166, cx + 14, 186], start=10, end=170, fill=(190, 24, 93), width=3)
    
    # 양쪽 앞머리 컬
    draw.ellipse([cx - 52, 105, cx - 20, 140], fill=(62, 28, 12))
    draw.ellipse([cx + 20, 105, cx + 52, 140], fill=(62, 28, 12))
    
    # 우아한 빅토리안 깃털 보닛
    draw.ellipse([cx - 60, 85, cx + 60, 115], fill=(109, 40, 217))
    # 깃털 장식
    draw.polygon([(cx + 35, 95), (cx + 65, 40), (cx + 45, 90)], fill=(251, 191, 36))
    
    img.save(os.path.join(OUTPUT_DIR, "player_female.png"))

# 3. NPC 소호 주민 / 주부 (재러 베넷 등)
def draw_npc_resident():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 검소한 린넨 앞치마 & 숄
    draw.polygon([(cx - 75, H), (cx + 75, H), (cx + 52, 235), (cx - 52, 235)], fill=(120, 85, 72))
    draw.polygon([(cx - 35, 235), (cx + 35, 235), (cx + 30, H), (cx - 30, H)], fill=(245, 245, 244)) # 흰 앞치마
    
    # 목
    draw.rectangle([cx - 15, 205, cx + 15, 240], fill=(250, 204, 21))
    
    # 얼굴
    draw.rounded_rectangle([cx - 46, 115, cx + 46, 208], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 걱정스러운 눈과 눈썹 (콜레라 발병으로 시름하는 주민)
    draw.ellipse([cx - 24, 146, cx - 12, 160], fill=(15, 23, 42))
    draw.ellipse([cx + 12, 146, cx + 24, 160], fill=(15, 23, 42))
    draw.line([(cx - 26, 140), (cx - 10, 134)], fill=(113, 63, 18), width=3) # 팔자 눈썹
    draw.line([(cx + 26, 140), (cx + 10, 134)], fill=(113, 63, 18), width=3)
    
    # 근심 어린 입
    draw.arc([cx - 12, 178, cx + 12, 192], start=190, end=350, fill=(113, 63, 18), width=3)
    
    # 빅토리안 린넨 보닛 (머리 전체를 감싸는 모자)
    draw.arc([cx - 54, 90, cx + 54, 190], start=150, end=390, fill=(229, 231, 235), width=18)
    draw.ellipse([cx - 50, 85, cx + 50, 120], fill=(243, 244, 246))
    
    img.save(os.path.join(OUTPUT_DIR, "npc_resident.png"))

# 4. NPC 라이온 양조장 인부 (건장하고 활기찬 표정)
def draw_npc_brewery():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 튼튼한 가죽 앞치마 & 붉은 체크 셔츠
    draw.polygon([(cx - 85, H), (cx + 85, H), (cx + 60, 230), (cx - 60, 230)], fill=(185, 28, 28))
    draw.polygon([(cx - 40, 230), (cx + 40, 230), (cx + 35, H), (cx - 35, H)], fill=(120, 53, 15)) # 갈색 가죽 앞치마
    
    # 목
    draw.rectangle([cx - 20, 195, cx + 20, 235], fill=(250, 204, 21))
    
    # 얼굴
    draw.rounded_rectangle([cx - 48, 110, cx + 48, 205], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 활기찬 웃는 눈
    draw.arc([cx - 26, 140, cx - 10, 156], start=190, end=350, fill=(15, 23, 42), width=4)
    draw.arc([cx + 10, 140, cx + 26, 156], start=190, end=350, fill=(15, 23, 42), width=4)
    
    # 풍성한 수염과 호탕한 입
    draw.arc([cx - 20, 165, cx + 20, 195], start=10, end=170, fill=(180, 83, 9), width=4)
    draw.polygon([(cx - 35, 175), (cx + 35, 175), (cx, 215)], fill=(120, 53, 15)) # 풍성한 턱수염
    
    # 맥주 양조장 헌팅캡 / 플랫캡
    draw.ellipse([cx - 65, 88, cx + 65, 120], fill=(71, 85, 105))
    draw.polygon([(cx - 60, 105), (cx + 60, 105), (cx, 90)], fill=(51, 65, 85))
    
    img.save(os.path.join(OUTPUT_DIR, "npc_brewery.png"))

# 5. NPC 구빈원 감독관 (엄격한 석조 건물 관리자)
def draw_npc_workhouse():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 회색 울 연미복 & 높은 깃
    draw.polygon([(cx - 75, H), (cx + 75, H), (cx + 52, 230), (cx - 52, 230)], fill=(51, 65, 85))
    draw.rectangle([cx - 15, 230, cx + 15, 280], fill=(241, 245, 249))
    
    # 목
    draw.rectangle([cx - 16, 200, cx + 16, 235], fill=(250, 204, 21))
    
    # 얼굴
    draw.rounded_rectangle([cx - 46, 110, cx + 46, 205], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 둥근 황동 안경
    draw.ellipse([cx - 28, 140, cx - 8, 160], outline=(217, 119, 6), width=3)
    draw.ellipse([cx + 8, 140, cx + 28, 160], outline=(217, 119, 6), width=3)
    draw.line([(cx - 8, 150), (cx + 8, 150)], fill=(217, 119, 6), width=2)
    # 안경 너머 눈
    draw.ellipse([cx - 20, 147, cx - 16, 153], fill=(15, 23, 42))
    draw.ellipse([cx + 16, 147, cx + 20, 153], fill=(15, 23, 42))
    
    # 단호한 일자 입
    draw.line([(cx - 14, 182), (cx + 14, 182)], fill=(113, 63, 18), width=3)
    
    # 회색 정수리 헤어 & 중산모
    draw.ellipse([cx - 65, 95, cx + 65, 122], fill=(30, 41, 59))
    draw.arc([cx - 45, 45, cx + 45, 115], start=180, end=360, fill=(30, 41, 59), width=20)
    
    img.save(os.path.join(OUTPUT_DIR, "npc_workhouse.png"))

# 6. NPC 햄스테드 귀족 부인 (화려하고 우아한 저택 마님)
def draw_npc_lady():
    img = create_base()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    
    # 몸통 / 딥 에메랄드 벨벳 드레스
    draw.polygon([(cx - 80, H), (cx + 80, H), (cx + 55, 225), (cx - 55, 225)], fill=(6, 78, 59))
    # 진주 목걸이 3단
    draw.arc([cx - 25, 220, cx + 25, 255], start=10, end=170, fill=(255, 255, 255), width=4)
    draw.arc([cx - 32, 225, cx + 32, 270], start=10, end=170, fill=(255, 255, 255), width=3)
    
    # 목
    draw.rectangle([cx - 14, 195, cx + 14, 230], fill=(250, 204, 21))
    
    # 얼굴
    draw.rounded_rectangle([cx - 45, 105, cx + 45, 200], radius=16, fill=(250, 204, 21), outline=(202, 138, 4), width=3)
    
    # 우아한 눈빛과 메이크업
    draw.ellipse([cx - 24, 138, cx - 12, 154], fill=(15, 23, 42))
    draw.ellipse([cx + 12, 138, cx + 24, 154], fill=(15, 23, 42))
    draw.ellipse([cx - 20, 140, cx - 15, 146], fill=(255, 255, 255))
    draw.ellipse([cx + 16, 140, cx + 21, 146], fill=(255, 255, 255))
    # 붉은 입술
    draw.ellipse([cx - 10, 172, cx + 10, 184], fill=(225, 29, 72))
    
    # 풍성한 황금빛 컬 헤어 & 보석 티아라
    draw.ellipse([cx - 58, 95, cx - 25, 145], fill=(180, 83, 9))
    draw.ellipse([cx + 25, 95, cx + 58, 145], fill=(180, 83, 9))
    draw.arc([cx - 45, 55, cx + 45, 115], start=180, end=360, fill=(180, 83, 9), width=24)
    # 황금 티아라
    draw.polygon([(cx - 30, 80), (cx, 45), (cx + 30, 80)], fill=(251, 191, 36), outline=(217, 119, 6), width=2)
    draw.ellipse([cx - 5, 50, cx + 5, 60], fill=(59, 130, 246)) # 사파이어 보석
    
    img.save(os.path.join(OUTPUT_DIR, "npc_lady.png"))

if __name__ == "__main__":
    draw_player_male()
    draw_player_female()
    draw_npc_resident()
    draw_npc_brewery()
    draw_npc_workhouse()
    draw_npc_lady()
    print("All 6 portraits generated successfully in", OUTPUT_DIR)
