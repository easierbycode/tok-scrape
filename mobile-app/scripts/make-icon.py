"""Generate launcher / splash icons for the Cordova app and the Chrome extensions.

The canonical LP logo lives in the member-app at
``member-app/apps/web/public/images/lp-logo.png`` (500x500, RGBA). This script
resamples that logo onto the brand-dark backdrop and writes:

  mobile-app/res/icon-source.png             (1024x1024 master)
  mobile-app/res/icon/android/<density>.png  (Android launcher icons)
  mobile-app/res/screen/android/splash-*.png (Cordova splash screens)
  mobile-app/res/screen/android/splash-icon.png  (Android 12+ adaptive splash)
  extension-seller/icons/<size>.png          (Chrome extension icons)
  extension-agency/icons/<size>.png          (Chrome extension icons)

If the LP logo can't be found, falls back to a procedurally-drawn LP monogram
so the script still works in a checkout that doesn't include the member-app.

Override the source via env: ``LP_LOGO=path/to/png python3 make-icon.py``.
"""
from __future__ import annotations

import os
import sys
from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOBILE_RES = os.path.join(REPO_ROOT, "mobile-app", "res")
EXTENSION_DIRS = (
    os.path.join(REPO_ROOT, "extension-seller", "icons"),
    os.path.join(REPO_ROOT, "extension-agency",  "icons"),
)
DEFAULT_LP_LOGO = os.path.join(REPO_ROOT, "member-app", "apps", "web", "public", "images", "lp-logo.png")

# --- Brand colors (matched to the supplied logo) ------------------------
BG_DARK = (16, 16, 18, 255)
ORANGE  = (245, 122, 27, 255)
WHITE   = (245, 245, 245, 255)


# ---------------------------------------------------------------------------
# Source loader
# ---------------------------------------------------------------------------

