"""Draws the "LP" monogram icon (orange + white on near-black with an orange ring).

Run from anywhere; writes:
  mobile-app/res/icon-source.png            (1024x1024 master)
  mobile-app/res/icon/android/<density>.png (Android launcher icons)
  mobile-app/res/screen/android/splash-*.png (Cordova splash screens)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, glob, shutil, sys

OUT_BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "res"))
os.makedirs(OUT_BASE, exist_ok=True)

# --- Brand colors (sampled to match the supplied logo) ------------------
BG_DARK   = (16, 16, 18, 255)      # near-black disk fill
ORANGE    = (245, 122, 27, 255)    # "P" + ring + bookmarklet button accent
WHITE     = (245, 245, 245, 255)   # "L"
RING_W_FRAC = 0.045                # ring thickness as fraction of size

def render_master(size: int = 1024) -> Image.Image:
    """Returns the icon at `size`x`size` with a transparent background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Circle disk + ring.
    pad = int(size * 0.04)
    disk_box = (pad, pad, size - pad, size - pad)
    d.ellipse(disk_box, fill=BG_DARK)
    ring_w = int(size * RING_W_FRAC)
    d.ellipse(disk_box, outline=ORANGE, width=ring_w)

    # --- LP monogram --------------------------------------------------
    # We draw "LP" as two overlapping bold letters. To avoid bundling a
    # font file we draw the glyphs as filled paths using rounded rects.
    cx, cy = size // 2, size // 2
    glyph_h = int(size * 0.50)
    stroke = int(size * 0.13)            # bar thickness
    radius = int(stroke * 0.45)          # rounded corner radius

    # The "L" glyph -----------------------------------------------------
    # vertical bar
    Lx = cx - int(size * 0.20)
    Ltop = cy - glyph_h // 2
    Lbot = cy + glyph_h // 2
    d.rounded_rectangle(
        (Lx - stroke // 2, Ltop, Lx + stroke // 2, Lbot),
        radius=radius, fill=WHITE,
    )
    # horizontal foot — wider than tall and clearly extending to the right
    foot_w = int(size * 0.26)
    foot_h = int(stroke * 0.70)
    d.rounded_rectangle(
        (Lx - stroke // 2, Lbot - foot_h, Lx - stroke // 2 + foot_w, Lbot),
        radius=int(foot_h * 0.45), fill=WHITE,
    )

    # The "P" glyph -----------------------------------------------------
    Px = cx + int(size * 0.04)
    Ptop = cy - glyph_h // 2
    Pbot = cy + glyph_h // 2
    # vertical bar (orange)
    d.rounded_rectangle(
        (Px - stroke // 2, Ptop, Px + stroke // 2, Pbot),
        radius=radius, fill=ORANGE,
    )
    # bowl: a thick orange circle outline on the upper half
    bowl_d = int(glyph_h * 0.62)
    bowl_box = (Px - stroke // 2, Ptop, Px - stroke // 2 + bowl_d, Ptop + bowl_d)
    d.ellipse(bowl_box, outline=ORANGE, width=stroke)

    # Subtle inner shadow on the disk for a tactile feel.
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    sd.ellipse(disk_box, outline=(0, 0, 0, 90), width=int(size * 0.012))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(size * 0.008)))
    img.alpha_composite(shadow)

    return img


def write_master():
    """Master 1024x1024 with a square dark background (some app stores require opaque)."""
    sq = Image.new("RGBA", (1024, 1024), BG_DARK)
    sq.alpha_composite(render_master(1024))
    out = os.path.join(OUT_BASE, "icon-source.png")
    sq.save(out, "PNG", optimize=True)
    return out


# --- Android launcher icons --------------------------------------------
# Cordova reads the densities specified in config.xml. Standard sizes:
ANDROID_ICONS = {
    "ldpi":    36,
    "mdpi":    48,
    "hdpi":    72,
    "xhdpi":   96,
    "xxhdpi":  144,
    "xxxhdpi": 192,
}

def write_android_icons():
    icon_dir = os.path.join(OUT_BASE, "icon", "android")
    os.makedirs(icon_dir, exist_ok=True)
    master = Image.new("RGBA", (1024, 1024), BG_DARK)
    master.alpha_composite(render_master(1024))
    for name, size in ANDROID_ICONS.items():
        master.resize((size, size), Image.LANCZOS).save(
            os.path.join(icon_dir, f"{name}.png"), "PNG", optimize=True
        )
    return icon_dir


# --- Splash screens -----------------------------------------------------
# Per cordova-plugin-splashscreen / cordova-android conventions. We render the
# logo centered on a solid dark-brand background at multiple resolutions.
SPLASH_SIZES = {
    # name             (w,    h)
    "splash-port-ldpi":      ( 200,  320),
    "splash-port-mdpi":      ( 320,  480),
    "splash-port-hdpi":      ( 480,  800),
    "splash-port-xhdpi":     ( 720, 1280),
    "splash-port-xxhdpi":    (1080, 1920),
    "splash-port-xxxhdpi":   (1440, 2560),
    "splash-land-ldpi":      ( 320,  200),
    "splash-land-mdpi":      ( 480,  320),
    "splash-land-hdpi":      ( 800,  480),
    "splash-land-xhdpi":     (1280,  720),
    "splash-land-xxhdpi":    (1920, 1080),
    "splash-land-xxxhdpi":   (2560, 1440),
}

def write_splashes():
    out = os.path.join(OUT_BASE, "screen", "android")
    os.makedirs(out, exist_ok=True)
    for name, (w, h) in SPLASH_SIZES.items():
        canvas = Image.new("RGBA", (w, h), BG_DARK)
        # Logo at ~40% of the short side, centered.
        s = int(min(w, h) * 0.40)
        s = max(64, s)
        logo = render_master(s)
        canvas.alpha_composite(logo, ((w - s) // 2, (h - s) // 2))
        canvas.convert("RGB").save(os.path.join(out, f"{name}.png"), "PNG", optimize=True)
    return out


# Android 12+ system SplashScreen API expects a 1024x1024 source asset whose
# foreground occupies the inner ~66% (the system masks to a 240dp circle on a
# 432dp canvas). Render with a transparent background so the configured
# AndroidWindowSplashScreenIconBackgroundColor shows through.
def write_splash_icon():
    out = os.path.join(OUT_BASE, "screen", "android")
    os.makedirs(out, exist_ok=True)
    size = 1024
    inner = int(size * 0.60)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    logo = render_master(inner)
    canvas.alpha_composite(logo, ((size - inner) // 2, (size - inner) // 2))
    path = os.path.join(out, "splash-icon.png")
    canvas.save(path, "PNG", optimize=True)
    return path


if __name__ == "__main__":
    print("Master:    ", write_master())
    print("Icons:     ", write_android_icons())
    print("Splashes:  ", write_splashes())
    print("SplashIcon:", write_splash_icon())
