"""
Generate a clean, polished LaunchPad app icon (1024x1024 PNG).
Uses cairosvg if available, otherwise falls back to a pure-Pillow pixel art approach.
"""
import subprocess, sys

# Try installing cairosvg; fall back gracefully
try:
    import cairosvg
    HAS_CAIRO = True
except ImportError:
    HAS_CAIRO = False

SVG = """<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient: deep dark navy -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0b1e"/>
      <stop offset="100%" stop-color="#120e2a"/>
    </linearGradient>

    <!-- Rocket body gradient: purple → violet -->
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>

    <!-- Nose cone gradient: light lavender -->
    <linearGradient id="noseGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3e8ff"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>

    <!-- Fin gradient: darker violet -->
    <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>

    <!-- Exhaust flame: amber → transparent -->
    <radialGradient id="flameGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="1"/>
      <stop offset="45%" stop-color="#f97316" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>

    <!-- Outer glow behind rocket -->
    <radialGradient id="glowGrad" cx="50%" cy="55%" r="50%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>

    <!-- Window highlight -->
    <radialGradient id="winGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#bae6fd"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </radialGradient>

    <!-- Clip to rounded square -->
    <clipPath id="roundedClip">
      <rect x="0" y="0" width="1024" height="1024" rx="220" ry="220"/>
    </clipPath>

    <!-- Sheen overlay -->
    <linearGradient id="sheenGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>

    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="flameBlur">
      <feGaussianBlur stdDeviation="12"/>
    </filter>

    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#4c1d95" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- ── Background ──────────────────────────────────────────────────── -->
  <g clip-path="url(#roundedClip)">
    <rect x="0" y="0" width="1024" height="1024" fill="url(#bgGrad)"/>

    <!-- Subtle ambient glow behind rocket -->
    <ellipse cx="512" cy="560" rx="320" ry="280" fill="url(#glowGrad)"/>

    <!-- ── Rocket (centred, tilted ~18° right) ─────────────────────── -->
    <g transform="translate(512,500) rotate(18) translate(-140,-240)" filter="url(#dropShadow)">

      <!-- Left fin -->
      <polygon points="60,340 10,430 100,380" fill="url(#finGrad)" opacity="0.95"/>
      <!-- Right fin -->
      <polygon points="220,340 270,430 180,380" fill="url(#finGrad)" opacity="0.95"/>

      <!-- Exhaust nozzle -->
      <ellipse cx="140" cy="400" rx="52" ry="22" fill="#4c1d95"/>

      <!-- Rocket body -->
      <rect x="68" y="180" width="144" height="230" rx="30" fill="url(#bodyGrad)"/>

      <!-- Body highlight stripe -->
      <rect x="98" y="185" width="38" height="220" rx="12" fill="#ffffff" opacity="0.10"/>

      <!-- Nose cone -->
      <polygon points="140,40 72,190 208,190" fill="url(#noseGrad)"/>

      <!-- Porthole window -->
      <circle cx="140" cy="290" r="34" fill="#1e1b4b"/>
      <circle cx="140" cy="290" r="26" fill="url(#winGrad)"/>
      <!-- Window reflection -->
      <ellipse cx="131" cy="282" rx="10" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-20,131,282)"/>
    </g>

    <!-- ── Exhaust flame (blurred, drawn AFTER rocket for layering) ── -->
    <g transform="translate(512,500) rotate(18) translate(-140,-240)">
      <ellipse cx="140" cy="430" rx="60" ry="80" fill="url(#flameGrad)" filter="url(#flameBlur)"/>
      <!-- Inner bright core -->
      <ellipse cx="140" cy="420" rx="22" ry="30" fill="#fef08a" opacity="0.9" filter="url(#flameBlur)"/>
    </g>

    <!-- ── Top-left corner sheen (glassmorphism look) ─────────────── -->
    <rect x="0" y="0" width="1024" height="1024" fill="url(#sheenGrad)" rx="220"/>
  </g>
</svg>"""

if HAS_CAIRO:
    cairosvg.svg2png(bytestring=SVG.encode(), write_to="app-icon.png", output_width=1024, output_height=1024)
    print("Icon generated via cairosvg -> app-icon.png")
else:
    # Fallback: write SVG and use Pillow's SVG rasteriser path if available,
    # otherwise save the SVG for manual conversion.
    with open("app-icon.svg", "w") as f:
        f.write(SVG)
    print("cairosvg not available. SVG saved to app-icon.svg")

    # Try converting with Inkscape if installed
    try:
        result = subprocess.run(
            ["inkscape", "--export-type=png", "--export-filename=app-icon.png",
             "--export-width=1024", "--export-height=1024", "app-icon.svg"],
            capture_output=True, timeout=30
        )
        if result.returncode == 0:
            print("Icon generated via Inkscape -> app-icon.png")
        else:
            print("Inkscape failed:", result.stderr.decode())
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Try using the Windows built-in Magick / ImageMagick
        try:
            result = subprocess.run(
                ["magick", "app-icon.svg", "-resize", "1024x1024", "app-icon.png"],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                print("Icon generated via ImageMagick -> app-icon.png")
            else:
                print("ImageMagick failed:", result.stderr.decode())
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("No SVG renderer found. Using app-icon.svg directly.")
            # As last resort, use Pillow to make a flat fallback
            from PIL import Image, ImageDraw
            im = Image.new("RGBA", (1024, 1024), (13, 11, 30, 255))
            im.save("app-icon.png")
            print("Minimal fallback saved.")
