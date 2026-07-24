# 새 로고(비버 마스코트)에서 앱 아이콘 세트를 생성한다.
# 원본은 710x768, 로고 원은 x 84..623 / y 112..661 (약간 타원) → 정사각으로 리샘플해 완전한 원으로 만든다.
from PIL import Image, ImageDraw, ImageFont
import os

SRC = r"C:\Users\gaepo\Downloads\새로고 고.png"
OUT = r"C:\Users\gaepo\AppData\Local\Temp\claude\C--Users-gaepo-projects\e95d8260-aa7e-4c06-b066-36f325e049bc\scratchpad\out"
os.makedirs(OUT, exist_ok=True)

BBOX = (84, 112, 624, 662)      # 파란 링의 바깥 경계
SS = 4                          # 마스크 안티에일리어싱용 슈퍼샘플
BASE = 1024

src = Image.open(SRC).convert("RGB")

# 1) 링 경계로 잘라 정사각 리샘플 → 타원이 정원이 된다
disc = src.crop(BBOX).resize((BASE, BASE), Image.LANCZOS)

# 2) 원 바깥을 투명하게 (가장자리 1px 여유를 둬 링이 잘리지 않게)
mask = Image.new("L", (BASE * SS, BASE * SS), 0)
ImageDraw.Draw(mask).ellipse((0, 0, BASE * SS - 1, BASE * SS - 1), fill=255)
mask = mask.resize((BASE, BASE), Image.LANCZOS)
disc_rgba = disc.convert("RGBA")
disc_rgba.putalpha(mask)


def on_bg(size, scale, bg=(255, 255, 255, 255)):
    """단색 배경 위에 원형 마크를 scale 비율로 중앙 배치 (maskable 안전영역용)."""
    canvas = Image.new("RGBA", (size, size), bg)
    d = int(size * scale)
    m = disc_rgba.resize((d, d), Image.LANCZOS)
    off = (size - d) // 2
    canvas.alpha_composite(m, (off, off))
    return canvas


# logo-mark: UI에서 쓰는 투명 원형 마크
disc_rgba.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "logo-mark.png"))

# PWA 아이콘: purpose="any maskable" → 콘텐츠는 지름 80% 안전영역 안에
on_bg(512, 0.78).save(os.path.join(OUT, "icon-512.png"))
on_bg(192, 0.78).save(os.path.join(OUT, "icon-192.png"))

# iOS 홈화면: 투명 대신 흰 배경(투명은 검게 나오는 경우가 있음), 모서리만 둥글게 잘리므로 크게
on_bg(180, 0.92).save(os.path.join(OUT, "apple-touch-icon.png"))

# 파비콘: 작은 크기라 여백 없이 꽉 차게
ico = disc_rgba.resize((256, 256), Image.LANCZOS)
ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

# 3) og:image — 카톡/링크 공유 미리보기 (1200x630)
W, H = 1200, 630
og = Image.new("RGBA", (W, H), (247, 249, 252, 255))
mark = disc_rgba.resize((360, 360), Image.LANCZOS)
og.alpha_composite(mark, (110, (H - 360) // 2))

BOLD = r"C:\Windows\Fonts\malgunbd.ttf"
REG = r"C:\Windows\Fonts\malgun.ttf"
f_title = ImageFont.truetype(BOLD, 96)
f_sub = ImageFont.truetype(REG, 40)
dr = ImageDraw.Draw(og)
tx = 540
dr.text((tx, 258), "안전데스크", font=f_title, fill=(30, 64, 175, 255))
dr.text((tx, 378), "공동주택 위험성평가 통합 관리", font=f_sub, fill=(71, 85, 105, 255))
og.convert("RGB").save(os.path.join(OUT, "logo-full.png"))

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f, Image.open(p).size, f"{os.path.getsize(p) / 1024:.0f}KB")
