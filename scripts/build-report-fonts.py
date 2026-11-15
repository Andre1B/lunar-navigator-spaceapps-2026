"""Reproduce the embedded PDF typeface from the installed Fontsource package.
Requires the optional local FontTools build tool. No network calls.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
out = ROOT / "public/assets/fonts"
out.mkdir(parents=True, exist_ok=True)
records = []
for weight, style in [(400, "regular"), (700, "bold")]:
    source = ROOT / f"node_modules/@fontsource/overpass/files/overpass-latin-{weight}-normal.woff2"
    target = out / f"overpass-5.3.0-report-{style}.ttf"
    font = TTFont(source, recalcTimestamp=False)
    font.flavor = None
    font.save(target)
    records.append({"file": target.name, "source": source.relative_to(ROOT).as_posix(),
                    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                    "conversion": "WOFF2 decompressed to TTF with FontTools; outlines unchanged, original font timestamps preserved."})
shutil.copyfile(ROOT / "node_modules/@fontsource/overpass/LICENSE", out / "OFL-Overpass.txt")
(out / "report-fonts.json").write_text(json.dumps({"font": "Overpass", "source": "https://github.com/RedHatOfficial/Overpass",
    "license": "SIL Open Font License 1.1", "files": records}, indent=2)+"\n", encoding="utf-8", newline="\n")
