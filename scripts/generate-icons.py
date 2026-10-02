"""Gera os ícones do Kissly (coração branco inclinado sobre degradê rosé → coral).

Uso: python scripts/generate-icons.py   (requer Pillow: pip install pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parent.parent / "assets"
ROSE, CORAL = (255, 61, 127), (255, 122, 89)
INK = (11, 8, 16)
SS = 4  # supersampling para bordas suaves


def gradient(size: int) -> Image.Image:
    """Degradê diagonal (canto superior esquerdo → inferior direito)."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(ROSE, CORAL))
    return img


def heart_mask(size: int, scale: float, tilt_deg: float = -8, color=255) -> Image.Image:
    """Máscara com um coração centralizado; `scale` = largura do coração / lado da imagem."""
    big = size * SS
    mask = Image.new("L", (big, big), 0)
    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((x, y))
    # normaliza para caber em `scale` e centraliza (o coração é um pouco mais largo que alto)
    r = big * scale / 34
    a = math.radians(tilt_deg)
    cx, cy = big / 2, big / 2 + r * 0.6
    poly = [
        (cx + r * (x * math.cos(a) - y * math.sin(a)), cy + r * (x * math.sin(a) + y * math.cos(a)))
        for x, y in pts
    ]
    ImageDraw.Draw(mask).polygon(poly, fill=color)
    return mask.resize((size, size), Image.LANCZOS)


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    size = img.size[0]
    big = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, size * SS - 1, size * SS - 1), radius=size * SS * radius_ratio, fill=255)
    out = img.convert("RGBA")
    out.putalpha(big.resize((size, size), Image.LANCZOS))
    return out


def with_shadow(base: Image.Image, mask: Image.Image, offset: int, blur: int, opacity: int) -> Image.Image:
    shadow = Image.new("RGBA", base.size, (*INK, 0))
    shadow.putalpha(mask.point(lambda v: v * opacity // 255))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    moved = Image.new("RGBA", base.size, (0, 0, 0, 0))
    moved.paste(shadow, (0, offset))
    return Image.alpha_composite(base.convert("RGBA"), moved)


def white_heart_on(base: Image.Image, scale: float) -> Image.Image:
    size = base.size[0]
    mask = heart_mask(size, scale)
    out = with_shadow(base, mask, offset=size // 60, blur=size // 50, opacity=70)
    white = Image.new("RGBA", base.size, (255, 255, 255, 255))
    white.putalpha(mask)
    return Image.alpha_composite(out, white)


def main():
    # iOS / geral: quadrado cheio (o sistema arredonda os cantos)
    white_heart_on(gradient(1024), 0.56).convert("RGB").save(ASSETS / "icon.png")

    # Android adaptativo: fundo e frente separados (frente dentro da área segura de 66%)
    gradient(512).save(ASSETS / "android-icon-background.png")
    fg = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    white_heart_on(fg, 0.40).save(ASSETS / "android-icon-foreground.png")
    mono = Image.new("RGBA", (432, 432), (255, 255, 255, 0))
    mono.putalpha(heart_mask(432, 0.40))
    mono.save(ASSETS / "android-icon-monochrome.png")

    # Splash: selo do app (quadrado arredondado em degradê) sobre o fundo escuro
    splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    badge = rounded(white_heart_on(gradient(560), 0.56), 0.3)
    splash.paste(badge, (232, 232), badge)
    splash.save(ASSETS / "splash-icon.png")

    # Favicon (web)
    rounded(white_heart_on(gradient(192), 0.56), 0.28).resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    print("Ícones gerados em", ASSETS)


if __name__ == "__main__":
    main()