def _procedural_master(size: int = 1024) -> Image.Image:
    """Fallback: hand-drawn LP monogram when the member-app logo is missing."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    pad = int(size * 0.04)
    disk_box = (pad, pad, size - pad, size - pad)
    d.ellipse(disk_box, fill=BG_DARK)
    d.ellipse(disk_box, outline=ORANGE, width=int(size * 0.045))

    cx, cy = size // 2, size // 2
    glyph_h = int(size * 0.50)
    stroke  = int(size * 0.13)
    radius  = int(stroke * 0.45)

    # L
    Lx   = cx - int(size * 0.20)
    Ltop = cy - glyph_h // 2
    Lbot = cy + glyph_h // 2
    d.rounded_rectangle((Lx - stroke // 2, Ltop, Lx + stroke // 2, Lbot), radius=radius, fill=WHITE)
    foot_w = int(size * 0.26)
    foot_h = int(stroke * 0.70)
    d.rounded_rectangle(
        (Lx - stroke // 2, Lbot - foot_h, Lx - stroke // 2 + foot_w, Lbot),
        radius=int(foot_h * 0.45), fill=WHITE,
    )

    # P
    Px   = cx + int(size * 0.04)
    Ptop = cy - glyph_h // 2
    Pbot = cy + glyph_h // 2
    d.rounded_rectangle((Px - stroke // 2, Ptop, Px + stroke // 2, Pbot), radius=radius, fill=ORANGE)
    bowl_d = int(glyph_h * 0.62)
    d.ellipse((Px - stroke // 2, Ptop, Px - stroke // 2 + bowl_d, Ptop + bowl_d),
              outline=ORANGE, width=stroke)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.ellipse(disk_box, outline=(0, 0, 0, 90), width=int(size * 0.012))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(size * 0.008)))
    img.alpha_composite(shadow)
    return img


def load_source() -> Image.Image:
    """Return a 1024x1024 RGBA logo with a transparent background."""
    src_path = os.environ.get("LP_LOGO") or DEFAULT_LP_LOGO
    if os.path.isfile(src_path):
        logo = Image.open(src_path).convert("RGBA")
        # Normalize to a 1024x1024 canvas so downstream resizes are clean.
        size = 1024
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        # Letterbox-fit the source preserving aspect ratio.
        w, h = logo.size
        scale = min(size / w, size / h)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = logo.resize((new_w, new_h), Image.LANCZOS)
        canvas.alpha_composite(resized, ((size - new_w) // 2, (size - new_h) // 2))
        return canvas
    print(f"warn: {src_path} not found; falling back to procedural LP monogram", file=sys.stderr)
    return _procedural_master(1024)


# ---------------------------------------------------------------------------
# Composite helpers
# ---------------------------------------------------------------------------

def _on_dark(logo: Image.Image, size: int, fill_frac: float = 0.78) -> Image.Image:
    """Paste the logo onto a dark square at the given size. fill_frac is the
    fraction of the canvas the logo occupies (centered)."""
    canvas = Image.new("RGBA", (size, size), BG_DARK)
    inner = max(8, int(size * fill_frac))
    resized = logo.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - inner) // 2, (size - inner) // 2))
    return canvas


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

ANDROID_ICONS = {
    "ldpi":    36,
    "mdpi":    48,
    "hdpi":    72,
    "xhdpi":   96,
    "xxhdpi":  144,
    "xxxhdpi": 192,
}

SPLASH_SIZES = {
    "splash-port-ldpi":    ( 200,  320),
    "splash-port-mdpi":    ( 320,  480),
    "splash-port-hdpi":    ( 480,  800),
    "splash-port-xhdpi":   ( 720, 1280),
    "splash-port-xxhdpi":  (1080, 1920),
    "splash-port-xxxhdpi": (1440, 2560),
    "splash-land-ldpi":    ( 320,  200),
    "splash-land-mdpi":    ( 480,  320),
    "splash-land-hdpi":    ( 800,  480),
    "splash-land-xhdpi":   (1280,  720),
    "splash-land-xxhdpi":  (1920, 1080),
    "splash-land-xxxhdpi": (2560, 1440),
}

EXTENSION_SIZES = (16, 32, 48, 128)


def write_master(logo: Image.Image) -> str:
    os.makedirs(MOBILE_RES, exist_ok=True)
    out = os.path.join(MOBILE_RES, "icon-source.png")
    _on_dark(logo, 1024).save(out, "PNG", optimize=True)
    return out


def write_android_icons(logo: Image.Image) -> str:
    icon_dir = os.path.join(MOBILE_RES, "icon", "android")
    os.makedirs(icon_dir, exist_ok=True)
    for name, size in ANDROID_ICONS.items():
        _on_dark(logo, size).save(os.path.join(icon_dir, f"{name}.png"), "PNG", optimize=True)
    return icon_dir


def write_splashes(logo: Image.Image) -> str:
    out = os.path.join(MOBILE_RES, "screen", "android")
    os.makedirs(out, exist_ok=True)
    for name, (w, h) in SPLASH_SIZES.items():
        canvas = Image.new("RGBA", (w, h), BG_DARK)
        s = max(64, int(min(w, h) * 0.40))
        resized = logo.resize((s, s), Image.LANCZOS)
        canvas.alpha_composite(resized, ((w - s) // 2, (h - s) // 2))
        canvas.convert("RGB").save(os.path.join(out, f"{name}.png"), "PNG", optimize=True)
    return out


def write_splash_icon(logo: Image.Image) -> str:
    """Android 12+ adaptive splash icon (transparent background, centered logo
    occupies the inner ~60% per Material guidance)."""
    out = os.path.join(MOBILE_RES, "screen", "android")
    os.makedirs(out, exist_ok=True)
    size = 1024
    inner = int(size * 0.60)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    resized = logo.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - inner) // 2, (size - inner) // 2))
    path = os.path.join(out, "splash-icon.png")
    canvas.save(path, "PNG", optimize=True)
    return path


def write_extension_icons(logo: Image.Image) -> list[str]:
    """Chrome's toolbar shows the icon on light *and* dark backgrounds, so we
    keep the canvas transparent and let the browser paint its own backdrop.
    The logo fills nearly the whole tile."""
    written: list[str] = []
    for ext_dir in EXTENSION_DIRS:
        os.makedirs(ext_dir, exist_ok=True)
        for size in EXTENSION_SIZES:
            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            inner = max(8, int(size * 0.92))
            resized = logo.resize((inner, inner), Image.LANCZOS)
            canvas.alpha_composite(resized, ((size - inner) // 2, (size - inner) // 2))
            out = os.path.join(ext_dir, f"{size}.png")
            canvas.save(out, "PNG", optimize=True)
            written.append(out)
    return written


if __name__ == "__main__":
    logo = load_source()
    print("Master:    ", write_master(logo))
    print("Icons:     ", write_android_icons(logo))
    print("Splashes:  ", write_splashes(logo))
    print("SplashIcon:", write_splash_icon(logo))
    for p in write_extension_icons(logo):
        print("Extension: ", p)
